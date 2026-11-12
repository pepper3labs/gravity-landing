import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_DATA_KEYS,exportLocalData,clearLocalData} from '../src/local-data';
test('备份逐字保留损坏和未来格式存档，不修改源数据，不导出其他应用',()=>{
 const data=new Map([['gravity-campaign','{broken'],['gravity-coins','42'],['other-app','private']]);
 const before=[...data];const storage={getItem:(key:string)=>data.get(key)??null,removeItem:(key:string)=>{data.delete(key);}};
 const backup=JSON.parse(exportLocalData(storage,'test'));
 assert.deepEqual(Object.keys(backup.entries),LOCAL_DATA_KEYS);assert.equal(backup.entries['gravity-campaign'],'{broken');
 assert.equal(backup.entries['gravity-settings'],null);assert.deepEqual([...data],before);
});
test('清除仅操作明确列出的游戏键，可重复执行，其他同源数据保留',()=>{
 const data=new Map<string,string>(LOCAL_DATA_KEYS.map(key=>[key,'saved']));data.set('other-app','keep');
 const storage={getItem:(key:string)=>data.get(key)??null,removeItem:(key:string)=>{data.delete(key);}};
 assert.equal(clearLocalData(storage).ok,true);assert.deepEqual([...data],[['other-app','keep']]);assert.equal(clearLocalData(storage).ok,true);
});
test('存储拒绝或静默未删除必须报告失败，其余游戏键仍尝试清除',()=>{
 const calls:string[]=[];
 const result=clearLocalData({getItem:key=>key==='gravity-coins'?'42':null,removeItem:key=>{calls.push(key);if(key==='gravity-campaign')throw Error('denied');}});
 assert.equal(result.ok,false);assert.deepEqual(result.remaining,['gravity-campaign','gravity-coins']);assert.deepEqual(calls,LOCAL_DATA_KEYS);
 assert.equal(clearLocalData(undefined).ok,false);assert.throws(()=>exportLocalData(undefined,'test'));
 assert.throws(()=>exportLocalData({getItem:()=>{throw Error('denied');},removeItem:()=>{}},'test'));
});
