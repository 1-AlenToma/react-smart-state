# react-smart-state

> Next generation local and global state management

`react-smart-state` makes your state management much simple to handle.

I have looked at state management libraries like redux, atom etc and each of them takes to much code/work to create and manage, this is why I built this library.

This library also able to handle working in devoloped mode. no need to reload the application each time you change your code.

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

## BuildState Methods 
| Name | Descriptions |
| ------------- | ------------- |
| ignore | Ignore props from proxy this is usefull when you have a big or recrusive items, those could be ignored as it may slow down the application, you will still get notified when setting it but it will ignore its probs. |
| bind | bind prop in ignored object |
| build | build the local state |
| globalBuild | build the global state |
| timeout | disable settimeout by giving undefined value or specify a number in ms default is 2 ms |

## State additional props
| Name | Descriptions |
| ------------- | ------------- |
| bind | bind prop in ignored object |
| hook | used to hook changes to a specific component |
| useEffect | get notify of a change |

## License

MIT
