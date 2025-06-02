import { EventItem, WaitngItem, StateType, IEventTrigger, IFastList } from "./types";

export class EventTrigger implements IEventTrigger {
    events: Record<string, EventItem> = {};
    timer: any = undefined;
    waitingEvents: IFastList<{ event: EventItem, items: IFastList<WaitngItem> }> = new FastList();
    addedPaths: IFastList<string> = new FastList();
    localBindedEvents: IFastList<IFastList<boolean>, string> = new FastList();
    speed?: number = 2;
    stateType: StateType;
    batching: IFastList<Function, number> = new FastList<Function, number>();

    add(id: string, item: EventItem) {
        this.events[id] = item;
    }

    remove(id: string) {
        delete this.events[id];
    }

    hasChange(items: Record<string, WaitngItem>, parentState: Record<string, any>) {
        let hasChanges = false;
        let newState = parentState ?? {};
        for (const { key, oldValue, newValue } of Object.values(items)) {
            //    let newValue = getValueByPath(parentItem, key);
            if (oldValue !== newValue) {
                hasChanges = true;
            }
            newState[key] = newValue;
        }

        return { hasChanges, parentState: newState };

    }


    triggerSavedChanges() {
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
            for (let item of itemKeys) {
                runHandlers(item.event, item.items.records());
            }
        });
    }

    trigger(event: { eventId: string, event: EventItem }, key: string, oldValue: any, newValue: any) {
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

    onChange(key: string, { oldValue, newValue }) {
        try {
            clearTimeout(this.timer); // Proper debouncing
            // if the child of the hooked key is changes, then hook should still trigger if there is a hook for it
            let called = false;
            const parts = key.split(".");
            for (const [eventId, event] of Object.entries(this.events)) {
                if (event.keys.AllKeys || event.keys[key]) {
                    this.trigger({ eventId, event }, key, oldValue, newValue);
                    called = true;
                    continue;
                }

                // Traverse up the key chain: "a.b.c" → "a.b" → "a"
                for (let i = parts.length - 1; i > 0; i--) {
                    const parentKey = parts.slice(0, i).join(".");
                    if (event.keys[parentKey]) {
                        this.trigger({ eventId, event }, key, oldValue, newValue);
                        called = true;
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
