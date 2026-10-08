import {readApiResponse} from "./apiClient";

describe("readApiResponse",()=>{
  it("parses superjson responses",async()=>{
    const response=new Response('{"json":{"ok":true}}',{status:200});
    const result=await readApiResponse<{ok:boolean}>(response,"failed");
    expect(result).toEqual({ok:true});
  });

  it("parses plain JSON responses without returning undefined",async()=>{
    const response=new Response('{"buildId":"abc","generatedAt":"now"}',{status:200});
    const result=await readApiResponse<{buildId:string;generatedAt:string}>(response,"failed");
    expect(result).toEqual({buildId:"abc",generatedAt:"now"});
  });

  it("replaces raw HTML/404 parser noise with a user-facing HTTP error",async()=>{
    const response=new Response("<html>Not found</html>",{status:404});
    let message="";
    try{
      await readApiResponse(response,"Unable to load");
    }catch(error){
      message=error instanceof Error?error.message:String(error);
    }
    expect(message).toBe("Unable to load (HTTP 404)");
  });
});
