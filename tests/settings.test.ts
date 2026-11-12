import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameSettings,SETTINGS_KEY} from '../src/settings';
function store(raw?:string){const values=new Map<string,string>(raw?[[SETTINGS_KEY,raw]]:[]);return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}
test('默认体验不变，三个偏好独立保存并可重读，不写战役键',()=>{
 const storage=store(),settings=new GameSettings(storage);assert.deepEqual(settings.data,{sound:true,vibration:true,lowEffects:false,controlMode:'buttons'});
 settings.set('sound',false);settings.set('lowEffects',true);
 assert.deepEqual(new GameSettings(storage).data,{sound:false,vibration:true,lowEffects:true,controlMode:'buttons'});
 assert.deepEqual([...storage.values.keys()],[SETTINGS_KEY]);
 settings.set('vibration',false);assert.equal(new GameSettings(storage).data.vibration,false);
});
test('损坏、错误类型和未知版本使用临时默认值并保留原数据',()=>{
 for(const raw of ['{','null','{"version":2}','{"version":1,"sound":false,"vibration":"false","lowEffects":true}']){
  const storage=store(raw),settings=new GameSettings(storage);assert.equal(settings.data.sound,true);assert.ok(settings.warning);
  settings.set('sound',false);assert.equal(settings.data.sound,false);assert.equal(storage.getItem(SETTINGS_KEY),raw);
 }
});
test('存储不可用或写入失败时设置仍生效且显示提示',()=>{
 for(const storage of [undefined,{getItem:()=>null,setItem:()=>{throw Error('quota');}}]){
  const settings=new GameSettings(storage);settings.set('sound',false);assert.equal(settings.data.sound,false);assert.ok(settings.warning);
 }
 const settings=new GameSettings({getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('unexpected');}});
 settings.set('lowEffects',true);assert.equal(settings.data.lowEffects,true);assert.ok(settings.warning);
});
test('系统减少动态效果优先，低特效与震动开关独立',()=>{
 const settings=new GameSettings(store());assert.equal(settings.reduced(false),false);assert.equal(settings.canVibrate(false),true);
 assert.equal(settings.reduced(true),true);assert.equal(settings.canVibrate(true),false);
 settings.set('lowEffects',true);assert.equal(settings.reduced(false),true);assert.equal(settings.canVibrate(false),true);
 settings.set('vibration',false);assert.equal(settings.canVibrate(false),false);
});

test('旧设置默认按钮，新操作偏好可持久化且不改变声音设置',()=>{
 const storage=store('{"version":1,"sound":false,"vibration":true,"lowEffects":false}');
 const settings=new GameSettings(storage);assert.equal(settings.data.controlMode,'buttons');
 settings.set('controlMode','tilt');assert.equal(new GameSettings(storage).data.controlMode,'tilt');assert.equal(new GameSettings(storage).data.sound,false);
});
