# 🧠 react-smart-state

> Next-generation local and global state management for React

**react-smart-state** simplifies React state handling with a minimal, powerful API for both local and global state.

Unlike Redux, Zustand, Recoil, or Jotai, this library removes boilerplate, offers smarter proxying, and supports hot reloading — no need to refresh after each change in development mode.

[![NPM](https://img.shields.io/npm/v/react-smart-state.svg)](https://www.npmjs.com/package/react-smart-state)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

---

## 📦 Installation

```bash
npm install react-smart-state
```

---

## 🧱 `buildState()` API

Use `buildState()` to create and configure a local or global state instance.

### Methods

| Method | Description |
|--------|-------------|
| `ignore(...keys)` | Ignores deeply nested objects to prevent performance overhead (e.g., recursive or large structures). |
| `bind(...paths)` | Globally binds a property inside an ignored object to allow reactivity. |
| `localBind(...path)` | Same as `bind`, but only applies to the local component. |
| `onInit(fn: (state) => Promise<void>)` | Called once asynchronously when the state is initialized. |
| `timeout(ms: number | undefined)` | Sets a delay (in ms) for batching updates. Use `undefined` to disable. Default is `2ms` for global and 0 for local. |
| `build()` | Builds a **local** (component-scoped) state. |
| `globalBuild()` | Builds a **global** shared state instance. |

---

## 🔁 State Instance Methods

After building a state, you can use these instance methods:

### Methods & Properties

| Method / Prop | Description |
|---------------|-------------|
| `bind(path)` | Globally binds ignored sub-properties to track changes. |
| `unbind(path)` | Unbinds a previously bound property. |
| `batch(fn: () => void | Promise<void>)` | Batches state changes and defers triggers. Handles async too. |
| `localBind(path)` | Binds sub-properties only within the current component that is ignored. |
| `hook(path)` | Hooks into property changes reactively. |
| `hook().on(conditionFn)` | Conditionally triggers updates based on a function. Example: `hook("count").on(x => x.count > 5)` |
| `useEffect(fn, ...keys)` | Runs a callback when a specific state key changes. |
| `useComputed(fn, ...keys)` | Returns a reactive computed value based on keys. |
| `resetState()` | Resets the local state to its original values. if onInit is set, it will also trigger it |

---

## 🧪 Example

```tsx
import buildState from "react-smart-state";

const globalState = buildState({
  counter: 0,
  item: { count: 1 }
}).timeout(undefined).globalBuild();

const Counter = () => {
  globalState.hook("counter")
  const state = buildState({
    localCount: 0,
    nested: { value: 0 }
  })
    .ignore("nested")
    .localBind("nested.value")
    .build();

  state.useEffect(() => {
    console.log("localCount changed:", state.localCount);
  }, "localCount");

  return (
    <div>
      <p>Global Counter: {globalState.counter}</p>
      <p>Local Count: {state.localCount}</p>
      <button onClick={() => {
        globalState.counter++;
        state.localCount++;
        state.nested.value++;
      }}>
        Increment
      </button>
    </div>
  );
};
```

---

## ⚙️ Advanced Usage

### `onInit`

```ts
const state = buildState({ user: null })
  .onInit(async (state) => {
    state.user = await fetchUser();
  })
  .build();
```

### `batch`

```ts
await state.batch(async () => {
  state.a = 1;
  state.b = 2;
  await someAsyncCall();
  state.c = 3;
});
// components only updates once, after the batch is done
```

### `hook().on`

```ts
state.hook("value").on(v => v.value > 10);
```

---

## 💡 Why Use react-smart-state?

- ✅ No boilerplate
- 🔁 Works with both local and global state
- ⚡ Fast with efficient deep reactivity
- 🧠 Easy to use computed values and bindings
- ♻️ Full hot reload support
- 📦 Minimal package footprint

---

## 📄 License

MIT © [Alen Toma]