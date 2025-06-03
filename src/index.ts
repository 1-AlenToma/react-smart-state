import { getItem, getValueByPath, keys, newId, reactEffect, reactRef, reactState, refCondition, toObject, updater, valid } from "./methods";
import { EventTrigger, FastList } from "./objects";
import { CreateItem, IEventTrigger, IPrivateCreate, LocalStateManagment, NestedKeyOf, ReturnState } from "./types";
export * from "./methods";
export * from "./types";
export * from "./objects";

class Create<T extends object> {
    #events?: IEventTrigger;
    async batch(func: (() => void | Promise<void>)) {
        const batching = this.getEvent().batching;
        const index = batching.size;
        const enable = () => {
            batching.delete(index);
            this.getEvent().triggerSavedChanges();
        };
        batching.set(index, func);
        try {
            await func();
        } catch (e) {
            console.error(e);
        } finally {
            enable();
        }
    }

    hook(...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let mappedKeys = refCondition(() => toObject(...keys)).value
        let [state, setState] = reactState({});
        let hookSettings = refCondition(() => ({ on: undefined as ((item: any) => boolean) | undefined })).value;
        this.getEvent().add(id, {
            func: items => {
                let newState = this.getEvent().hasChange(items, state);
                const update = newState.hasChanges && (!hookSettings.on || hookSettings.on(this));
                if (update)
                    setState({ ...newState.parentState });
            },
            keys: mappedKeys
        });

        reactEffect(() => {
            return () => this.getEvent().remove(id);
        }, [])

        return {
            on: (fn: (item) => boolean) => {
                hookSettings.on = fn;
                return this as any;
            }
        }
    }

    useComputed<B>(fn: (item: T, currentValue?: T) => B, ...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let mappedKeys = refCondition(() => toObject(...keys)).value
        let [state, setState] = reactState(fn(this as any, undefined));

        this.getEvent().add(id, {
            func: () => {
                let newValue = fn(this as any, state);
                if (newValue !== state)
                    setState(newValue);
            },
            keys: mappedKeys
        });

        reactEffect(() => {
            return () => this.getEvent().remove(id);
        }, [])

        return state as B;
    }

    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]) {
        let id = refCondition<string>(newId).value;
        let mappedKeys = refCondition(() => toObject(...keys)).value
        let state = reactRef({});
        this.getEvent().add(id, {
            func: (items) => {
                let newState = this.getEvent().hasChange(items, state.current);
                if (newState.hasChanges)
                    fn(this)
                state.current = newState.parentState;
            },
            keys: mappedKeys
        });

        reactEffect(() => {
            return () => this.getEvent().remove(id);
        }, [])
    }

    unbind(path: string) {
        try {
            if (!this.getEvent().addedPaths.has(path)) return; // not bound, do nothing
            this.getEvent().addedPaths.delete(path);
            let item = this;
            let key = path.split(".").reverse()[0];
            for (let p of path.split(".")) {
                if (item[p] !== null && typeof item[p] === "object") {
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
        const [state, setState] = reactState();
        const id = refCondition(newId).value;
        const hookSettings = refCondition(() => ({ on: undefined as ((item: any) => boolean) | undefined })).value;
        const mappedKeys = refCondition(() => toObject(path)).value;
        if (!this.getEvent().localBindedEvents.has(path)) {
            this.getEvent().localBindedEvents.set(path, new FastList<boolean>());
            this.bind(path);
        }
        this.getEvent().localBindedEvents.get(path).set(id, true);
        this.getEvent().add(id, {
            func: (items) => {
                let newState = this.getEvent().hasChange(items, state);
                const update = newState.hasChanges && (!hookSettings.on || hookSettings.on(this));
                if (update)
                    setState({ ...newState.parentState });
            },
            keys: mappedKeys,
            type: "Path"
        });

        reactEffect(() => {
            return () => {
                this.getEvent().remove(id);
                this.getEvent().localBindedEvents.get(path)?.delete(id)
                if (!this.getEvent().localBindedEvents.get(path)?.hasValue) {
                    this.getEvent().localBindedEvents.delete(path);
                    this.unbind(path);
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


    bind(path: string, autoUnbind?: boolean, rebind?: boolean) {
        if (!this.getEvent().addedPaths.has(path) || rebind) {
            this.getEvent().addedPaths.set(path, path);
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
                        let newValue = { oldValue: v, newValue: value };
                        if (value !== v) {
                            v = value;
                            this.getEvent().onChange(path, newValue);
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
        return this.#events;
    }

    getInstanceType() {
        return "react-smart-state-item";
    }

    private init(data: CreateItem<T>) {

        if (!data.seen)
            data.seen = new WeakMap();
        if (data.parentItem === undefined) {
            data.parentItem = this;
            this.#events = new EventTrigger();
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

                    if (value && valid(value) && (value as IPrivateCreate<T>).getInstanceType?.() == this.getInstanceType())
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
            for (let k of keys(item, Create.prototype)) {
                let parentKey = parentKeys(k);
                let v = parse(item[k], parentKey);
                seen.delete(item[k]);
                if (v !== item[k]) item[k] = v;
                Object.defineProperty(this, k, {
                    enumerable: true,
                    configurable: true,
                    get: () => item[k],
                    set: (value: any) => {
                        const newValue = { oldValue: item[k], newValue: parse(value, parentKey) };
                        item[k] = newValue.newValue;
                        seen.delete(value);
                        if ((parentKey.includes(".") || k === parentKey) && valid(value)) {
                            let parts = parentKey.split(".");
                            // Traverse up from most specific to least specific (excluding the root level)
                            if (parentItem.getEvent().addedPaths.hasValue || parentItem.getEvent().localBindedEvents.hasValue)
                                while (parts.length > 1 || (parts.length > 0 && k == parentKey)) {
                                    parts = parts.slice(0, -1);
                                    const pKey = k == parentKey ? k : parts.join(".");

                                    if (parentItem.getEvent().addedPaths.hasValue)
                                        parentItem.getEvent().addedPaths.keys.forEach(addedKey => {
                                            if (addedKey.startsWith(pKey + ".") || addedKey === pKey) {
                                                parentItem.bind(addedKey, false, true);
                                            }
                                        });
                                }
                        }
                        parentItem.getEvent().onChange(parentKey, newValue);
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
    private onStateInit?: (item: T) => Promise<void>;

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
     * Registers an asynchronous initialization function that will be called 
     * when the state is first created or initialized.
     *
     * Useful for performing setup logic such as loading data, setting defaults, or
     * triggering side effects after the state is ready.
     *
     * @param func - An async function that receives the initial state and performs setup.
     * @returns The current instance (for chaining).
     */
    onInit(func: (state: T) => Promise<void>) {
        this.onStateInit = func;
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

            $this.initilized.getEvent().stateType = "Local";

        }

        reactEffect(() => {
            if ($this.onStateInit)
                $this.onStateInit($this.initilized as any as T);
        }, [update.value])

        $this.initilized.resetState = () => {
            stateItem.setValue(undefined);
            update.refresh();
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
            this.initilized.getEvent().stateType = "Global";
            if (this.onStateInit)
                this.onStateInit(this.initilized as any as T);
        }

        return this.initilized as any as ReturnState<T> & T;
    }
}


const StateManagment = <T extends object>(item: T | (() => T)) => {
    return new StateBuilder<T>(item);
};

export default StateManagment;
