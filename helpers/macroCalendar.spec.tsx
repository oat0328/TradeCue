import { assessMacroCalendar } from "./macroCalendar";
describe("macro calendar safety",()=>{
  const now=Date.parse("2026-10-05T13:30:00Z");
  const row=(minutes:number,impact="High")=>({date:new Date(now+minutes*60000).toISOString(),impact,currency:"USD",event:"Release"});
  it("never turns a provider error object into clear",()=>expect(assessMacroCalendar({error:"upgrade"},now).state).toBe("OFFLINE"));
  it("rejects malformed records",()=>expect(assessMacroCalendar([null],now).state).toBe("OFFLINE"));
  it("rejects missing timestamps",()=>expect(assessMacroCalendar([{impact:"High"}],now).state).toBe("OFFLINE"));
  it("rejects missing impact",()=>expect(assessMacroCalendar([{date:new Date(now).toISOString()}],now).state).toBe("OFFLINE"));
  it("blocks the event and both lockout boundaries",()=>{for(const m of [-10,0,10])expect(assessMacroCalendar([row(m)],now).state).toBe("BLOCKED");});
  it("warns within an hour",()=>expect(assessMacroCalendar([row(30)],now).state).toBe("CAUTION"));
  it("clears a distant high event",()=>expect(assessMacroCalendar([row(120)],now).state).toBe("CLEAR"));
  it("ignores non USD events",()=>expect(assessMacroCalendar([{...row(0),currency:"EUR",country:"DE"}],now).state).toBe("CLEAR"));
  it("finds a high event beyond the display limit",()=>{
    const result=assessMacroCalendar([...Array.from({length:13},(_,i)=>row(i/10,"Low")),row(5)],now);
    expect(result.state).toBe("BLOCKED");expect(result.events.length).toBe(12);expect(result.nearest?.impact).toBe("HIGH");
  });
  it("recalculates a cached calendar as time advances",()=>{
    const raw=[row(70)];expect(assessMacroCalendar(raw,now).state).toBe("CLEAR");
    expect(assessMacroCalendar(raw,now+65*60000).state).toBe("BLOCKED");
  });
});
