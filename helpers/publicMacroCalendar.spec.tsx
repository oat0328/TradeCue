import { assessPublicCalendar } from "./publicMacroCalendar";
describe("public calendar fallback",()=>{
 const now=Date.parse("2026-10-05T13:30:00Z"),modified=new Date(now-60000).toUTCString();
 const row=(date:string,impact="High",country="USD")=>({date,impact,country,title:"Release"});
 const tail=row("2026-10-09T16:00:00-04:00","Low","CAD");
 it("uses explicit event offsets and blocks nearby releases",()=>expect(assessPublicCalendar([row("2026-10-05T09:35:00-04:00"),tail],modified,now).state).toBe("BLOCKED"));
 it("rejects empty or truncated weeks",()=>{expect(assessPublicCalendar([],modified,now).connected).toBe(false);expect(assessPublicCalendar([row("2026-10-05T09:35:00-04:00")],modified,now).connected).toBe(false);});
 it("rejects stale feeds and unknown impact",()=>{expect(assessPublicCalendar([tail],new Date(now-2*86400000).toUTCString(),now).connected).toBe(false);expect(assessPublicCalendar([row("2026-10-05T09:35:00-04:00","Unknown"),tail],modified,now).connected).toBe(false);});
 it("rejects a previous week despite a fresh modification date",()=>expect(assessPublicCalendar([row("2026-10-02T16:00:00-04:00")],modified,now).connected).toBe(false));
 it("recalculates cached events",()=>{const rows=[row("2026-10-05T10:40:00-04:00"),tail];expect(assessPublicCalendar(rows,modified,now).state).toBe("CLEAR");expect(assessPublicCalendar(rows,modified,now+65*60000).state).toBe("BLOCKED");});
});
