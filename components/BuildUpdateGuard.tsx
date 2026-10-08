import React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getBuildVersion } from "../endpoints/version_GET.schema";
import { TRADECUE_BUILD_ID } from "../helpers/buildVersion";
import { Button } from "./Button";
import styles from "./BuildUpdateGuard.module.css";

export function BuildUpdateGuard(){
  const query=useQuery({
    queryKey:["tradecue-build-version"],
    queryFn:getBuildVersion,
    staleTime:30_000,
    refetchInterval:60_000,
    refetchIntervalInBackground:true,
    retry:false,
  });
  if(!query.data||query.data.buildId===TRADECUE_BUILD_ID)return null;
  return <div className={styles.banner}>
    <span>New TradeCUE build available: {query.data.buildId}</span>
    <Button size="sm" onClick={()=>window.location.reload()}><RefreshCw size={13}/>Reload now</Button>
  </div>;
}