# react-smart-state

> Next generation local and global state management

`react-smart-state` makes your state management much simple to handle.

I have looked at state management libraries like redux, atom etc and each of them takes to much code/work to create and manage, this is why I built this library.

This library also able to handle working in devoloped mode. no need to reload the application each time you change your code.

[![NPM](https://img.shields.io/npm/v/react-smart-state.svg)](https://www.npmjs.com/package/react-smart-state) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install react-smart-state
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
  state.hook("itemA");

  // if you want to bind an item in ignore item then 
  state.bind("item.a") // then add its hook state.hook("item.a")
  // or 
  state.localBind("item.a") // this will only bind it in the current component

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

## BuildState Methods 
| Name | Descriptions |
| ------------- | ------------- |
| ignore | Ignore props from proxy this is usefull when you have a big or recrusive items, those could be ignored as it may slow down the application, you will still get notified when setting it but it will ignore its probs. |
| bind | bind prop in ignored object, this work globlly|
| unbind | unbind binded prop |
| localBind | bind prop in ignored object, this only work locally eg for the component that is exist in |
| build | build the local state |
| globalBuild | build the global state |
| timeout | disable settimeout by giving undefined value or specify a number in ms default is 2 ms for globalBuild and undefiend for build |

## State additional props
| Name | Descriptions |
| ------------- | ------------- |
| bind | bind prop in ignored object, this work globlly|
| unbind | unbind binded prop |
| localBind | bind prop in ignored object, this only work locally eg for the component that is exist in |
| hook | used to hook changes to a specific component |
| hook().on | trigger update with condition eg hook("counter").on(x=> x.counter >3) |
| useEffect | get notify of a change |

## License

MIT
