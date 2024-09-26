import { useEffect, useRef } from "react";
export default (ms) => {
    const timer = useRef(undefined);
    let create = (func, mss) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(func, mss || ms);
    };
    useEffect(() => {
        return () => clearTimeout(timer.current);
    }, []);
    return create;
};
