function number(value:unknown):number|null{if(value==null||value===""||typeof value==="boolean")return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export function snapshotChangePercent(row:Record<string,unknown>){
 const ratio=number(row.change_ratio);if(ratio!=null)return ratio*100;
 const percent=number(row.change_percent??row.changePercent);if(percent!=null)return percent;
 const prior=number(row.pre_close),price=number(row.price??row.close??row.latest_price??row.last_price);
 return prior!=null&&prior>0&&price!=null&&price>0?(price/prior-1)*100:null;
}
