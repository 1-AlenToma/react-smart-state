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


// Global state
const globalState = buildState({
  counter: 1,
  item: { counter: 1 },
  shared: 0
})
  .timeout(undefined)
  .globalBuild();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetch = async (g) => {
  let item = new StateItem();
  item.name = "hahaha";
  item.counter = 1005;
  await sleep(1000);
  g.test = item;
}

// Component
const TestSmartState = () => {
  // Hook usage for reaction (e.g., logging or effects)
  globalState.hook("item").on(g => g.item.counter >= 3);

  // Local state
  const state = buildState({
    itemA: 0,
    item: { a: 0 },
    test: new StateItem(),
    derived: 0
  }).onInit(fetch)
    .ignore("test.counter", "item") // test .ignore()
    .localBind("item.a", "test.counter") // bind local values
    .build();

  const cmValue = state.useComputed((g, current) => {
    let v = g.itemA + 10 + g.test.counter;
    return v;
  }, "itemA", "test.counter");

  // Side effect on a field
  state.useEffect(() => {
    console.log("itemA changed to", state.itemA);
  }, "itemA");

  // Derived update effect
  state.useEffect(() => {
    //alert(44)
    state.derived = state.itemA + state.test.counter;
  }, "itemA", "test.counter");

  // Global state reaction
  globalState.useEffect(() => {
    console.log("Global counter changed:", globalState.counter);
  }, "counter");

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h3>Local State</h3>
      <pre>{display(state)}</pre>
      <h3>Global State</h3>
      <pre>{display(globalState)}</pre>
      <h3>cmValue</h3>
      <pre>{display({ cmValue })}</pre>

      <button
        onClick={() => {

          // Update local state

          state.item = state.item;
          state.item.a++;
          return;
          state.itemA++;
          state.test.counter++;
          // Reset logic
          if (state.test.counter === 5) {
            state.test = new StateItem(); // Replace ignored object
          }

          // Update global state
          /**   globalState.counter++;
            globalState.item.counter++;
            globalState.shared += 2;*/

          // Test rerender-triggering same reference


          // Reset state when a threshold is hit
          if (state.itemA >= 8) {
            state.resetState();
          }
          // await sleep(1000)

        }}
      >
        increase
      </button>
    </div>
  );
};

export default TestSmartState;
