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

const hidenProps = (instince: any, key: string, value?: any) => {
    // Define _events as a non-enumerable property
    if (value == undefined && key in instince)
        value = instince[key];
    Object.defineProperty(instince, key, {
        value: value,
        enumerable: false, // This hides it from Object.keys()
        configurable: true,
        writable: true
    });
}

function toType<T>(item: any) {
    return item as T
}

function getItem(item: any) {
    if (!item)
        throw "item cannot be undefined or null";
    if (typeof item === "function")
        return getItem(item());
    return item;
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
    if (keys.length === 0) return { AllKeys: true } as Record<string, boolean>;

    return keys.reduce((c, v) => {
        c[v] = true;
        return c;
    }, {} as Record<string, boolean>);
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
export const valid = (item: any, validArray?: boolean) => {
    if (item == undefined || item === null) return false;
    if (item instanceof Set) return false;
    if (item instanceof Map) return false;
    if (typeof item === "function") return false;
    if (typeof item === "string") return false;
    if (validArray && Array.isArray(item) && item.length > 0) {
        return valid(item[0]) as boolean;
    }
    return typeof item === "object";
};

export type NestedKeyOf<
    T extends object,
    D extends any[] = [0, 0, 0, 0, 0]
> = D extends [any, ...infer DD]
    ? {
        [K in keyof T & (string | number)]: T[K] extends object
        ? `${K}` | `${K}.${NestedKeyOf<T[K], DD>}`
        : `${K}`;
    }[keyof T & (string | number)]
    : never;

export type WaitngItem = { key: string, item: any };

export type EventItem = {
    keys: Record<string, boolean>;
    fn?: (item: Record<string, WaitngItem>) => void;
    fs?: (item: Record<string, WaitngItem>) => void;
    item?: any;
};

export class FastList<T> {
    private item: Record<string, T> = {};
    _length = 0;
    _keys?: string[];
    _values?: T[];

    private get clearKeys() {
        this._keys = undefined;
        this._values = undefined;
        return this;
    }

    clear(): this {
        this.item = {};
        this._length = 0;
        return this.clearKeys;
    }

    [Symbol.iterator](): IterableIterator<[string, T]> {
        return Object.entries(this.item)[Symbol.iterator]();
    }

    get hasValue() {
        return this._length > 0;
    }

    get values() {
        return this._values ?? (this._values = Object.values(this.item));
    }

    get keys() {
        return this._keys ?? (this._keys = Object.keys(this.item));
    }

    find(func: (item: T, key: string) => boolean): T | undefined {
        for (let k in this.item) {
            let item = this.item[k];
            if (func(item, k))
                return item;
        }

        return undefined;
    }

    findKey(func: (item: T, key: string) => boolean): string | undefined {
        for (let k in this.item) {
            let item = this.item[k];
            if (func(item, k))
                return k;
        }

        return undefined;
    }


    delete(key: (string)) {
        if (key in this.item) {
            this.clearKeys._length--;
            delete this.item[key];
        }
        return this;
    }

    get(key: string): T | undefined {
        return this.item[key];
    }

    records() {
        return this.item as Record<string, T>;
    }

    record(key: string): Record<string, T> {
        let item: Record<string, T> = {};
        item[key] = this.get(key);
        return item;
    }

    has(key: string) {
        return key in this.item;
    }

    set(key: string, item: T): T {
        if (item == undefined) {
            this.delete(key);
            return item;
        }

        if (!this.has(key))
            this._length++;
        this.item[key] = item;

        return item;
    }
}

type StateType = "Local" | "Global";

export class EventTrigger {
    _events: Record<string, EventItem> = {};
    _timer: any = undefined;
    _waitingEvents: FastList<{ event: EventItem, items: FastList<WaitngItem> }> = new FastList();
    _addedPaths: FastList<string> = new FastList();
    _localBindedEvents: FastList<FastList<Function>> = new FastList();
    speed?: number = 2;
    _stateType: StateType;

    _add(id: string, item: EventItem) {
        this._events[id] = item;
    }

    _remove(id: string) {
        delete this._events[id];
    }

    _hasChange(items: Record<string, WaitngItem>, parentState: Record<string, any>, mappedKeys: Record<string, boolean>) {
        if (parentState == undefined) {
            return {
                hasChanges: true,
                parentState: Object.keys(mappedKeys).reduce((c, v) => {
                    c[v] = items[v]?.item;
                    return c;
                }, {})
            };
        }

        let hasChanges = false;
        for (const { key, item } of Object.values(items)) {
            if (parentState[key] !== item) {
                hasChanges = true;
                parentState[key] = item;
            }
        }

        return { hasChanges, parentState };

    }

    async _trigger(event: { eventId: string, event: EventItem }, key: string, item: any) {
        const { eventId, event: evt } = event;

        const waitingItems = (this._waitingEvents.has(eventId) ? this._waitingEvents.get(eventId) : this._waitingEvents.set(eventId, {
            event: evt,
            items: new FastList()
        })).items;

        waitingItems.set(key, { key, item });

        const runHandlers = (e: EventItem, items: Record<string, WaitngItem>) => {
            e.fn?.(items);
            e.fs?.(items);
        };

        if (this.speed === undefined) {
            runHandlers(evt, waitingItems.records());
            this._waitingEvents.delete(eventId);
            return;
        }

        this._timer = setTimeout(() => {
            const events = this._waitingEvents.values;
            this._waitingEvents.clear();

            for (const { event, items } of events) {
                runHandlers(event, items.records());
            }
        }, this.speed);

    }

    async _onChange(key: string, parentItem: any) {
        try {
            clearTimeout(this._timer); // Proper debouncing
            // if the child of the hooked key is changes, then hook should still trigger if there is a hook for it
            const parts = key.split(".");
            for (const [eventId, event] of Object.entries(this._events)) {
                if (event.keys.AllKeys || event.keys[key]) {
                    this._trigger({ eventId, event }, key, parentItem);
                    continue;
                }

                // Traverse up the key chain: "a.b.c" → "a.b" → "a"
                for (let i = parts.length - 1; i > 0; i--) {
                    const parentKey = parts.slice(0, i).join(".");
                    if (event.keys[parentKey]) {
                        this._trigger({ eventId, event }, key, parentItem);
                        break; // stop at the first match for performance
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}



type IPrivateCreate = {
    getInstanceType(): string;
    getEvent(): EventTrigger;
}





/**
 * ReturnState defines the extended API returned from Create or StateBuilder,
 * providing reactive bindings, event hooks, and integration with React-like effects.
 */
export type ReturnState<T extends object> = {
    /**
     * Registers reactive listeners for the specified keys.
     * Returns a chainable `.on()` to subscribe to changes.
     * 
     * @param keys - Keys to track for changes.
     * @returns An object with an `.on()` method to register a listener.
     */
    hook(...keys: NestedKeyOf<T>[]): {
        /**
         * Subscribes to change events when any of the specified keys change.
         * 
         * @param fn - A function that receives the item and returns a boolean.
         * @returns The current reactive state object (chainable).
         */
        on: (fn: (item: T) => boolean) => ReturnState<T>;
    };

    /**
     * Registers a side effect that re-runs when specified keys change.
     * Works similarly to React's useEffect but for reactive state.
     * 
     * @param fn - The effect function to run on change.
     * @param keys - Keys to track for re-running the effect.
     */
    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]): void;

    /**
     * Binds an event listener to a specific path.
     * The path can be deeply nested (e.g., "user.profile.name").
     * 
     * @param path - The full property path to bind.
     * @param autoUnbind will use react.useffect to unbind the key
     */
    bind(path: string, autoUnbind?: boolean): ReturnState<T>;

    /**
     * Removes a previously bound event listener on the given path.
     * 
     * @param path - The full property path to unbind.
     */
    unbind(path: string): ReturnState<T>;

    /**
     * Binds a local (component-scoped) event listener to a path.
     * Returns a chainable `.on()` to subscribe to it.
     * 
     * @param path - The full property path to bind.
     * @returns An object with `.on()` method for subscribing.
     */
    localBind(path: string): {
        /**
         * Subscribes to the locally scoped event.
         * 
         * @param fn - A function that receives the item and returns a boolean.
         * @returns The current reactive state object (chainable).
         */
        on: (fn: (item: T) => boolean) => ReturnState<T>;
    };
};

export type LocalStateManagment<T extends object> = {
    /** reset the state to its original initiated value */
    resetState(): void;
}


type CreateItem<T extends object> = {
    item: T,
    parent?: any,
    parentItem?: ReturnState<T> & IPrivateCreate,
    ignoreKeys: Record<string, boolean>,
    seen?: WeakMap<any, any>
}

class Create<T extends object> {
    #_events?: EventTrigger;
    hook(...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let mappedKeys = refCondition(() => toObject(...keys)).value
        let [state, setState] = reactState({});
        let hookSettings = refCondition(() => ({ on: undefined as ((item: any) => boolean) | undefined })).value;
        this.#_events._add(id, {
            fn: items => {
                let newState = this.#_events._hasChange(items, state, mappedKeys);
                const update = newState.hasChanges && (!hookSettings.on || hookSettings.on(this));
                if (update)
                    setState({ ...newState.parentState });
            },
            keys: mappedKeys
        });

        reactEffect(() => {
            return () => this.#_events._remove(id);
        }, [])

        return {
            on: (fn: (item) => boolean) => {
                hookSettings.on = fn;
                return this as any;
            }
        }
    }

    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let mappedKeys = refCondition(() => toObject(...keys)).value
        let state = reactRef({});
        this.#_events._add(id, {
            fs: (items) => {
                let newState = this.#_events._hasChange(items, state.current, mappedKeys);
                if (newState.hasChanges)
                    fn(this)
                state.current = newState.parentState;
            },
            keys: mappedKeys
        });

        reactEffect(() => {
            return () => this.#_events._remove(id);
        }, [])
    }

    unbind(path: string, islocal?: boolean) {
        try {
            if (!this.#_events._addedPaths.has(path) && !islocal) return; // not bound, do nothing
            this.#_events._addedPaths.delete(path);
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

        return this;
    }

    localBind(path: string) {
        const [_, setValue] = reactState();
        const id = refCondition(newId).value;
        const hookSettings = refCondition(() => ({ on: undefined as ((item: any) => boolean) | undefined })).value;
        if (!this.#_events._localBindedEvents.has(path)) {
            this.#_events._localBindedEvents.set(path, new FastList<Function>);
            let item = this;
            let key = path.split(".").reverse()[0];
            for (let p of path.split(".")) {
                if (typeof item[p] === "object") {
                    item = item[p];
                } else break;
            }
            if (item) {
                let v = item[key];
                Object.defineProperty(item, key, {
                    enumerable: true,
                    configurable: true,
                    get: () => v,
                    set: (value: any) => {
                        if (value !== v) {
                            v = value;
                            if (!hookSettings.on || hookSettings.on(this))
                                this.#_events._localBindedEvents.get(path)?.values.forEach(func => func(value));

                        }
                    }
                });
            }
        }

        this.#_events._localBindedEvents.get(path)?.set(id, setValue)

        reactEffect(() => {
            return () => {
                this.#_events._localBindedEvents.get(path)?.delete(id);
                if (!(this.#_events._localBindedEvents.get(path)?.hasValue)) {
                    this.#_events._localBindedEvents.delete(path);
                    this.unbind(path, true);
                }
            }
        }, []);

        return {
            on: (fn: (item) => boolean) => {
                hookSettings.on = fn;
                return this as any;
            }
        }
    }


    bind(path: string, autoUnbind?: boolean) {
        if (!this.#_events._addedPaths.has(path)) {
            this.#_events._addedPaths.set(path, path);
            let item = this;
            let key = path.split(".").reverse()[0];
            for (let p of path.split(".")) {
                if (typeof item[p] === "object") {
                    item = item[p];
                } else break;
            }

            if (item) {
                let v = item[key];
                Object.defineProperty(item, key, {
                    enumerable: true,
                    configurable: true,
                    get: () => v,
                    set: (value: any) => {
                        if (value !== v) {
                            v = value;
                            this.#_events._onChange(path, v);
                        }
                    }
                });
            }
        }

        if (autoUnbind) {
            reactEffect(() => {
                () => this.unbind(path);
            }, []);
        }

        return this;
    }

    constructor(item?: CreateItem<T>) {
        if (item)
            this.init(item);
    }

    getEvent() {
        return this.#_events;
    }

    getInstanceType() {
        return "react-smart-state-item";
    }

    private init(data: CreateItem<T>) {

        if (!data.seen)
            data.seen = new WeakMap();
        if (data.parentItem === undefined) {
            data.parentItem = this;
            this.#_events = new EventTrigger();
        }

        let { item, parent, parentItem, ignoreKeys, seen } = data
        let parentKeys = (key: string) => {
            if (parent && parent.length > 0) return `${parent}.${key}`;
            return key;
        };



        const parse = (value: any, parentKey: string) => {
            try {
                if (!ignoreKeys[parentKey] && valid(value, true)) {
                    if (seen.has(value)) {
                        // Cycle detected, return existing instance
                        return seen.get(value);
                    }

                    if (value && valid(value) && (value as IPrivateCreate).getInstanceType?.() == this.getInstanceType())
                        value = Object.assign({}, value) // create a copy

                    if (Array.isArray(value)) {
                        // Parse each array item recursively
                        return value.map((x, i) => parse(x, `${parentKey}.${i}`));
                    } else {
                        // Create a placeholder instance and set it immediately
                        const newInstance = new Create();
                        seen.set(value, newInstance);
                        // Now call the constructor logic on the placeholder instance
                        newInstance.init({ item: value, parent: parentKey, parentItem, ignoreKeys, seen });
                        // Create a new Create instance and store in 'seen' map
                        return newInstance;
                    }
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
                seen.delete(item[k]);
                if (v !== item[k]) item[k] = v;
                Object.defineProperty(this, k, {
                    enumerable: true,
                    configurable: true,
                    get: () => item[k],
                    set: (value: any) => {
                        item[k] = parse(value, parentKey);
                        seen.delete(value);
                        if ((parentKey.includes(".") || k === parentKey) && valid(value)) {
                            let parts = parentKey.split(".");
                            // Traverse up from most specific to least specific (excluding the root level)
                            if (parentItem.getEvent()._addedPaths.hasValue || parentItem.getEvent()._localBindedEvents.hasValue)
                                while (parts.length > 1 || (parts.length > 0 && k == parentKey)) {
                                    parts = parts.slice(0, -1);
                                    const pKey = k == parentKey ? k : parts.join(".");

                                    if (parentItem.getEvent()._addedPaths.hasValue)
                                        parentItem.getEvent()._addedPaths.keys.forEach(addedKey => {
                                            if (addedKey.startsWith(pKey + ".") || addedKey === pKey) {
                                                parentItem.unbind(addedKey);
                                                parentItem.bind(addedKey);
                                            }
                                        });

                                    if (parentItem.getEvent()._localBindedEvents.hasValue)
                                        parentItem.getEvent()._localBindedEvents.keys.forEach((addedKey) => {
                                            if (addedKey.startsWith(pKey + ".") || addedKey === pKey) {
                                                parentItem.getEvent()._localBindedEvents.delete(addedKey);
                                            }
                                        });
                                }
                        }
                        parentItem.getEvent()._onChange(parentKey, item[k]);
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
}

/**
 * StateBuilder is a fluent API to build local or global reactive state
 * using the Create proxy system with support for recursive structures,
 * selective key ignoring, and optional binding with event dispatch control.
 */
class StateBuilder<T extends object> {
    private item: T | (() => T);
    private initilized?: Create<T> & LocalStateManagment<T>;
    private ignoreKeys: string[] = [];
    private bindKeys: string[] = [];
    private localBindKeys: string[] = [];
    private timeoutSpeed?: number = -1;

    /**
     * @param item - The object to wrap in a reactive state, or a function returning it
     */
    constructor(item: T | (() => T)) {
        this.item = item;
    }

    /**
     * Sets the debounce speed (in milliseconds) for event dispatch.
     * Set to `undefined` to disable throttling, or leave `-1` for default behavior.
     * @param speed - Optional timeout in milliseconds.
     */
    timeout(speed?: number) {
        this.timeoutSpeed = speed;
        return this;
    }

    /**
     * Ignores specified nested keys from being proxied/reactive.
     * Useful for skipping large, static, or recursive subtrees to improve performance.
     * @param ignoreKeys - Keys to ignore from proxying
     */
    ignore(...ignoreKeys: NestedKeyOf<T>[]) {
        this.ignoreKeys = ignoreKeys;
        return this;
    }

    /**
     * Rebinds specific nested keys that were previously ignored.
     * Enables listening to changes on those keys manually.
     * @param bindKeys - Keys within ignored objects to still bind to
     */
    bind(...bindKeys: NestedKeyOf<T>[]) {
        this.bindKeys = bindKeys;
        return this;
    }

    /**
     * Like `bind()`, but events are scoped locally (do not trigger global listeners).
     * Useful for isolating state changes in local components.
     * @param bindKeys - Keys to bind with local-only change listeners
     */
    localBind(...bindKeys: NestedKeyOf<T>[]) {
        this.localBindKeys = bindKeys;
        return this;
    }

    /**
     * Builds and returns a local reactive state object that can be used in components.
     * Initializes the state only once, applies bindings, and sets hook context.
     */
    build() {
        const stateItem = refCondition<this>(() => this);
        const update = updater();
        const $this = stateItem.value;

        // Initialize only once
        if ($this.initilized === undefined) {
            $this.initilized = new Create({
                item: getItem($this.item),
                ignoreKeys: toObject(...$this.ignoreKeys)
            }) as any;

            // Apply timeout settings
            $this.initilized.getEvent().speed = $this.timeoutSpeed === -1
                ? undefined
                : $this.timeoutSpeed;

            $this.initilized.getEvent()._stateType = "Local";
        }

        $this.initilized.resetState = () => {
            stateItem.setValue(undefined);
            update();
        }

        // Hook into React render cycle
        $this.initilized.hook();

        // Rebind specified keys
        for (let key of $this.bindKeys) {
            $this.initilized.bind(key);
        }

        // Rebind keys locally
        for (let key of $this.localBindKeys) {
            $this.initilized.localBind(key);
        }

        return $this.initilized as any as ReturnState<T> & LocalStateManagment<T> & T;
    }

    /**
     * Builds and returns a global reactive state object.
     * This does not hook into React, so it’s suitable for shared/global stores.
     */
    globalBuild() {
        if (this.initilized === undefined) {
            this.initilized = new Create({
                item: getItem(this.item),
                ignoreKeys: toObject(...this.ignoreKeys)
            }) as any;

            // Use default timeout unless explicitly set
            this.initilized.getEvent().speed = this.timeoutSpeed === -1
                ? 2
                : this.timeoutSpeed;
            this.initilized.getEvent()._stateType = "Global";
        }

        return this.initilized as any as ReturnState<T> & T;
    }
}


const StateManagment = <T extends object>(item: T | (() => T)) => {
    return new StateBuilder<T>(item);
};

export default StateManagment;
