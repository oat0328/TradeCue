import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";

export async function handle(request:Request){
  try{
    await apiUser(request,true);
    const [users,memberships,brokers,paperCredentials,sessions,audit]=await Promise.all([
      db.selectFrom("users").select(["id","displayName","email","role","createdAt","updatedAt"]).orderBy("createdAt","desc").limit(500).execute(),
      db.selectFrom("userMemberships").select(["userId","tier","status","trialEndsAt","currentPeriodEndsAt","updatedAt"]).orderBy("updatedAt","desc").execute(),
      db.selectFrom("brokerConnections").select(["userId","provider","status","isPaper","accountMask","lastSyncedAt"]).where("provider","=","webull").execute(),
      db.selectFrom("webullCredentials").select(["userId","verifiedAt"]).execute(),
      db.selectFrom("sessions").select(["userId","lastAccessed","createdAt"]).orderBy("lastAccessed","desc").execute(),
      db.selectFrom("cueAuditLog").select(["userId","action","createdAt"]).where("userId","is not",null).orderBy("createdAt","desc").limit(2000).execute(),
    ]);
    const membershipByUser=new Map<number,typeof memberships[number]>();
    for(const row of memberships)if(!membershipByUser.has(row.userId))membershipByUser.set(row.userId,row);
    const sessionByUser=new Map<number,Date|null>();
    for(const row of sessions)if(!sessionByUser.has(row.userId))sessionByUser.set(row.userId,row.lastAccessed??row.createdAt??null);
    const auditByUser=new Map<number,{action:string;createdAt:Date}>();
    for(const row of audit)if(row.userId!=null&&!auditByUser.has(row.userId))auditByUser.set(row.userId,{action:row.action,createdAt:row.createdAt});
    const brokerByUser=new Map<number,{paper:boolean;live:boolean;paperMask:string|null;liveMask:string|null}>();
    for(const row of brokers){
      const current=brokerByUser.get(row.userId)??{paper:false,live:false,paperMask:null,liveMask:null};
      if(row.status==="connected"){
        if(row.isPaper){current.paper=true;current.paperMask=row.accountMask??current.paperMask;}
        else{current.live=true;current.liveMask=row.accountMask??current.liveMask;}
      }
      brokerByUser.set(row.userId,current);
    }
    for(const row of paperCredentials){
      const current=brokerByUser.get(row.userId)??{paper:false,live:false,paperMask:null,liveMask:null};
      current.paper=true;
      brokerByUser.set(row.userId,current);
    }
    return apiJson({members:users.map(user=>{
      const m=membershipByUser.get(user.id);
      const b=brokerByUser.get(user.id);
      const ownerPaper=user.role==="admin"&&Boolean(process.env.WEBULL_APP_KEY&&process.env.WEBULL_APP_SECRET);
      const lastAudit=auditByUser.get(user.id);
      const session=sessionByUser.get(user.id)??null;
      const lastSeen=[session,lastAudit?.createdAt??null,user.updatedAt??null].filter(Boolean).sort((a:any,b:any)=>+new Date(b)-+new Date(a))[0]??null;
      return {
        id:user.id,displayName:user.displayName,email:user.email,role:user.role,
        registeredAt:user.createdAt??null,updatedAt:user.updatedAt??null,
        tier:m?.tier??null,status:m?.status??null,trialEndsAt:m?.trialEndsAt??null,currentPeriodEndsAt:m?.currentPeriodEndsAt??null,
        paperWebull:(b?.paper??false)||ownerPaper,liveWebull:b?.live??false,paperMask:b?.paperMask??null,liveMask:b?.liveMask??null,
        lastSeen,lastAction:lastAudit?.action??null,
      };
    })});
  }catch(e){return apiFailure(e);}
}
