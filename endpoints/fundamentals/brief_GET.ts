import { flootAi } from "@floot/ai";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  schema,
  type EarningsItem,
  type NewsItem,
  type OutputType,
} from "./brief_GET.schema";

const FMP_BASE = "https://financialmodelingprep.com/stable";

async function fmpFetch(path: string, apiKey: string) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(FMP_BASE + path + separator + "apikey=" + encodeURIComponent(apiKey), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("FMP request failed (" + response.status + ")");
  return response.json();
}

function normalizeNews(value: unknown, fallbackSymbol: string): NewsItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item: any) => ({
    symbol: typeof item.symbol === "string" ? item.symbol : fallbackSymbol,
    publishedDate: typeof item.publishedDate === "string" ? item.publishedDate : typeof item.publishedAt === "string" ? item.publishedAt : null,
    title: typeof item.title === "string" ? item.title : "Untitled market update",
    text: typeof item.text === "string" ? item.text : null,
    site: typeof item.site === "string" ? item.site : typeof item.publisher === "string" ? item.publisher : null,
    url: typeof item.url === "string" ? item.url : null,
  }));
}

function normalizeEarnings(value: unknown): EarningsItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item: any) => ({
    date: typeof item.date === "string" ? item.date : null,
    epsActual: typeof item.epsActual === "number" ? item.epsActual : null,
    epsEstimated: typeof item.epsEstimated === "number" ? item.epsEstimated : null,
    revenueActual: typeof item.revenueActual === "number" ? item.revenueActual : null,
    revenueEstimated: typeof item.revenueEstimated === "number" ? item.revenueEstimated : null,
  }));
}

function decodeXml(value:string){
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function tag(block:string,name:string){
  const match=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));
  return match?decodeXml(match[1].trim()):null;
}

async function publicNews(symbol:string):Promise<NewsItem[]>{
  const query=encodeURIComponent(symbol+" stock when:7d");
  const url="https://news.google.com/rss/search?q="+query+"&hl=en-US&gl=US&ceid=US:en";
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 TradeCUE/1.0"},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error("Public news feed unavailable");
  const xml=await response.text();
  const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match=>match[1]).slice(0,10);
  return blocks.map(block=>({
    symbol,
    publishedDate:tag(block,"pubDate"),
    title:tag(block,"title")??"Market update",
    text:null,
    site:tag(block,"source")??"Google News",
    url:tag(block,"link"),
  }));
}

async function summarize(symbol:string,news:NewsItem[],extra:Record<string,unknown>={}){
  if(!news.length)return "No current public headlines were returned. Use Webull fundamentals and price action until the feed refreshes.";
  try{
    const ai=await flootAi.chat({
      model:"gpt-6-luna",
      reasoning:{effort:"low"},
      max_output_tokens:260,
      instructions:"You are Professor Cue. Use only the supplied facts. In 3 concise sentences summarize the catalyst tone, uncertainty, and what price/volume confirmation still matters. Never promise profit.",
      input:JSON.stringify({symbol,headlines:news.slice(0,6),...extra}),
    });
    return ai.output_text?.trim()||"Current headlines are live. Treat them as catalyst context and confirm the move with price, volume, and market structure.";
  }catch{
    return "Current headlines are live. Treat them as catalyst context and confirm the move with price, volume, and market structure.";
  }
}

async function buildPublicOutput(symbol:string):Promise<OutputType>{
  const news=await publicNews(symbol).catch(()=>[]);
  return {
    symbol,
    generatedAt:new Date().toISOString(),
    source:"public_news",
    cueSummary:await summarize(symbol,news),
    news,
    earnings:[],
    ratingSnapshot:null,
    priceTargetConsensus:null,
  };
}

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);
    const url = new URL(request.url);
    const input = schema.parse({ symbol: url.searchParams.get("symbol") ?? "" });
    const symbol=input.symbol;
    const apiKey = (process.env as Record<string, string | undefined>)["FMP_API_KEY"];

    if(!apiKey){
      const output=await buildPublicOutput(symbol);
      return new Response(superjson.stringify(output),{headers:{"Content-Type":"application/json"}});
    }

    try{
      const [newsRaw, earningsRaw, ratingRaw, targetRaw] = await Promise.all([
        fmpFetch("/news/stock?symbols=" + encodeURIComponent(symbol) + "&limit=10", apiKey),
        fmpFetch("/earnings?symbol=" + encodeURIComponent(symbol) + "&limit=8", apiKey),
        fmpFetch("/ratings-snapshot?symbol=" + encodeURIComponent(symbol), apiKey),
        fmpFetch("/price-target-consensus?symbol=" + encodeURIComponent(symbol), apiKey),
      ]);

      const news = normalizeNews(newsRaw, symbol);
      const earnings = normalizeEarnings(earningsRaw);
      const ratingSnapshot = Array.isArray(ratingRaw) && ratingRaw.length > 0 ? ratingRaw[0] as Record<string, unknown> : null;
      const priceTargetConsensus = Array.isArray(targetRaw) && targetRaw.length > 0 ? targetRaw[0] as Record<string, unknown> : null;

      const output: OutputType = {
        symbol,
        generatedAt: new Date().toISOString(),
        source:"fmp",
        cueSummary:await summarize(symbol,news,{recentEarnings:earnings.slice(0,4),ratingSnapshot,priceTargetConsensus}),
        news,
        earnings,
        ratingSnapshot,
        priceTargetConsensus,
      };
      return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
    }catch{
      const output=await buildPublicOutput(symbol);
      return new Response(superjson.stringify(output),{headers:{"Content-Type":"application/json"}});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load fundamental intelligence";
    return new Response(superjson.stringify({ error: message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
