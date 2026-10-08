import {chartFillBar,chartTradeResult} from "./chartTradeFills";
import type {ChartTrade} from "../endpoints/journal/chart-trades_GET.schema";
const bars=["2026-10-07T14:00:00Z","2026-10-07T14:05:00Z","2026-10-07T14:10:00Z"];
const trade:ChartTrade={id:"t",accountId:"paper",symbol:"XYZ",status:"open",entryTime:bars[0],entryPrice:100,quantity:10,exits:[{id:"a",time:bars[1],price:102,quantity:3},{id:"b",time:bars[2],price:99,quantity:2}]};
describe("Confirmed chart fills",()=>{
 it("maps a fill to its containing candle including exact boundaries",()=>{
  expect(chartFillBar("2026-10-07T14:04:59Z",bars,"5m")).toBe(Date.parse(bars[0])/1000);
  expect(chartFillBar(bars[1],bars,"5m")).toBe(Date.parse(bars[1])/1000);
  expect(chartFillBar("2026-10-07T14:14:59Z",bars,"5m")).toBe(Date.parse(bars[2])/1000);
 });
 it("does not move out-of-range or gap fills onto an unrelated candle",()=>{
  expect(chartFillBar("2026-10-07T13:59:59Z",bars,"5m")).toBeNull();
  expect(chartFillBar("2026-10-07T14:15:00Z",bars,"5m")).toBeNull();
  expect(chartFillBar("2026-10-07T20:00:00Z",[bars[0],"2026-10-08T14:00:00Z"],"5m")).toBeNull();
 });
 it("uses the selected higher-timeframe candle",()=>{
  expect(chartFillBar("2026-10-07T14:40:00Z",[bars[0]],"1H")).toBe(Date.parse(bars[0])/1000);
 });
 it("calculates partial gross result and leaves open shares unrealized",()=>{
  const result=chartTradeResult(trade);
  expect(result.grossPnl).toBe(4);
  expect(result.sold).toBe(5);
  expect(result.remaining).toBe(5);
 });
 it("does not invent profit when there are no exits",()=>expect(chartTradeResult({...trade,exits:[]}).grossPnl).toBeNull());
 it("handles complete losing trades and excludes invalid fill data",()=>{
  expect(chartTradeResult({...trade,status:"closed",exits:[{id:"x",time:bars[1],price:98,quantity:10}]}).grossPnl).toBe(-20);
  expect(chartTradeResult({...trade,exits:[{id:"x",time:"invalid",price:102,quantity:10}]}).grossPnl).toBeNull();
 });
});