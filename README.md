# react-smart-state

> Next generation local and global state management

`react-smart-state` makes your state management much simple to handle.

I have looked at state management libraries like redux, atom etc and each of them takes to much code/work to create and manage, this is why I built this library.

[![NPM](https://img.shields.io/npm/v/react-smart-state.svg)](https://www.npmjs.com/package/react-smart-state) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save react-smart-state
```

## Usage 

# Local State

```tsx
import buildState from 'react-smart-state';

const Counter = () => {
  const state = buildState({
        itemA: 0,
        item: { a: 0 },
        test: new StateItem()
}).ignore("item").bind("item.a").build();
      
  state.useEffect(() => {
    
   // console.error(state);
  }, "itemA", "item.a")
  //alert(state.item.a)
  return (
    <div>
      <label>{state.itemA} && {state.item.a} && {state.test.name} </label>
      <button onClick={() => {
        state.itemA++;
        state.item.a++;
      }}>increase</button>
    </div>
  )
}
```

# GlobalState

```tsx
import buildState from 'react-smart-state';

const state = buildState({
        itemA: 0,
        item: { a: 0 },
        test: new StateItem()
}).ignore("item").globalBuild();
const Counter = () => {
  // for all items change except ignored items
  state.hook();
  // or specify items
  state.hook("itemA","item.a");
  state.useEffect(() => {
    
   // console.error(state);
  }, "itemA", "item.a")
  //alert(state.item.a)
  return (
    <div>
      <label>{state.itemA} && {state.item.a} && {state.test.name} </label>
      <button onClick={() => {
        state.itemA++;
        state.item.a++;
      }}>increase</button>
    </div>
  )
}
```
## License

MIT
