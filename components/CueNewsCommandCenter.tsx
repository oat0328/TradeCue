import React from "react";
import { Newspaper,ShieldAlert,Sparkles } from "lucide-react";
import { Badge } from "./Badge";
import type { NewsItem } from "../endpoints/fundamentals/brief_GET.schema";
import styles from "./CueNewsCommandCenter.module.css";

export function CueNewsCommandCenter({
  symbol,source,news,summary,macroState,loading,error,expanded=false,
}:{
  expanded?:boolean;
  symbol:string;
  source:"fmp"|"public_news"|null;
  news:NewsItem[];
  summary:string|null;
  macroState?:string|null;
  loading:boolean;
  error?:string|null;
}){
  const macroVariant=macroState==="BLOCKED"?"destructive":macroState==="CLEAR"?"success":"warning";
  return <section className={styles.panel+(expanded?" "+styles.expanded:"")} id={expanded?"news-reader":"news-command-center"}>
    <div className={styles.head}>
      <div className={styles.title}><Newspaper size={18}/><span><small>NEWS & CATALYSTS</small><strong>{symbol} command-center tape</strong></span></div>
      <div className={styles.badges}>
        <Badge variant={error?"warning":source?"success":"outline"}>{error?"UPDATE DELAYED":source==="fmp"?"FMP NEWS":source==="public_news"?"PUBLIC NEWS":loading?"LOADING":"NO FEED"}</Badge>
        <Badge variant={macroVariant as any}>MACRO {macroState??"CHECKING"}</Badge>
      </div>
    </div>
    <div className={styles.body}>
      <div className={styles.tape}>
        {news.slice(0,expanded?20:5).map((item,index)=><article key={(item.url||item.title)+index}>
          <span>{item.site||"Market"}</span>
          <strong>{item.title}</strong>
          {expanded&&item.text&&<p>{item.text}</p>}
          {item.url&&/^https?:\/\//i.test(item.url)&&<a href={item.url} target="_blank" rel="noopener noreferrer">Read original article ↗</a>}
          <em>{item.publishedDate?new Date(item.publishedDate).toLocaleString():"Update"}</em>
        </article>)}
        {!loading&&!news.length&&<div className={styles.empty}>{error||"No fresh headline returned yet. TradeCUE will not invent a catalyst."}</div>}
        {loading&&!news.length&&<div className={styles.empty}>Loading current headlines…</div>}
      </div>
      <aside className={styles.read}>
        <div><Sparkles size={16}/><span><b>Omega catalyst read</b><p>{summary||"Waiting for current catalyst context."}</p></span></div>
        <div><ShieldAlert size={16}/><span><b>Trading rule</b><p>News can explain why price is moving, but Omega still requires price, volume, structure and risk confirmation before an entry.</p></span></div>
      </aside>
    </div>
  </section>;
}