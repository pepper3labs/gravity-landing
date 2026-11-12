import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FlightInput} from '../src/input';

class FakeButton extends EventTarget {
  held=false;
  classList={toggle:(_name:string,on:boolean)=>{this.held=on;}};
  setPointerCapture(_id:number){}
}
test('双指推进与转向独立；松开、取消和暂停清理不会粘键',()=>{
  const buttons=Object.fromEntries(['left','right','thrust'].map(id=>[id,new FakeButton()]));
  const win=new EventTarget(),previousWindow=globalThis.window,previousDocument=globalThis.document;
  Object.defineProperty(globalThis,'window',{value:win,configurable:true,writable:true});
  Object.defineProperty(globalThis,'document',{value:{getElementById:(id:string)=>buttons[id]},configurable:true,writable:true});
  try {
    const input=new FlightInput(()=>true,()=>{},()=>{});
    const touch=(id:string,type:string,pointerId:number)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'pointerId',{value:pointerId});buttons[id].dispatchEvent(event);};
    touch('thrust','pointerdown',1);touch('right','pointerdown',2);
    assert.equal(input.thrust,true);assert.equal(input.turn,1);
    touch('right','pointerup',2);assert.equal(input.turn,0);assert.equal(input.thrust,true);
    touch('thrust','pointerdown',3);touch('thrust','pointerup',1);assert.equal(input.thrust,true);
    touch('thrust','pointercancel',3);assert.equal(input.thrust,false);
    touch('left','pointerdown',4);touch('thrust','pointerdown',5);input.clear();
    assert.equal(input.turn,0);assert.equal(input.thrust,false);assert.equal(buttons.thrust.held,false);
    touch('right','pointerdown',6);touch('right','lostpointercapture',6);assert.equal(input.turn,0);
  } finally {
    Object.defineProperty(globalThis,'window',{value:previousWindow,configurable:true,writable:true});
    Object.defineProperty(globalThis,'document',{value:previousDocument,configurable:true,writable:true});
  }
});

test('倾斜模式空白按住喷射，菜单点击不喷射；多指释放、取消和切模式不残留',()=>{
 const buttons=Object.fromEntries(['left','right','thrust','shell'].map(id=>[id,new FakeButton()]));
 Object.assign(buttons.shell,{closest:()=>null});Object.assign(buttons.left,{closest:()=>buttons.left});
 const win=new EventTarget(),previousWindow=globalThis.window,previousDocument=globalThis.document;
 Object.defineProperty(globalThis,'window',{value:win,configurable:true,writable:true});
 Object.defineProperty(globalThis,'document',{value:{getElementById:(id:string)=>buttons[id]},configurable:true,writable:true});
 try{
  let active=true,ready=true,allowed=true;
  const input=new FlightInput(()=>allowed,()=>{},()=>{},{active:()=>active,ready:()=>ready,turn:()=>1,clear:()=>{ready=false;}});
  const event=(target:EventTarget,type:string,id:number,source?:FakeButton)=>{const e=new Event(type,{cancelable:true});Object.defineProperty(e,'pointerId',{value:id});if(source)Object.defineProperty(e,'target',{value:source});target.dispatchEvent(e);};
  event(buttons.shell,'pointerdown',1,buttons.left);assert.equal(input.thrust,false);
  event(buttons.shell,'pointerdown',2);event(buttons.shell,'pointerdown',3);assert.equal(input.thrust,true);assert.equal(input.turn,1);
  event(win,'pointerup',2);assert.equal(input.thrust,true);event(win,'pointercancel',3);assert.equal(input.thrust,false);
  ready=false;event(buttons.shell,'pointerdown',4);assert.equal(input.thrust,false);
  ready=true;allowed=false;event(buttons.shell,'pointerdown',5);assert.equal(input.thrust,false);
  allowed=true;event(buttons.shell,'pointerdown',6);input.clear(false);assert.equal(input.thrust,false);assert.equal(ready,true);
  event(buttons.shell,'pointerdown',8);assert.equal(input.thrust,true);input.clear();assert.equal(ready,false);assert.equal(input.thrust,false);
  active=false;input.clear();assert.equal(input.turn,0);event(buttons.thrust,'pointerdown',7);assert.equal(input.thrust,true);
 }finally{
  Object.defineProperty(globalThis,'window',{value:previousWindow,configurable:true,writable:true});
  Object.defineProperty(globalThis,'document',{value:previousDocument,configurable:true,writable:true});
 }
});
