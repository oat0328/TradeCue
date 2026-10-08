/** Normalize broker epoch seconds/milliseconds and ISO timestamps. Unknown stays unknown. */
export function brokerTime(value:unknown):string|null{
 if(value==null||value==="")return null;
 let milliseconds:number;
 if(value instanceof Date)milliseconds=value.getTime();
 else if(typeof value==="number"||(typeof value==="string"&&/^\d+(\.\d+)?$/.test(value.trim()))){
  const numeric=Number(value);
  milliseconds=numeric<1e11?numeric*1000:numeric;
 }else if(typeof value==="string")milliseconds=Date.parse(value);
 else return null;
 if(!Number.isFinite(milliseconds)||milliseconds<946684800000||milliseconds>4102444800000)return null;
 return new Date(milliseconds).toISOString();
}
