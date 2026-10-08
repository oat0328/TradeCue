import {cleanChartBars,loadedDayVwap,tradedVolumeProfile} from "./chartContext";
const candle=(time:string,close=10,volume=100)=>({time,open:close,high:close+1,low:close-1,close,volume});
describe("Chart data integrity",()=>{
 it("sorts and deduplicates timestamps and rejects corrupt candles",()=>{const a=candle("2026-10-05T14:00:00Z");const bars=cleanChartBars([candle("bad"),candle("2026-10-05T14:05:00Z"),a,{...a,close:10.5}, {...a,high:1}]);expect(bars.length).toBe(2);expect(bars[0].close).toBe(10.5);});
 it("resets loaded-bar VWAP on the next exchange date",()=>{const points=loadedDayVwap([candle("2026-10-05T14:00:00Z",10,100),candle("2026-10-05T14:05:00Z",20,300),candle("2026-10-06T14:00:00Z",30,100)]);expect(points[1].value).toBe(17.5);expect(points[2].value).toBe(30);});
 it("conserves measured volume rather than inventing order depth",()=>{const profile=tradedVolumeProfile([candle("2026-10-05T14:00:00Z",10,100),candle("2026-10-05T14:05:00Z",20,300)]);expect(profile.reduce((s,b)=>s+b.volume,0)).toBe(400);expect(profile.reduce((s,b)=>s+b.share,0)).toBeCloseTo(1);});
});
