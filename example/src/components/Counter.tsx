import React from 'react';
import buildState from 'react-smart-state';
import StateItem from "../testItems/StateItem";
const display = (item: any, seen = new WeakSet(), indent = 0): string => {
  if (item === null || typeof item !== "object") {
    return String(item);
  }

  if (seen.has(item)) {
    return "[Circular]";
  }

  seen.add(item);

  const pad = "  ".repeat(indent);
  let str = "";

  const allKeys = new Set<string | symbol>();

  // Get all own and inherited enumerable keys
  let current = item;
  while (current && current !== Object.prototype) {
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key === "string" || typeof key === "symbol") {
        allKeys.add(key);
      }
    }
    current = Object.getPrototypeOf(current);
  }

  for (const key of allKeys) {
    if (typeof key === "symbol") continue; // skip symbol keys for readability

    let value;
    try {
      value = item[key];
    } catch {
      value = "[unreachable]";
    }

    if (typeof value === "function")
      return str.trim();

    if (typeof value === "object" && value !== null) {
      str += `${pad}${key}:${display(value, seen, indent + 1)} `;
    } else {
      str += `${pad}${key}:${value} `;
    }
  }

  return str.trim();
};





let globalState = buildState({
  counter: 2,
  item: { counter: 2 }
}).timeout(undefined).globalBuild();
const Counter = () => {
  globalState.hook("item").on(x => x.item.counter > 3);
  //state.bind("item.a")
  const state = buildState({
    itemA: 0,
    item: { a: 0 },
    test: new StateItem()
  }).ignore("test.counter").localBind("item.a", "test.counter").build();


  state.useEffect(() => {
    //console.error(state);
  }, "itemA")

  return (
    <div>
      <label>state:{display(state)}</label>
      <br />
      <label>globalState:{display(globalState)}</label>
      <button onClick={() => {

        state.itemA++;
        state.item.a++;
        if (state.test.counter == 5)
          state.test = new StateItem();
        globalState.counter++;
        globalState.item.counter++;
        state.test.counter++

        state.item = state.item;
        state.item.a++;
        if (state.itemA == 6)
          state.resetState();
      }}>increase</button>
    </div >
  )
}

export default Counter;