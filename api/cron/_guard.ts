function allowed(req:any){
  const secret=process.env.CRON_SECRET;
  if(!secret)return true;
  return String(req.headers?.authorization||"")==="Bearer "+secret;
}
export function cronResponse(res:any,status:number,body:any){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify(body));
}
export {allowed};
