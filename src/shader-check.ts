/** Compile/link on the actual WebGL context before attaching optional visual effects. */
export function checkVisualShader(gl:WebGLRenderingContext,fragment:string):string|undefined {
  const shaders:WebGLShader[]=[];
  let program:WebGLProgram|null=null;
  try {
    for(const [type,source] of [
      [gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 outTexCoord; void main(){outTexCoord=position;gl_Position=vec4(position,0.0,1.0);}'],
      [gl.FRAGMENT_SHADER,fragment]
    ] as const){
      const shader=gl.createShader(type);if(!shader)return '无法创建着色器';
      shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))return gl.getShaderInfoLog(shader)||'着色器编译失败';
    }
    program=gl.createProgram();if(!program)return '无法创建着色程序';
    shaders.forEach(s=>gl.attachShader(program!,s));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))return gl.getProgramInfoLog(program)||'着色程序链接失败';
  }catch(error){return String(error);}
  finally{if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}
}
