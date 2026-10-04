import { useEffect, useRef } from "react";

export function useScrollReveal<T extends HTMLElement=HTMLElement>(){
  const ref=useRef<T|null>(null);
  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    if(typeof IntersectionObserver==="undefined"){
      node.classList.add("is-visible");
      return;
    }
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          (entry.target as HTMLElement).classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },{threshold:.12});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[]);
  return ref;
}
