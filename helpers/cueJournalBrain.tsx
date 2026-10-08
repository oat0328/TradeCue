import { sql } from "kysely";
import { db } from "./db";
import { userKeys,webullAccounts,webullRead,webullTodayOrders } from "./webullClient";
import { webullBars } from "./webullBars";
import { brokerTime } from "./brokerTime";
import type { CueBrainUser } from "./cueBrainShared";
import { parseNum } from "./cueLotLedger";
import { processSellFill, type SellSyncStore, type SellSyncTx } from "./cueJournalSellSync";

function normalizedStatus(value:string){return String(value||"").toUpperCase().replace(/[^A-Z]/g,"");}
function isFilled(value:string){return ["FILLED","FINALFILLED","COMPLETED"].includes(normalizedStatus(value));}
// Keeps null/blank as unknown (old version turned null into 0 and defeated the ?? fallbacks).
const num=parseNum;

/** Postgres-backed store for processSellFill (see helpers/cueJournalSellSync for the guarantees). */
function postgresSellStore(userId:number,accountId:string,symbol:string):SellSyncStore{
  return {
    transaction:(fn)=>db.transaction().execute(async trx=>{
      const tx:SellSyncTx={
        lockKey:async key=>{await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(trx);},
        claimFill:async fill=>{
          const row=await trx.insertInto("cueJournalProcessedFills")
            .values({userId,accountId,fillId:fill.fillId,symbol:fill.symbol,qty:String(fill.qty)})
            .onConflict(oc=>oc.columns(["userId","accountId","fillId"]).doNothing())
            .returning("fillId").executeTakeFirst();
          return !!row;
        },
        setClaimAllocated:async(fillId,allocatedQty)=>{
          await trx.updateTable("cueJournalProcessedFills").set({allocatedQty:String(allocatedQty)})
            .where("userId","=",userId).where("accountId","=",accountId).where("fillId","=",fillId).execute();
        },
        loadLots:async()=>{
          const rows=await trx.selectFrom("cueTradeJournal")
            .select(["id","entryPrice","quantity","plannedRisk","status","exitOrderId"])
            .where("userId","=",userId).where("accountId","=",accountId).where("symbol","=",symbol)
            .orderBy("entryTime","asc").orderBy("id","asc").execute();
          return rows.map(r=>({id:String(r.id),entryPrice:num(r.entryPrice),quantity:num(r.quantity),plannedRisk:num(r.plannedRisk),status:r.status,exitOrderId:r.exitOrderId}));
        },
        loadExitFills:async ids=>{
          if(!ids.length)return [];
          const rows=await trx.selectFrom("cueJournalExitFills").select(["journalId","fillId","qty","price","filledAt"])
            .where("userId","=",userId).where("journalId","in",ids).execute();
          return rows.flatMap(r=>{
            const time=brokerTime(r.filledAt);
            return time?[{journalId:String(r.journalId),fillId:r.fillId,qty:Number(r.qty),price:Number(r.price),time}]:[];
          });
        },
        saveAllocation:async(result,fill)=>{
          for(const piece of result.newFills){
            await trx.insertInto("cueJournalExitFills").values({
              userId,accountId,journalId:String(result.id),fillId:piece.fillId,qty:String(piece.qty),price:String(piece.price),
              priceSource:fill.priceSource,filledAt:new Date(piece.time),
            }).execute(); // UNIQUE(user, account, fill, journal) — a violation aborts the whole transaction
          }
          const current=await trx.selectFrom("cueTradeJournal").select(["details"]).where("id","=",String(result.id)).executeTakeFirstOrThrow();
          const details={...asObject(current.details),lotPolicy:"FIFO",filledExitQty:result.filledExitQty,remainingQty:result.remainingQty,...(result.closed?{timeInTradeSource:"broker entry/exit timestamps"}:{})};
          await trx.updateTable("cueTradeJournal").set({
            details:details as any,
            realizedPnl:String(result.realizedPnl),
            ...(result.closed?{
              exitOrderId:fill.fillId,
              exitTime:result.lastExitTime?new Date(result.lastExitTime):new Date(),
              exitPrice:result.avgExitPrice!=null?String(result.avgExitPrice):null,
              realizedR:result.realizedR!=null?String(result.realizedR):null,
              outcome:result.outcome,
              status:"closed",
            }:{}),
            updatedAt:new Date(),
          }).where("id","=",String(result.id)).execute();
        },
      };
      return fn(tx);
    }),
  };
}

export async function syncJournalForUser(user:CueBrainUser){
  const keys=await userKeys(user);
  const accounts=await webullAccounts(keys);
  let opened=0,closed=0,partial=0,duplicateSells=0,unmatchedSells=0,updatedOrders=0;

  for(const account of accounts){
    const orders=await webullTodayOrders(keys,account.accountId);
    for(const order of orders){
      if(order.clientOrderId||order.orderId){
        const local=await db.selectFrom("paperOrders").selectAll()
          .where("userId","=",user.id).where("clientOrderId","=",order.clientOrderId||order.orderId!).executeTakeFirst();
        if(local){
          await db.updateTable("paperOrders").set({
            status:order.status,
            brokerOrderId:order.orderId??local.brokerOrderId,
            updatedAt:new Date(),
          }).where("id","=",local.id).execute();
          updatedOrders++;
        }

        if(order.side.toUpperCase()==="BUY"&&isFilled(order.status)&&order.filledAt&&num(order.filledPrice)!=null){
            const raw=local?.rawResponse as any;
            const plan=raw?.cuePlan??null;
            const entryPrice=num(order.filledPrice);
            const quantity=num(order.filledQuantity)??num(order.quantity)??num(local?.quantity);
            const stop=num(plan?.stop);
            const plannedRisk=entryPrice!=null&&quantity!=null&&stop!=null?Math.max(0,(entryPrice-stop)*quantity):null;
            // Partial UNIQUE index (user_id, entry_order_id) makes overlapping syncs insert one lot only.
            const inserted=await db.insertInto("cueTradeJournal").values({
              userId:user.id,
              accountId:account.accountId,
              symbol:order.symbol.toUpperCase(),
              setup:String(raw?.setup??(local?"CUE_TECHNICAL_V0_1":"EXTERNAL_PAPER")), 
              cueScore:num(raw?.cueScore),
              entryOrderId:order.clientOrderId||order.orderId!,
              entryTime:new Date(brokerTime(order.filledAt)??brokerTime(order.createdAt)??new Date().toISOString()),
              entryPrice:entryPrice!=null?String(entryPrice):null,
              quantity:quantity!=null?String(quantity):null,
              stopPrice:stop!=null?String(stop):null,
              target1:num(plan?.target1)!=null?String(num(plan?.target1)):null,
              target2:num(plan?.target2)!=null?String(num(plan?.target2)):null,
              target3:num(plan?.target3)!=null?String(num(plan?.target3)):null,
              plannedRisk:plannedRisk!=null?String(plannedRisk):null,
              status:"open",
              details:{source:"webull-paper",entryStatus:order.status,bracket:raw?.bracket??null,omegaProof:raw?.omegaProof??null},
              updatedAt:new Date(),
            }).onConflict(oc=>oc.columns(["userId","entryOrderId"]).where("entryOrderId","is not",null).doNothing())
              .returning("id").executeTakeFirst();
            if(inserted)opened++;
        }
      }
    }

    // SELL pass: after all BUYs, in fill-time order. Each fill goes through processSellFill,
    // which locks (user, account, symbol) and claims the fill id before touching any lot.
    const sells=orders
      .filter(order=>order.side.toUpperCase()==="SELL"&&isFilled(order.status))
      .sort((a,b)=>timeOf(a)-timeOf(b));
    for(const order of sells){
      const fillId=order.orderId||order.clientOrderId;
      if(!fillId)continue; // cannot dedupe a fill with no identifier; leave for manual review
      const filledPrice=num(order.filledPrice);
      const price=filledPrice;
      const qty=num(order.filledQuantity)??num(order.quantity);
      if(price==null||qty==null||qty<=0||!order.filledAt)continue;
      const symbol=order.symbol.toUpperCase();
      const outcome=await processSellFill(postgresSellStore(user.id,account.accountId,symbol),{
        userId:user.id,accountId:account.accountId,symbol,fillId,
        altIds:[order.clientOrderId,order.orderId??""].filter(id=>id&&id!==fillId),
        qty,price,
        time:brokerTime(order.filledAt)??new Date().toISOString(),
        priceSource:"filled",
      });
      if(outcome.status==="duplicate"){duplicateSells++;continue;}
      if(outcome.status==="no-open-lot"){unmatchedSells++;continue;}
      for(const result of outcome.results){
        if(result.closed){closed++;await recordExcursion(keys,String(result.id),result.lastExitTime);}
        else partial++;
      }
    }
  }

  return {opened,closed,partial,duplicateSells,unmatchedSells,updatedOrders};
}

/** MFE/MAE for a closed lot. Runs after the allocation commits; idempotent, so overlap is harmless. */
async function recordExcursion(keys:Awaited<ReturnType<typeof userKeys>>,journalId:string,lastExitTime:string|null){
  try{
    const row=await db.selectFrom("cueTradeJournal").select(["symbol","entryTime","entryPrice","quantity","mae","mfe","details"]).where("id","=",journalId).executeTakeFirst();
    const entryPrice=num(row?.entryPrice),lotQty=num(row?.quantity);
    if(!row||entryPrice==null||lotQty==null)return;
    const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols:[row.symbol],category:"US_STOCK",timespan:"M5",count:"1200",real_time_required:false,trading_sessions:"PRE,RTH,ATH",
    });
    const bars=webullBars(raw);
    const start=row.entryTime?new Date(row.entryTime).getTime():0;
    const end=lastExitTime?Date.parse(lastExitTime):Date.now();
    const held=bars.filter(bar=>Date.parse(bar.time)>=start&&Date.parse(bar.time)<=end);
    if(!held.length)return;
    await db.updateTable("cueTradeJournal").set({
      details:{...asObject(row.details),timeInTradeSeconds:Math.max(0,(end-start)/1000),excursionSource:"Estimated M5 bars; original lot quantity; excludes partial entry candle; not exact intrabar excursions"} as any,
      mfe:String(Math.max(Number(row.mfe??0),0,(Math.max(...held.map(bar=>bar.high))-entryPrice)*lotQty)),
      mae:String(Math.min(Number(row.mae??0),0,(Math.min(...held.map(bar=>bar.low))-entryPrice)*lotQty)),
      updatedAt:new Date(),
    }).where("id","=",journalId).execute();
  }catch{}
}

function timeOf(order:{filledAt:unknown;createdAt:unknown}){
  const t=Date.parse(String(order.filledAt??order.createdAt??""));
  return Number.isFinite(t)?t:0;
}
function asObject(value:unknown):Record<string,unknown>{
  if(typeof value==="string"){try{const p=JSON.parse(value);return p&&typeof p==="object"?p:{};}catch{return {};}}
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function metrics(trades:Array<{realizedR:any;outcome:string|null;createdAt:Date;setup:string|null}>){
  const resolved=trades.map(t=>({...t,r:num(t.realizedR)})).filter(t=>t.r!=null) as Array<typeof trades[number]&{r:number}>;
  const wins=resolved.filter(t=>t.r>0);
  const losses=resolved.filter(t=>t.r<0);
  const sum=resolved.reduce((s,t)=>s+t.r,0);
  const grossWin=wins.reduce((s,t)=>s+t.r,0);
  const grossLoss=Math.abs(losses.reduce((s,t)=>s+t.r,0));
  let streak=0,maxLosingStreak=0;
  for(const t of resolved.sort((a,b)=>+new Date(a.createdAt)-+new Date(b.createdAt))){
    if(t.r<0){streak++;maxLosingStreak=Math.max(maxLosingStreak,streak);}else streak=0;
  }
  return {
    tradeCount:resolved.length,
    wins:wins.length,
    losses:losses.length,
    winRate:resolved.length?wins.length/resolved.length*100:null,
    avgR:resolved.length?sum/resolved.length:null,
    expectancy:resolved.length?sum/resolved.length:null,
    profitFactor:grossLoss>0?grossWin/grossLoss:grossWin>0?999:null,
    avgWinnerR:wins.length?grossWin/wins.length:null,
    avgLoserR:losses.length?losses.reduce((s,t)=>s+t.r,0)/losses.length:null,
    maxLosingStreak,
    confidence:resolved.length>=100?"HIGH":resolved.length>=30?"MEDIUM":"LOW",
  };
}

export async function rebuildLearningForUser(userId:number){
  // Only trades closed through the verified lot ledger count (legacy/unverified rows are
  // status "needs_review" after reconciliation and are excluded automatically).
  const trades=await db.selectFrom("cueTradeJournal")
    .select(["setup","realizedR","outcome","createdAt"])
    .where("userId","=",userId)
    .where("status","=","closed")
    .orderBy("createdAt")
    .execute();

  const groups=new Map<string,typeof trades>();
  groups.set("ALL",trades);
  for(const trade of trades){
    const key=trade.setup||"UNKNOWN";
    const list=groups.get(key)??[];
    list.push(trade);
    groups.set(key,list);
  }

  for(const [setup,list] of groups){
    const m=metrics(list);
    await db.insertInto("cueLearningProfiles").values({
      userId,setup,tradeCount:m.tradeCount,wins:m.wins,losses:m.losses,
      winRate:m.winRate!=null?String(m.winRate):null,
      avgR:m.avgR!=null?String(m.avgR):null,
      expectancy:m.expectancy!=null?String(m.expectancy):null,
      profitFactor:m.profitFactor!=null?String(m.profitFactor):null,
      avgWinnerR:m.avgWinnerR!=null?String(m.avgWinnerR):null,
      avgLoserR:m.avgLoserR!=null?String(m.avgLoserR):null,
      maxLosingStreak:m.maxLosingStreak,
      confidence:m.confidence,
      updatedAt:new Date(),
    }).onConflict(oc=>oc.columns(["userId","setup"]).doUpdateSet({
      tradeCount:m.tradeCount,wins:m.wins,losses:m.losses,
      winRate:m.winRate!=null?String(m.winRate):null,
      avgR:m.avgR!=null?String(m.avgR):null,
      expectancy:m.expectancy!=null?String(m.expectancy):null,
      profitFactor:m.profitFactor!=null?String(m.profitFactor):null,
      avgWinnerR:m.avgWinnerR!=null?String(m.avgWinnerR):null,
      avgLoserR:m.avgLoserR!=null?String(m.avgLoserR):null,
      maxLosingStreak:m.maxLosingStreak,
      confidence:m.confidence,
      updatedAt:new Date(),
    })).execute();
  }
  return metrics(trades);
}
