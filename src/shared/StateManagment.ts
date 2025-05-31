import * as React from "react";
import { useRef, useState, useEffect } from "react";


const reactEffect = useEffect as any;
const reactRef = useRef as any;
const reactState = useState as any;
function updater(): () => void {
    const [, setValue] = reactState(0);

    return () => {
        setValue(prev => (prev < 1000 ? prev + 1 : 1));
    };
}
function refCondition<T>(fn: () => T) {
    const ref = reactRef(undefined);
    if (ref.current == undefined)
        ref.current = fn();

    return { value: ref.current as T, setValue: (value: T) => ref.current = value };
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
    ids.set(id, id);
    return id;
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
    _events: any = {};
    _timer: any = undefined;
    _waitingEvents: any = {};
    _addedPaths: string[] = [];
    speed?: number = 2;

    _add(id: string, item: EventItem) {
        this._events[id] = item;
    }

    _remove(id: string) {
        delete this._events[id];
    }

    async _onChange(key: string, parentItem: any) {
        try {
            clearTimeout(this._timer);
            let global = key
                .split(".")
                .reverse()
                .filter((x, i) => i > 0)
                .join(".");
            for (let item in this._events) {
                let eventItem = this._events[item];
                if (
                    eventItem.keys.AllKeys ||
                    eventItem.keys[key] ||
                    eventItem.keys[global]
                ) {
                    if (eventItem.fs === undefined) {
                        let waitingItems = (this._waitingEvents[item] ?? (this._waitingEvents[item] = {
                            event: eventItem,
                            items: new Map()
                        })).items;

                        waitingItems.set(key, {
                            key: key,
                            item: parentItem
                        });
                    } else eventItem.fs();
                }
            }

            const trigger = () => {
                let items = { ...this._waitingEvents };
                this._waitingEvents = {};
                for (let item in items) {
                    items[item].event.fn(items[item].items);
                }
            };
            if (this.speed !== undefined) {
                this._timer = setTimeout(() => trigger(), this.speed);
            } else trigger();
        } catch (e) {
            console.error(e);
        }
    }
}

abstract class ICreate {
    abstract _events: EventTrigger;
}

type ReturnState<T extends object> = {
    hook(...keys: NestedKeyOf<T>[]): void;
    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]): void;
    bind(path: string): void;
    unbind(path: string): void;
    localBind(path: string): void;
};
class Create<T extends object> extends ICreate {
    _events: EventTrigger = new EventTrigger();

    hook(...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let keysObject = refCondition(() => toObject(...keys)).value
        let [update, setUpdate] = reactState();
        this._events._add(id, {
            fn: items => {
                if (!update) {
                    setUpdate(
                        Object.keys(keysObject).reduce((c, v) => {
                            c[v] = items.get(v)?.item;
                            return c;
                        }, {})
                    );
                } else {
                    const updatedState = { ...update };
                    let hasChanges = false;

                    for (const { key, item } of items.values()) {
                        if (updatedState[key] !== item) {
                            hasChanges = true;
                            updatedState[key] = item;
                        }
                    }
                    if (hasChanges) {
                        setUpdate(updatedState);
                    }
                }
            },
            keys: keysObject
        });

        reactEffect(() => {
            return () => this._events._remove(id);
        }, [])
    }

    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let keysObject = refCondition(() => toObject(...keys)).value;
        this._events._add(id, {
            fs: () => fn(this),
            keys: keysObject
        });

        reactEffect(() => {
            return () => this._events._remove(id);
        }, [])
    }

    unbind(path: string, islocal?: boolean) {
        try {
            const index = this._events._addedPaths.indexOf(path);
            if (index === -1 && !islocal) return; // not bound, do nothing
            if (index !== -1)
                this._events._addedPaths.splice(index, 1);
            let item = this;
            let key = path.split(".").reverse()[0];
            for (let p of path.split(".")) {
                if (typeof item[p] === "object") {
                    item = item[p];
                } else break;
            }
            if (item) {
                let v = item[key];
                delete item[key];
                item[key] = v;
            }


        } catch (e) {
            console.warn("was unable to unbind ", path, e)
        }
    }

    localBind(path: string) {
        const update = updater();
        const init = reactRef(false);
        if (!init.current) {
            init.current = true;
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
                        update();
                    }
                }
            });
        }

        reactEffect(() => {
            return () => {
                this.unbind(path, true);
            }
        }, [])
    }


    bind(path: string) {
        if (!this._events._addedPaths.includes(path)) {
            this._events._addedPaths.push(path);
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
                        this._events._onChange(path, v);
                    }
                }
            });
        }
    }

    constructor(item: any, parent: any, parentItem: any, ignoreKeys: any) {
        super();
        if (parentItem === undefined) {
            parentItem = this;
        } else delete this._events;
        let parentKeys = (key: string) => {
            if (parent && parent.length > 0) return `${parent}.${key}`;
            return key;
        };

        const parse = (value: any, parentKey: string) => {
            try {
                let paths = [...parentItem._events._addedPaths];
                for (let pth of paths) {
                    for (let ks of parentKey.split(".")) {
                        if (pth.indexOf(ks + ".") !== -1) {
                            parentItem._events._addedPaths =
                                parentItem._events._addedPaths.filter(
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
                        parentItem._events._onChange(parentKey, item[k]);
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
    localBindKeys: string[] = [];
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
        for (let key of ignoreKeys)
            if (!this.ignoreKeys.includes(key))
                this.ignoreKeys.push(key);

        return this;
    }

    /*
    bind prop in ignored object
    */
    bind(...bindKeys: NestedKeyOf<T>[]) {
        for (let key of bindKeys)
            if (!this.bindKeys.includes(key))
                this.bindKeys.push(key);

        return this;
    }

    /*
    localbind prop in ignored object
    */
    localBind(...bindKeys: NestedKeyOf<T>[]) {
        for (let key of bindKeys)
            if (!this.localBindKeys.includes(key))
                this.localBindKeys.push(key);

        return this;
    }

    /*
    build the local state
    */
    build() {
        const $this = refCondition<this>(() => this).value;
        if ($this.initilized === undefined) {
            $this.initilized = new Create(
                $this.item,
                undefined,
                undefined,
                toObject(...$this.ignoreKeys)
            ) as any;
            $this.initilized._events.speed = $this.timeoutSpeed;
        }

        $this.initilized.hook();

        for (let key of $this.bindKeys) {
            $this.initilized.bind(key);
        }

        for (let key of $this.localBindKeys) {
            $this.initilized.localBind(key);
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
