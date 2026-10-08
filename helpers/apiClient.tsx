import superjson from "superjson";

export async function readApiResponse<T>(response:Response,fallback:string):Promise<T>{
  const text=await response.text();
  let data:any=null;
  if(text){
    try{
      const raw=JSON.parse(text);
      if(raw&&typeof raw==="object"&&Object.prototype.hasOwnProperty.call(raw,"json")){
        data=superjson.deserialize(raw);
      }else{
        data=raw;
      }
    }catch{
      throw new Error(response.ok?fallback:`${fallback} (HTTP ${response.status})`);
    }
  }
  if(!response.ok){
    throw new Error(data?.error||`${fallback} (HTTP ${response.status})`);
  }
  return data as T;
}
