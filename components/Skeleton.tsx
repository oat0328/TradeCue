import React from "react";

export function Skeleton({className="",style,...props}:React.HTMLAttributes<HTMLDivElement>){
  return <div aria-hidden="true" className={className} style={{background:"color-mix(in srgb, var(--muted-foreground) 12%, transparent)",borderRadius:6,minHeight:12,...style}} {...props}/>;
}
