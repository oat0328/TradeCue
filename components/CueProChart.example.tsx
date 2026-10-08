import React from "react";
import {Example} from "@floot/examples";
import {CueProChart} from "./CueProChart";
import type {Candle} from "../helpers/chartMath";
const make=(start:number,count:number,base:number):Candle[]=>Array.from({length:count},(_,i)=>{
 const price=base+i*.1+Math.sin(i*.55)*2;
 return {time:new Date(start+i*300000).toISOString(),open:price-.2,high:price+.7,low:price-.8,close:price+.1,volume:100000+i*900};
});
const bars=[...make(Date.UTC(2026,9,5,13,30),70,98),...make(Date.UTC(2026,9,6,12),18,106),...make(Date.UTC(2026,9,6,13,30),55,108)];
export default function Showcase(){
 return <><h1>Chart markings</h1><p>Illustrative candles for drawing and layout checks. This is not a live market feed or trade recommendation.</p>
 <Example title="Entry, partial exits and realized gross profit — illustrative" fullBleed><CueProChart symbol="DRAW-DEMO" timeframe="5m" bars={bars} action="WAIT" levels={{entryLow:111,entryHigh:112,stop:108,target1:116,target2:120,target3:124}} trades={[{id:"illustrative-trade",symbol:"DRAW-DEMO",accountId:"demo",status:"closed",entryTime:bars[bars.length-35].time!,entryPrice:110,quantity:10,exits:[{id:"sale-1",time:bars[bars.length-20].time!,price:112,quantity:5},{id:"sale-2",time:bars[bars.length-5].time!,price:114,quantity:5}]}]}/></Example></>;
}