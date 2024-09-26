import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const refeObject = useRef as any;
const reactState = useState as any;
//const reactEffect = useEffect as any;
function newId() {
    return uuidv4();
}

const toObject = (...keys: string[]) => {
    if (keys.length === 0) return { AllKeys: true };

    return keys.reduce((c, v) => {
        c[v] = true;
        return c;
    }, {} as any);
};

function getPrototypeChain(obj) {
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

const keys = (item: any) => {
    let prototypes = getPrototypeChain(item);

    let ks = [
        ...Object.keys(item),
        ...prototypes.flatMap(x => Object.getOwnPropertyNames(x))
    ];
    let obp = Object.getOwnPropertyNames(Object.prototype);

    let cbp = Object.getOwnPropertyNames(Create.prototype);

    ks = ks
        .filter(x => !obp.includes(x) && !cbp.includes(x))
        .filter((value, index, array) => array.indexOf(value) === index);
    // alert(JSON.stringify(ks, undefined, 4));
    return ks;
};
/*
const getValueByPath = (value: any, path: string) => {
    let current = value;
    for (let item of path.split(".")) {
        current = current[item];
    }

    return current;
};
*/
const valid = (item: any, validArray?: boolean) => {
    if (!item || item === null) return false;
    if (item instanceof Set) return false;
    if (item instanceof Map) return false;
    if (typeof item === "function") return false;
    if (typeof item === "string") return false;
    if (validArray && Array.isArray(item) && item.length > 0) {
        return valid(item[0]) as boolean;
    }
    return typeof item === "object";
};

type NestedKeyOf<
    T extends object,
    D extends any[] = [0, 0, 0, 0, 0]
> = D extends [any, ...infer DD]
    ? {
          [K in keyof T & (string | number)]: T[K] extends object
              ? `${K}` | `${K}.${NestedKeyOf<T[K], DD>}`
              : `${K}`;
      }[keyof T & (string | number)]
    : never;

type EventItem = {
    keys: any;
    fn?: Function;
    fs?: Function;
    item?: any;
};

class EventTrigger {
    ___events: any = {};
    ___timer: any = undefined;
    ___waitingEvents: any = {};
    ___addedPaths: string[] = [];
    speed?: number = 2;

    add(id: string, item: EventItem) {
        this.___events[id] = item;
    }

    remove(id: string) {
        delete this.___events[id];
    }

    async ___onChange(key: string, parentItem: any) {
        try {
            clearTimeout(this.___timer);
            let global = key
                .split(".")
                .reverse()
                .filter((x, i) => i > 0)
                .join(".");
            for (let item in this.___events) {
                if (
                    this.___events[item].keys.AllKeys ||
                    this.___events[item].keys[key] ||
                    this.___events[item].keys[global]
                ) {
                    if (this.___events[item].fs === undefined) {
                        if (!this.___waitingEvents[item]) {
                            this.___waitingEvents[item] = {
                                event: this.___events[item],
                                items: new Map()
                            };
                        }
                        this.___waitingEvents[item].items.set(key, {
                            key: key,
                            item: parentItem
                        });
                    } else this.___events[item].fs();
                }
            }

            const trigger = () => {
                let items = { ...this.___waitingEvents };
                this.___waitingEvents = {};
                for (let item in items) {
                    items[item].event.fn(items[item].items);
                }
            };
            if (this.speed !== undefined) {
                this.___timer = setTimeout(() => trigger(), this.speed);
            } else trigger();
        } catch (e) {
            console.error(e);
        }
    }
}

abstract class ICreate {
    abstract ___events: EventTrigger;
}

type ReturnState<T extends object> = {
    hook(...keys: NestedKeyOf<T>[]): void;
    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]): void;
    bind(path: string): void;
};
class Create<T extends object> extends ICreate {
    ___events: EventTrigger = new EventTrigger();

    hook(...keys: NestedKeyOf<T>[]) {
        let id = refeObject(newId()).current;
        let ks = refeObject();
        if (!ks.current) ks.current = toObject(...keys);
        let [update, setUpdate] = reactState();
        this.___events.add(id, {
            fn: items => {
                if (!update) {
                    setUpdate(
                        Object.keys(ks.current).reduce((c, v) => {
                            c[v] = items.get(v)?.item;
                            return c;
                        }, {})
                    );
                } else {
                    let a = { ...update };
                    let refresh = false;
                    for (let item of [...items.values()]) {
                        if (a[item.key] !== item.item) {
                            refresh = true;
                            a[item.key] = item.item;
                        }
                    }
                    if (refresh) {
                        setUpdate(a);
                    }
                }
            },
            keys: ks.current
        });
    }

    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]) {
        let id = refeObject(newId()).current;
        let ks = refeObject();
        if (!ks.current) ks.current = toObject(...keys);
        this.___events.add(id, {
            fs: () => fn(this),
            keys: ks.current
        });
    }

    bind(path: string) {
        if (this.___events.___addedPaths.includes(path)) return;
        this.___events.___addedPaths.push(path);
        let item = this;
        let key = path.split(".").reverse()[0];
        for (let p of path.split(".")) {
            if (typeof item[p] === "object") {
                item = item[p];
            } else break;
        }
        let v = item[key];
        Object.defineProperty(item, key, {
            enumerable: true,
            configurable: true,
            get: () => v,
            set: (value: any) => {
                if (value !== v) {
                    v = value;
                    this.___events.___onChange(path, v);
                }
            }
        });
    }

    constructor(item: any, parent: any, parentItem: any, ignoreKeys: any) {
        super();
        if (parentItem === undefined) {
            parentItem = this;
        } else delete this.___events;
        let parentKeys = (key: string) => {
            if (parent && parent.length > 0) return `${parent}.${key}`;
            return key;
        };

        const parse = (value: any, parentKey: string) => {
            try {
                let paths = [...parentItem.___events.___addedPaths];
                for (let pth of paths) {
                    for (let ks of parentKey.split(".")) {
                        if (pth.indexOf(ks + ".") !== -1) {
                            parentItem.___events.___addedPaths =
                                parentItem.___events.___addedPaths.filter(
                                    x => x !== pth
                                );
                        }
                    }
                }
                if (
                    !ignoreKeys[parentKey] &&
                    valid(value) &&
                    !Array.isArray(value)
                ) {
                    return new Create(value, parentKey, parentItem, ignoreKeys);
                } else if (
                    !ignoreKeys[parentKey] &&
                    value &&
                    Array.isArray(value) &&
                    value.length > 0
                ) {
                    return value.map(x => {
                        if (valid(x)) {
                            return new Create(
                                x,
                                parentKey,
                                parentItem,
                                ignoreKeys
                            );
                        } else return x;
                    });
                }
            } catch (e) {
                console.error(e);
            }
            return value;
        };
        try {
            for (let k of keys(item)) {
                let parentKey = parentKeys(k);
                let v = parse(item[k], parentKey);
                if (v !== item[k]) item[k] = v;
                Object.defineProperty(this, k, {
                    enumerable: true,
                    configurable: true,
                    get: () => item[k],
                    set: (value: any) => {
                        item[k] = parse(value, parentKey);
                        parentItem.___events.___onChange(parentKey, item[k]);
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
}

class StateBuilder<T extends object> {
    item: any;
    initilized?: Create<T>;
    ignoreKeys: string[] = [];
    bindKeys: string[] = [];
    timeoutSpeed?: number = 2;
    constructor(item: any) {
        this.item = item;
    }

    /*
      disable settimeout by giving undefined value or specify a number in ms
    */
    timeout(speed?: number) {
        this.timeoutSpeed = speed;
        return this;
    }

    /*
    Ignore props from proxy
    this is usefull when you have a big or recrusive object, those could be ignored as it may slow down the application
    */
    ignore(...ignoreKeys: NestedKeyOf<T>[]) {
        for (let key of ignoreKeys) this.ignoreKeys.push(key);

        return this;
    }

    /*
    bind prop in ignored object
    */
    bind(...bindKeys: NestedKeyOf<T>[]) {
        for (let key of bindKeys) this.bindKeys.push(key);

        return this;
    }

    /*
    build the local state
    */
    build() {
        let refItem = refeObject();
        if (refItem.current === undefined) {
            refItem.current = this;
        }
        const $this = refItem.current;
        if ($this.initilized === undefined) {
            $this.initilized = new Create(
                $this.item,
                undefined,
                undefined,
                toObject(...$this.ignoreKeys)
            ) as any;
            $this.initilized.___events.speed = $this.timeoutSpeed;
        }

        $this.initilized.hook();

        for (let key of $this.bindKeys) {
            $this.initilized.bind(key);
        }

        return $this.initilized as any as ReturnState<T> & T;
    }

    /*
     build the global state
    */
    globalBuild() {
        if (this.initilized === undefined) {
            this.initilized = new Create(
                this.item,
                undefined,
                undefined,
                toObject(...this.ignoreKeys)
            ) as any;
        }

        return this.initilized as any as ReturnState<T> & T;
    }
}

const StateInit = <T extends object>(item: T) => {
    return new StateBuilder<T>(item);
};

export default StateInit;
