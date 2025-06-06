import { useRef, useState, useEffect } from "react";
import { ReactSmartStateInstanceItems, StateKeyTypeGenerator } from "./types";
import { CustomError } from "./objects";
export const reactEffect = useEffect as any;
export const reactRef = useRef as any;
export const reactState = useState as any;
export function updater() {
    const [value, setValue] = reactState(0);

    return ({
        value,
        refresh: () => {
            setValue(prev => (prev < 1000 ? prev + 1 : 1));
        }
    });
}

export function SmartStateError(
    err: unknown,
    extraInfo?: { code?: string; details?: any }
): CustomError {
    const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';

    const item = new CustomError(message, {
        originalError: err,
        code: extraInfo?.code,
        details: extraInfo?.details,
    });
    console.error(item);
    return item;
}

export const clone = (o: any) => {
    if (!valid(o, true))
        return o;
    let item: ReactSmartStateInstanceItems = o;
    if (item.getInstanceType?.() === "react-smart-state-item")
        return { ...item };
    if (item.getInstanceType?.() === "react-smart-state-array")
        return [...o];
    return o;
}

export const isSame = (a, b) => {
    if (valid(a, true) && valid(b, true)) {
        return a === b;
    }
    return false;
}

let ids = new Map();
let lastDate = new Date();
export const newId = (inc?: string): string => {
    if ((Date.now() - lastDate.getTime()) > 60 * 1000) {
        ids = new Map();
        lastDate = new Date();
    }
    let id = (inc ?? "") + Date.now().toString(36) + Math.floor(1e12 + Math.random() * 9e12).toString(36);

    if (ids.has(id)) {
        // Retry without prefix to avoid exponential growth
        return newId();
    }

    if (ids.size >= 1000)
        ids.clear();
    ids.set(id, id);
    return id;
}


export function isPromise(obj: any): obj is Promise<any> {
    return !!obj && typeof obj.then === 'function';
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getItem(item: any) {
    if (!item)
        throw "item cannot be undefined or null";
    if (typeof item === "function")
        return getItem(item());
    return item;
}


export function refCondition<T>(fn: () => T) {
    const ref = reactRef(undefined);
    if (ref.current == undefined)
        ref.current = fn();

    return { value: ref.current as T, setValue: (value: T) => ref.current = value };
}


export const toObject = (...keys: string[]) => {
    if (keys.length === 0) return { AllKeys: true, _keys: keys } as any as StateKeyTypeGenerator;

    return keys.reduce((c, v) => {
        c[v] = true;
        return c;
    }, { _keys: keys } as any as StateKeyTypeGenerator);
};

export function getPrototypeChain(obj) {
    let prototypeChain = [];
    (function innerRecursiveFunction(obj) {
        let currentPrototype = obj != null ? Object.getPrototypeOf(obj) : null;
        prototypeChain.push(currentPrototype);
        if (currentPrototype != null) {
            innerRecursiveFunction(currentPrototype);
        }
    })(obj);
    return prototypeChain.filter(x => x !== null);
}

export const keys = (item: any, prototype: any) => {
    let prototypes = getPrototypeChain(item);

    let ks = [
        ...Object.keys(item),
        ...prototypes.flatMap(x => Object.getOwnPropertyNames(x))
    ];
    let obp = Object.getOwnPropertyNames(Object.prototype);

    let cbp = Object.getOwnPropertyNames(prototype);

    ks = ks
        .filter(x => !obp.includes(x) && !cbp.includes(x))
        .filter((value, index, array) => array.indexOf(value) === index);
    // alert(JSON.stringify(ks, undefined, 4));
    return ks;
};

export const getValueByPath = (value: any, path: string) => {
    if (!path) return value;
    const segments = path.split(".");

    let current = value;
    for (const key of segments) {
        if (current == null || current == undefined) return undefined; // handles null and undefined
        current = current[key];
    }

    return current;
};

export const isArray = (item: any) => {
    if (item == undefined || item === null) return false;
    if (Array.isArray(item) || (item as ReactSmartStateInstanceItems).getInstanceType?.() === "react-smart-state-array")
        return true;

    return false;
}

export const valid = (item: any, validArray?: boolean) => {
    if (item === undefined || item === null) return false;

    if (typeof item === "string") return false;
    if (typeof item === "function") return false;
    if (item instanceof Set) return false;
    if (item instanceof Map) return false;
    if (item instanceof WeakSet) return false;
    if (item instanceof WeakMap) return false;
    if (item instanceof Date) return false;
    if (item instanceof RegExp) return false;
    if (item instanceof ArrayBuffer) return false;
    if (ArrayBuffer.isView(item)) return false; // covers Uint8Array, Float32Array, etc.
    if (item instanceof Promise) return false;
    if (isArray(item) && item.length > 0) {
        if (validArray)
            return valid(item[0], validArray) as boolean;
        return false;
    }
    return typeof item === "object";
};
