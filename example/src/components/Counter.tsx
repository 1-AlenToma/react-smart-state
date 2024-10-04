import React from 'react';
import buildState from 'react-smart-state';
import StateItem from "../testItems/StateItem";
let globalState = buildState({
  counter:2
}).globalBuild();
const Counter = () => {
   globalState.hook();
  //state.bind("item.a")
  const state = buildState({
        itemA: 0,
        item: { a: 0 },
        test: new StateItem()
      }).ignore("item").bind("item.a").build();
      
  state.useEffect(() => {
   // console.error(state);
  }, "itemA", "item.a", "item")
  //alert(state.item.a)
  return (
    <div>
      <label>{state.itemA} && {state.item.a} && {state.test.name} && counter: {globalState.counter}</label>
      <button onClick={() => {
      if(state.item.a ==0)
        state.item = {a:200}
        //state.itemA++;
        state.item.a++;
        //globalState.counter++;
      }}>increase</button>
    </div>
  )
}

export default Counter;