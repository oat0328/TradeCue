import {useEffect,useState} from "react";
export function useDebounce<T>(value:T,delayMs=400):T{
  const [debounced,setDebounced]=useState(value);
  useEffect(()=>{
    const timer=setTimeout(()=>setDebounced(value),Math.max(0,delayMs));
    return ()=>clearTimeout(timer);
  },[value,delayMs]);
  return debounced;
}
