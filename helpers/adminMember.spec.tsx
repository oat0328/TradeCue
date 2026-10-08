import {schema as couponSchema}from "../endpoints/admin/member-coupon_POST.schema";
import {schema as controlSchema}from "../endpoints/admin/member-control_POST.schema";

describe("admin member controls",()=>{
  it("accepts a target member and normalized coupon code",()=>{
    const result=couponSchema.parse({userId:4,code:"tradecue2026"});
    expect(result).toEqual({userId:4,code:"TRADECUE2026"});
  });
  it("rejects invalid target member ids",()=>{
    expect(couponSchema.safeParse({userId:0,code:"TRADECUE2026"}).success).toBeFalse();
  });
  it("allows safe Axiom pause/unlock admin actions",()=>{
    expect(controlSchema.safeParse({userId:4,action:"pause_axiom"}).success).toBeTrue();
    expect(controlSchema.safeParse({userId:4,action:"unlock_axiom"}).success).toBeTrue();
  });
  it("requires an exact typed confirmation before ending account access",()=>{
    expect(controlSchema.safeParse({userId:4,action:"end_access"}).success).toBeFalse();
    expect(controlSchema.safeParse({userId:4,action:"end_access",confirmationText:"END"}).success).toBeFalse();
    expect(controlSchema.safeParse({userId:4,action:"end_access",confirmationText:"END ACCESS"}).success).toBeTrue();
  });
  it("allows access restoration without starting automation",()=>{
    expect(controlSchema.safeParse({userId:4,action:"restore_access"}).success).toBeTrue();
  });
  it("rejects unknown destructive actions",()=>{
    expect(controlSchema.safeParse({userId:4,action:"delete_everything"}).success).toBeFalse();
    expect(controlSchema.safeParse({userId:4,action:"start_live_trading"}).success).toBeFalse();
  });
});
