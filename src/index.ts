import { clone, getItem, getValueByPath, isArray, isSame, keys, newId, reactEffect, reactRef, reactState, refCondition, SmartStateError, toObject, updater, valid } from "./methods";
import { EventTrigger, FastList, ObservableArray } from "./objects";
import { CreateItem, IEventTrigger, LocalStateManagment, NestedKeyOf, ReturnState, SmartStateInstanceNames } from "./types";
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
            SmartStateError(e, { code: "batch", details: func });
        } finally {
            enable();
        }
    }

    hook(...keys: NestedKeyOf<T>[]) {
        try {
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
        } catch (e) {
            throw SmartStateError(e, { code: "hook", details: keys });
        }
    }

    useComputed<B>(fn: (item: T, currentValue?: T) => B, ...keys: NestedKeyOf<T>[]) {
        try {
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
        } catch (e) {
            throw SmartStateError(e, { code: "useComputed", details: keys });
        }
    }

    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]) {
        try {
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
        } catch (e) {
            throw SmartStateError(e, { code: "useEffect", details: keys });
        }
    }

    unbind(path: NestedKeyOf<T>) {
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
            if (item && !isArray(item) && valid(item)) {
                let v = item[key];
                delete item[key];
                item[key] = v;
            }


        } catch (e) {
            throw SmartStateError(e, { code: "unbind", details: path });
        }

        return this;
    }

    localBind(path: NestedKeyOf<T>) {
        try {
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
        } catch (e) {
            throw SmartStateError(e, { code: "localBind", details: path });
        }
    }


    bind(path: NestedKeyOf<T>, autoUnbind?: boolean, rebind?: boolean) {
        try {
            if (!this.getEvent().addedPaths.has(path) || rebind) {
                this.getEvent().addedPaths.set(path, path);
                let item = this;
                let key = path.split(".").reverse()[0];
                for (let p of path.split(".")) {
                    if (typeof item[p] === "object") {
                        item = item[p];
                    } else break;
                }

                if (item && !isArray(item) && valid(item)) {
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
        } catch (e) {
            throw SmartStateError(e, { code: "bind", details: path });
        }
        return this;
    }

    constructor(item?: CreateItem<T>) {
        if (item)
            this.initializeStateItem(item);
    }

    getEvent() {
        return this.#events;
    }

    getInstanceType(): SmartStateInstanceNames {
        return "react-smart-state-item";
    }

    private initializeStateItem(data: CreateItem<any>) {
        try {
            if (data.parentItem === undefined) {
                data.parentItem = this;
                this.#events = new EventTrigger(data.ignoreKeys, data.hardIgnoreKeys);
            }

            let { item, parent, parentItem, arrayParser } = data;
            let { ignoreKeys, hardIgnoreKeys } = parentItem.getEvent();
            let parentKeys = (key: string) => {
                if (parent && parent.length > 0) return `${parent}.${key}`;
                return key;
            };

            const parse = (val: any, parentKey: string) => {
                try {
                    const cache = parentItem.getEvent().seen;
                    let value = val;
                    if (!ignoreKeys[parentKey] && valid(value, arrayParser)) {
                        if (cache.has(value)) {
                            // Cycle detected, return existing instance
                            return cache.get(value);
                        }

                        value = clone(value);
                        if (isArray(value)) {
                            // Parse each array item recursively
                            let arr: ObservableArray<T> = new ObservableArray(parentKey,
                                (item, index) => parse(item, parentKey),
                                (a, b, changes) => parentItem.getEvent().onChange(changes.key, changes));
                            arr.push(...value);
                            arr.hasInit = true;
                            return arr;
                        } else {
                            // Create a placeholder instance and set it immediately
                            const newInstance = new Create();
                            cache.set(val, newInstance);
                            // Now call the constructor logic on the placeholder instance
                            newInstance.initializeStateItem({ item: value, parent: parentKey, parentItem, arrayParser });
                            // Create a new Create instance and store in 'seen' map
                            return newInstance;
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
                return val;
            };

            for (let k of keys(item, Create.prototype)) {
                let parentKey = parentKeys(k);
                let v = parse(item[k], parentKey);
                parentItem.getEvent().seen.delete(item[k]);
                if (v !== item[k]) item[k] = v;
                Object.defineProperty(this, k, {
                    enumerable: true,
                    configurable: true,
                    get: () => item[k],
                    set: (value: any) => {
                        if (isSame(value, item[k])) {
                            return; // do nothing as the objects are the same
                        }
                        const newValue = { oldValue: item[k], newValue: parse(value, parentKey) };
                        item[k] = newValue.newValue;
                        parentItem.getEvent().seen.delete(value);
                        if ((parentKey.includes(".") || k === parentKey) && valid(value)) {
                            let parts = parentKey.split(".");
                            // Traverse up from most specific to least specific (excluding the root level)
                            if (parentItem.getEvent().addedPaths.hasValue || parentItem.getEvent().localBindedEvents.hasValue)
                                while (parts.length > 1 || (parts.length > 0 && k == parentKey)) {
                                    parts = parts.slice(0, -1);
                                    const pKey = k == parentKey ? k : parts.join(".");

                                    if (parentItem.getEvent().addedPaths.hasValue)
                                        parentItem.getEvent().addedPaths.keys.forEach((addedKey: NestedKeyOf<T>) => {
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
            throw SmartStateError(e, { code: "initializeStateItem", details: data });
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
    private ignoreKeys: NestedKeyOf<T>[] = [];
    private hardIgnoreKeys: NestedKeyOf<T>[] = [];
    private bindKeys: NestedKeyOf<T>[] = [];
    private localBindKeys: NestedKeyOf<T>[] = [];
    private timeoutSpeed?: number = -1;
    private onStateInit?: (item: T) => Promise<void>;
    private arrayParser?: boolean;

    /**
     * @param item - The object to wrap in a reactive state, or a function returning it
     */
    constructor(item: T | (() => T)) {
        this.item = item;
    }

    /**
     * create proxies for arrays items.
     * that are not included in ignore objects.
     * this is disabled by default for better performance.
     */
    parseArray() {
        this.arrayParser = true;
        return this;
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
     * Prevents state updates for specific nested keys.
     * Any state update attempt on the specified keys will be ignored.
     * still keys added to .hook will override this settings
     *
     * @param keys - Array of nested key paths (e.g. 'user.name', 'settings.theme')
     * @returns The current instance (for chaining)
     */
    ignoreUpdatesFor(...keys: NestedKeyOf<T>[]): this {
        this.hardIgnoreKeys = keys;
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
                ignoreKeys: toObject(...$this.ignoreKeys),
                hardIgnoreKeys: toObject(...$this.hardIgnoreKeys),
                arrayParser: this.arrayParser ?? false
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
                ignoreKeys: toObject(...this.ignoreKeys),
                hardIgnoreKeys: toObject(...this.hardIgnoreKeys),
                arrayParser: this.arrayParser ?? false
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
