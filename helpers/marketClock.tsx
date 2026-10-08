export type StockMarketMode="OVERNIGHT"|"WEEKEND_PREP"|"PREMARKET"|"RTH"|"AFTER_HOURS";

export function stockMarketMode(date=new Date()):StockMarketMode{
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",
    weekday:"short",
    hour:"2-digit",
    minute:"2-digit",
    hour12:false,
  }).formatToParts(date);
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  const weekday=get("weekday");
  const total=Number(get("hour"))*60+Number(get("minute"));
  if(weekday==="Sun"&&total>=20*60)return "OVERNIGHT";
  if(weekday==="Sat"||weekday==="Sun"||(weekday==="Fri"&&total>=20*60))return "WEEKEND_PREP";
  if(total<4*60)return "OVERNIGHT";
  if(total<9*60+30)return "PREMARKET";
  if(total<16*60)return "RTH";
  if(total<20*60)return "AFTER_HOURS";
  return "OVERNIGHT";
}

export function easternMinutes(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);
  return Number(parts.find(part=>part.type==="hour")?.value??0)*60+Number(parts.find(part=>part.type==="minute")?.value??0);
}

export function autoEntryTiming(date=new Date()){
  const total=easternMinutes(date);
  return {
    openingObservation:total>=570&&total<585,
    primarySession:total>=585&&total<720,
    normalSession:total>=720&&total<870,
    slowMarket:total>=870&&total<900,
    powerHour:total>=900&&total<960,
    final15:total>=945&&total<960,
    normalWindow:total>=585&&total<945,
  };
}

export function pacificMinutes(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Los_Angeles",
    hour:"2-digit",
    minute:"2-digit",
    hour12:false,
  }).formatToParts(date);
  return Number(parts.find(part=>part.type==="hour")?.value??0)*60+
    Number(parts.find(part=>part.type==="minute")?.value??0);
}

export function parseClockMinutes(value:string){
  const match=/^(\d{1,2}):(\d{2})$/.exec(value);
  return match?Number(match[1])*60+Number(match[2]):null;
}

export function afterPacificFlatTime(flatTime:string,date=new Date()){
  const flat=parseClockMinutes(flatTime);
  return flat!=null&&stockMarketMode(date)==="RTH"&&pacificMinutes(date)>=flat;
}