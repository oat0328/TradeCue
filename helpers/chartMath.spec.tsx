import {
  emaSeries,
  smaSeries,
  rsiSeries,
  atrSeries,
  bollingerSeries,
  macdSeries,
  heikinAshi,
} from "./chartMath";
import type { Candle } from "./chartMath";

const values=Array.from({length:240},(_,index)=>100+index*.25+Math.sin(index/4));
const candles:Candle[]=values.map((close,index)=>({
  time:new Date(Date.UTC(2026,0,1)+index*60000).toISOString(),
  open:close-.2,
  high:close+.5,
  low:close-.6,
  close,
  volume:1000+index,
}));

describe("chartMath indicators",()=>{
  it("calculates moving averages without future values",()=>{
    const ema9=emaSeries(values,9);
    const sma50=smaSeries(values,50);
    expect(ema9.slice(0,8).every(value=>value===null)).toBeTrue();
    expect(ema9[8]).not.toBeNull();
    expect(sma50[48]).toBeNull();
    expect(sma50[49]).not.toBeNull();
  });

  it("calculates bounded RSI and positive ATR",()=>{
    const rsi=rsiSeries(values,14).filter((value):value is number=>value!==null);
    const atr=atrSeries(candles,14).filter((value):value is number=>value!==null);
    expect(rsi.every(value=>value>=0&&value<=100)).toBeTrue();
    expect(atr.every(value=>value>0)).toBeTrue();
  });

  it("calculates Bollinger bands and MACD only after enough history",()=>{
    const boll=bollingerSeries(values,20,2);
    const macd=macdSeries(values);
    expect(boll.middle[18]).toBeNull();
    expect(boll.upper[19]).not.toBeNull();
    expect(macd.line[24]).toBeNull();
    expect(macd.line[25]).not.toBeNull();
  });

  it("Heikin-Ashi output preserves length while using synthetic prices",()=>{
    const output=heikinAshi(candles);
    expect(output.length).toBe(candles.length);
    expect(output[1].open).toBe((output[0].open+output[0].close)/2);
  });
});

