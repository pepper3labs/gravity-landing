import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkVisualShader} from '../src/shader-check';

test('黑洞源码不使用WebGL 1保留的packed标识符',()=>{
  const source=readFileSync('src/black-hole.frag','utf8');
  assert.doesNotMatch(source,/\bpacked\b/);
});
test('可选特效编译/链接失败返回原因并释放临时GPU资源',()=>{
  for(const stage of ['vertex','fragment','link','success']){
    const deleted:number[]=[];let next=0,programDeleted=false;
    const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,
      createShader:()=>++next,shaderSource:()=>{},compileShader:()=>{},
      getShaderParameter:(id:number)=>!(stage==='vertex'&&id===1||stage==='fragment'&&id===2),
      getShaderInfoLog:()=>stage+' failure',createProgram:()=>({}),attachShader:()=>{},linkProgram:()=>{},
      getProgramParameter:()=>stage!=='link',getProgramInfoLog:()=>stage+' failure',
      deleteShader:(id:number)=>deleted.push(id),deleteProgram:()=>{programDeleted=true;}};
    const result=checkVisualShader(gl as unknown as WebGLRenderingContext,'fragment');
    assert.equal(result,stage==='success'?undefined:stage+' failure');
    assert.equal(deleted.length,stage==='vertex'?1:2);
    assert.equal(programDeleted,stage==='success'||stage==='link');
  }
});
