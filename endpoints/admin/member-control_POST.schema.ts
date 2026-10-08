import {z}from "zod";
import superjson from "superjson";
import {readApiResponse}from "../../helpers/apiClient";
export const schema=z.object({
  userId:z.number().int().positive(),
  action:z.enum(["pause_axiom","unlock_axiom","end_access","restore_access"]),
  confirmationText:z.string().optional(),
}).superRefine((value,ctx)=>{
  if(value.action==="end_access"&&value.confirmationText!=="END ACCESS"){
    ctx.addIssue({code:"custom",message:"Type END ACCESS to confirm account suspension.",path:["confirmationText"]});
  }
});
export type OutputType={updated:true;action:"pause_axiom"|"unlock_axiom"|"end_access"|"restore_access"};
export async function postAdminMemberControl(body:z.infer<typeof schema>):Promise<OutputType>{
 const r=await fetch("/_api/admin/member-control",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
 return readApiResponse<OutputType>(r,"Unable to update member controls");
}
