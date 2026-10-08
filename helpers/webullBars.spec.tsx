import { webullBarsBySymbol } from "./webullBars";

describe("webullBarsBySymbol",()=>{
  it("splits a multi-symbol Webull bar response",()=>{
    const raw={result:[
      {symbol:"AAPL",result:[{time:"2026-10-02T23:55:00.000+0000",open:"10",high:"11",low:"9",close:"10.5",volume:"100"}]},
      {symbol:"NVDA",result:[{time:"2026-10-02T23:55:00.000+0000",open:"20",high:"21",low:"19",close:"20.5",volume:"200"}]},
    ]};
    const grouped=webullBarsBySymbol(raw);
    expect(grouped.AAPL.length).toBe(1);
    expect(grouped.NVDA.length).toBe(1);
    expect(grouped.AAPL[0].close).toBe(10.5);
    expect(grouped.NVDA[0].volume).toBe(200);
  });
});
