export interface IFastList<T, Key extends string | number | symbol = string> {
    // Core operations
    set(key: Key, item: T): T;
    get(key: Key): T | undefined;
    delete(key: Key): this;
    has(key: Key): boolean;
    clear(): this;
    append(key: Key, item: T): this;

    // Metadata
    readonly size: number;
    readonly hasValue: boolean;
    readonly keys: Key[];
    readonly values: T[];

    // Access to full object
    records(): Record<Key, T>;
    record(key: Key): Record<Key, T>;

    // Search
    find(predicate: (item: T, key: Key) => boolean): T | undefined;
    findKey(predicate: (item: T, key: Key) => boolean): Key | undefined;
}


export type StateType = "Local" | "Global";

export type IEventTrigger = {
    addedPaths: IFastList<string>;
    localBindedEvents: IFastList<IFastList<boolean>, string>;
    batching: IFastList<Function, number>;
    speed?: number;
    stateType: StateType;
    add(id: string, item: EventItem): void;
    remove(id: string): void;
    triggerSavedChanges(): void;
    onChange(key: string, { oldValue, newValue }): void;
    hasChange(items: Record<string, WaitngItem>, parentState: Record<string, any>): { hasChanges: boolean, parentState: any };
}

export type IPrivateCreate<T extends object> = {
    getInstanceType(): string;
    getEvent(): IEventTrigger;
    bind(path: string, autoUnbind?: boolean, rebind?: boolean): ReturnState<T>;
}


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

export type WaitngItem = { key: string, oldValue: any, newValue: any };

export type EventItem = {
    keys: Record<string, boolean>;
    func: (item: Record<string, WaitngItem>) => void,
    item?: any;
    type?: "Auto" | "Path";
};

/**
 * ReturnState defines the extended API returned from Create or StateBuilder,
 * providing reactive bindings, event hooks, and integration with React-like effects.
 */
export type ReturnState<T extends object> = {
    /**
     * Runs a function in a batched update context.
     * - Queues the function to be executed.
     * - If it returns a Promise, `updates` is deferred until it resolves.
     * - Prevents intermediate state propagation during batch execution.
     *
     * @param func - A function that performs updates, possibly asynchronous.
     * @returns A Promise that resolves when the batch is complete.
     */
    batch(func: () => void | Promise<void>): Promise<void>;


    /**
  * Creates a computed value based on the current state.
  * - Automatically re-computes when any of the specified keys change.
  * - Caches and reuses the result until dependencies update.
  *
  * @typeParam B - The return type of the computed value.
  * @param fn - A function that receives the current state and optionally the previous computed value.
  * @param keys - List of nested keys to watch for triggering re-computation.
  * @returns The result of the computed function.
  */
    useComputed<B>(fn: (item: T, currentValue?: T) => B, ...keys: NestedKeyOf<T>[]): B;

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


export type CreateItem<T extends object> = {
    item: T,
    parent?: any,
    parentItem?: Omit<ReturnState<T>, "bind"> & IPrivateCreate<T>,
    ignoreKeys: Record<string, boolean>,
    seen?: WeakMap<any, any>
}