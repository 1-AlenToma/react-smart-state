import { newId } from "./methods";
import { EventItem, WaitngItem, StateType, IEventTrigger, IFastList, ChangeType, ReactSmartStateInstanceItems, SmartStateInstanceNames, StateKeyTypeGenerator } from "./types";

export class CustomError extends Error {
    originalError: unknown;
    code?: string;
    details?: any;

    constructor(message: string, options: {
        originalError?: unknown;
        code?: string;
        details?: any;
    } = {}) {
        super(message);
        this.name = 'react-smart-state-Error'.toUpperCase();
        this.originalError = options.originalError;
        this.code = options.code;
        this.details = options.details;

        Object.setPrototypeOf(this, new.target.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            originalError: this.originalError,
            stack: this.stack,
        };
    }

}

export class EventTrigger implements IEventTrigger {
    events: Record<string, EventItem> = {};
    timer: any = undefined;
    waitingEvents: IFastList<{ event: EventItem, items: IFastList<WaitngItem> }> = new FastList();
    addedPaths: IFastList<string> = new FastList();
    localBindedEvents: IFastList<IFastList<boolean>, string> = new FastList();
    speed?: number = 2;
    stateType: StateType;
    batching: IFastList<Function, number> = new FastList<Function, number>();
    seen: WeakMap<any, any> = new WeakMap();
    ignoreKeys: StateKeyTypeGenerator;
    hardIgnoreKeys: StateKeyTypeGenerator;

    constructor(ignoredKeys: Record<string, boolean>, hardIgnoreKeys: Record<string, boolean>) {
        this.ignoreKeys = ignoredKeys ?? {};
        this.hardIgnoreKeys = hardIgnoreKeys ?? {};
    }

    add(id: string, item: EventItem) {
        item.type = item.type ?? "Auto";
        this.events[id] = item;
    }

    remove(id: string) {
        delete this.events[id];
    }

    hasChange(items: Record<string, WaitngItem>, parentState: Record<string, any>) {
        let hasChanges = false;
        let newState = parentState ?? {};
        for (const { key, oldValue, newValue } of Object.values(items)) {
            if (oldValue !== newValue) {
                hasChanges = true;
            }
            newState[key] = newValue;
        }

        return { hasChanges, parentState: newState };

    }


    async triggerSavedChanges() {
        clearTimeout(this.timer); // Proper debouncing
        if (this.batching.size > 0)
            return;

        const runHandlers = (e: EventItem, items: Record<string, WaitngItem>) => {
            e.func?.(items);
        };

        const trigger = (fn: () => void) => {
            if (this.speed == undefined) {
                fn();
            }
            else {
                this.timer = setTimeout(fn, this.speed);
            }
        }

        trigger(() => {
            let itemKeys = this.waitingEvents.values;
            this.waitingEvents.clear();
            for (let { event, items } of itemKeys) {
                runHandlers(event, items.records());
            }
        });
    }

    async trigger(event: { eventId: string, event: EventItem }, key: string, oldValue: any, newValue: any) {
        clearTimeout(this.timer); // Proper debouncing
        const { eventId, event: evt } = event;

        const waitingItems = (this.waitingEvents.has(eventId) ? this.waitingEvents.get(eventId) : this.waitingEvents.set(eventId, {
            event: evt,
            items: new FastList()
        })).items;

        waitingItems.set(key, { key, oldValue, newValue });
        if (this.batching.size > 0)
            return;
        this.triggerSavedChanges();

    }

    async onChange(key: string, { oldValue, newValue }) {
        try {
            clearTimeout(this.timer); // Proper debouncing
            // if the child of the hooked key is changes, then hook should still trigger if there is a hook for it
            const parts = key.split(".");
            for (const [eventId, event] of Object.entries(this.events)) {
                let foundPartKey = event.keys._keys?.find(x => x.startsWith(key + "."));
                if ((event.keys.AllKeys && !this.addedPaths.has(key) && !this.hardIgnoreKeys[key]) || event.keys[key] || foundPartKey) {
                    this.trigger({ eventId, event }, key, oldValue, newValue);
                    continue;
                }

                // Traverse up the key chain: "a.b.c" → "a.b" → "a"
                for (let i = parts.length - 1; i > 0; i--) {
                    const parentKey = parts.slice(0, i).join(".");
                    if (event.keys[parentKey]) {
                        this.trigger({ eventId, event }, key, oldValue, newValue);
                        break; // stop at the first match for performance
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export class FastList<T, Key extends string | number | symbol = string> implements IFastList<T, Key> {
    private items: Record<Key, T> = {} as Record<Key, T>;
    private length = 0;
    private cachedKeys?: Key[];
    private cachedValues?: T[];

    private invalidateCache() {
        this.cachedKeys = undefined;
        this.cachedValues = undefined;
    }

    clear(): this {
        this.items = {} as Record<Key, T>;
        this.length = 0;
        this.invalidateCache();
        return this;
    }

    get hasValue(): boolean {
        return this.length > 0;
    }

    get values(): T[] {
        return this.cachedValues ?? (this.cachedValues = Object.values(this.items));
    }

    get keys(): Key[] {
        return this.cachedKeys ?? (this.cachedKeys = Object.keys(this.items) as Key[]);
    }

    find(func: (item: T, key: Key) => boolean): T | undefined {
        for (const [key, value] of Object.entries(this.items) as [Key, T][]) {
            if (func(value, key)) return value;
        }
        return undefined;
    }

    findKey(func: (item: T, key: Key) => boolean): Key | undefined {
        for (const [key, value] of Object.entries(this.items) as [Key, T][]) {
            if (func(value, key)) return key;
        }
        return undefined;
    }

    delete(key: Key): this {
        if (key in this.items) {
            delete this.items[key];
            this.length--;
            this.invalidateCache();
        }
        return this;
    }

    get(key: Key): T | undefined {
        return this.items[key];
    }

    records(): Record<Key, T> {
        return this.items;
    }

    record(key: Key): Record<Key, T> {
        const result = {} as Record<Key, T>;
        const val = this.get(key);
        if (val !== undefined) result[key] = val;
        return result;
    }

    has(key: Key): boolean {
        return key in this.items;
    }

    append(key: Key, item: T): this {
        const existing = this.items[key];
        if (existing) Object.assign(existing, item);
        else this.set(key, item);
        return this;
    }

    set(key: Key, value: T): T {
        if (value === undefined) {
            this.delete(key);
            return value;
        }

        if (!(key in this.items)) {
            this.length++;
            this.invalidateCache();
        }

        this.items[key] = value;
        return value;
    }

    get size(): number {
        return this.length;
    }
}




export class ObservableArray<T> extends Array<T> implements ReactSmartStateInstanceItems {
    getInstanceType(): SmartStateInstanceNames {
        return "react-smart-state-array"
    }
    hasInit?: boolean;
    constructor(
        private readonly parentKey: string,
        private readonly process: (item: T, index: number, parentKey: string) => T,
        private readonly onChange?: (action: ChangeType, items: T[], changes: WaitngItem) => void
    ) {
        super();
        // Required to fix instanceof issues when extending Array
        Object.setPrototypeOf(this, ObservableArray.prototype);
    }

    private getChanges() {
        // always update
        const item: WaitngItem = { key: this.parentKey, oldValue: true, newValue: newId() }
        return item;
    }

    override push(...items: T[]): number {
        const processed = items.map((item, index) => this.process(item, index, this.parentKey));
        const result = super.push(...processed);
        if (processed.length && this.hasInit) this.onChange?.('add', processed, this.getChanges());
        return result;
    }

    override unshift(...items: T[]): number {
        const processed = items.map((item, index) => this.process(item, index, this.parentKey));
        const result = super.unshift(...processed);
        if (processed.length && this.hasInit) this.onChange?.('add', processed, this.getChanges());
        return result;
    }

    override pop(): T | undefined {
        const removed = super.pop();
        if (removed !== undefined && this.hasInit) this.onChange?.('remove', [removed], this.getChanges());
        return removed;
    }

    override shift(): T | undefined {
        const removed = super.shift();
        if (removed !== undefined && this.hasInit) this.onChange?.('remove', [removed], this.getChanges());
        return removed;
    }

    override splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        const processed = items.map((item, index) => this.process(item, index, this.parentKey));
        const removed = super.splice(start, deleteCount ?? this.length, ...processed);
        if (removed.length && this.hasInit) this.onChange?.('remove', removed, this.getChanges());
        if (processed.length && this.hasInit) this.onChange?.('add', processed, this.getChanges());
        return removed;
    }

    clear(): void {
        if (this.length > 0) {
            const removed = this.splice(0);
            if (this.hasInit)
                this.onChange?.('remove', removed, this.getChanges());
        }
    }
}
