import superjson from "superjson";

export async function readApiResponse<T>(response:Response,fallback:string):Promise<T>{
  const text=await response.text();
  let data:any=null;
  if(text){
    try{
      data=superjson.parse<any>(text);
    }catch{
      try{
        data=JSON.parse(text);
      }catch{
        throw new Error(response.ok?fallback:`${fallback} (HTTP ${response.status})`);
      }
    }
  }
  if(!response.ok){
    throw new Error(data?.error||`${fallback} (HTTP ${response.status})`);
  }
  return data as T;
}

