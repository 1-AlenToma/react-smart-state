type NestedKeyOf<T extends object, D extends any[] = [0, 0, 0, 0, 0]> = D extends [any, ...infer DD] ? {
    [K in keyof T & (string | number)]: T[K] extends object ? `${K}` | `${K}.${NestedKeyOf<T[K], DD>}` : `${K}`;
}[keyof T & (string | number)] : never;
type EventItem = {
    keys: any;
    fn?: Function;
    fs?: Function;
    item?: any;
};
declare class EventTrigger {
    ___events: any;
    ___timer: any;
    ___waitingEvents: any;
    ___addedPaths: string[];
    speed?: number;
    add(id: string, item: EventItem): void;
    remove(id: string): void;
    ___onChange(key: string, parentItem: any): Promise<void>;
}
declare abstract class ICreate {
    abstract ___events: EventTrigger;
}
type ReturnState<T extends object> = {
    hook(...keys: NestedKeyOf<T>[]): void;
    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]): void;
    bind(path: string): void;
};
declare class Create<T extends object> extends ICreate {
    ___events: EventTrigger;
    hook(...keys: NestedKeyOf<T>[]): void;
    useEffect(fn: Function, ...keys: NestedKeyOf<T>[]): void;
    bind(path: string): void;
    constructor(item: any, parent: any, parentItem: any, ignoreKeys: any);
}
declare class StateBuilder<T extends object> {
    item: any;
    initilized?: Create<T>;
    ignoreKeys: string[];
    bindKeys: string[];
    timeoutSpeed?: number;
    constructor(item: any);
    timeout(speed?: number): this;
    ignore(...ignoreKeys: NestedKeyOf<T>[]): this;
    bind(...bindKeys: NestedKeyOf<T>[]): this;
    build(): ReturnState<T> & T;
    globalBuild(): ReturnState<T> & T;
}
declare const StateInit: <T extends object>(item: T) => StateBuilder<T>;
export default StateInit;
