import React from "react";
import { Example } from "@floot/examples";
import { CandleEducation } from "./CandleEducation";
import type { Candle } from "../helpers/chartMath";
const bars:Candle[]=Array.from({length:80},(_,i)=>({
  time:new Date(Date.parse("2026-10-05T13:30:00Z")+i*300000).toISOString(),
  open:10+i*.025,high:10.15+i*.025,low:9.9+i*.025,close:10.04+i*.025,volume:10000+i*100,
}));
bars[60]={...bars[60],open:11.5,high:11.7,low:10.9,close:11.6,volume:24000};
export default function Showcase(){
  return <><h1>Candle education</h1><p>Illustrative sample bars for checking the lesson interface. These are not live quotes or actual account results.</p>
    <Example title="Recovery candle study" fullBleed><CandleEducation bars={bars} index={60} symbol="SAMPLE" timeframe="5m" replay={false}/></Example>
    <Example title="Replay before future bars are revealed" fullBleed><CandleEducation bars={bars.slice(0,61)} index={60} symbol="SAMPLE" timeframe="5m" replay={true}/></Example>
  </>;
}
