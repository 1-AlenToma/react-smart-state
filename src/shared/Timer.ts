import { useEffect, useRef } from "react";

export default (ms: number) => {
  const timer = useRef<any>(undefined);

  let create = (func: Function, mss?: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(func, mss || ms);
  };
  
  useEffect(()=>{
    return ()=> clearTimeout(timer.current);
  },[])
  
  return create;
};
