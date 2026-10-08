import {schema}from "../endpoints/webull/live-order_POST.schema";

describe("Webull live order safety",()=>{
  const base={accountId:"acct-1",symbol:"AAPL",side:"BUY" as const,orderType:"MARKET" as const,quantity:1};
  it("allows preview without live confirmation",()=>{
    expect(schema.safeParse({...base,action:"preview"}).success).toBeTrue();
  });
  it("blocks real placement without typing LIVE",()=>{
    expect(schema.safeParse({...base,action:"place"}).success).toBeFalse();
    expect(schema.safeParse({...base,action:"place",confirmationText:"live"}).success).toBeFalse();
  });
  it("allows real placement only with exact LIVE confirmation",()=>{
    expect(schema.safeParse({...base,action:"place",confirmationText:"LIVE"}).success).toBeTrue();
  });
  it("requires a limit price for limit orders",()=>{
    expect(schema.safeParse({...base,orderType:"LIMIT",action:"preview"}).success).toBeFalse();
    expect(schema.safeParse({...base,orderType:"LIMIT",limitPrice:200,action:"preview"}).success).toBeTrue();
  });
});
