export const OMEGA_MONTHLY_OBJECTIVE=10000;
export function omegaMonthlyObjective(rows:Array<{realizedPnl:string|number|null;exitTime:Date|string|null}>,now=new Date()){
 const key=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
 const today=key(now),month=today.slice(0,7);
 const calendar=new Date(today+"T12:00:00Z");
 const weekStart=new Date(calendar);weekStart.setUTCDate(calendar.getUTCDate()-((calendar.getUTCDay()+6)%7));
 const weekKey=weekStart.toISOString().slice(0,10);
 let monthPnl=0,weekPnl=0,closedTrades=0;
 for(const row of rows){
  if(row.exitTime==null||row.realizedPnl==null)continue;
  const date=new Date(row.exitTime),pnl=Number(row.realizedPnl);
  if(!Number.isFinite(date.getTime())||!Number.isFinite(pnl)||date>now)continue;
  const day=key(date);
  if(day.slice(0,7)===month){monthPnl+=pnl;closedTrades++;}
  if(day>=weekKey&&day<=today)weekPnl+=pnl;
 }
 let weekdaysLeft=0;
 const end=new Date(Date.UTC(calendar.getUTCFullYear(),calendar.getUTCMonth()+1,1,12));
 for(let day=new Date(calendar);day<end;day.setUTCDate(day.getUTCDate()+1)){
  if(day.getUTCDay()!==0&&day.getUTCDay()!==6)weekdaysLeft++;
 }
 const remaining=Math.max(0,OMEGA_MONTHLY_OBJECTIVE-monthPnl);
 return {month,monthlyTarget:OMEGA_MONTHLY_OBJECTIVE,weeklyPace:2500,dailyPace:500,monthPnl,weekPnl,closedTrades,
 remaining,progress:Math.max(0,Math.min(100,monthPnl/OMEGA_MONTHLY_OBJECTIVE*100)),reached:monthPnl>=OMEGA_MONTHLY_OBJECTIVE,
 weekdaysLeft,requiredAveragePerWeekday:weekdaysLeft?remaining/weekdaysLeft:null,
 basis:"CLOSED_PAPER_JOURNAL_GROSS" as const,checkedAt:now.toISOString()};
}
