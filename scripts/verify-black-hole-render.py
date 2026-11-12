"""Offscreen GPU validation of the runtime shader. Not browser or phone acceptance.
Install moderngl into artifacts/visual-tools; no game dependency is added.
"""
from pathlib import Path
import sys,json,time
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'artifacts/visual-tools'))
import moderngl
ctx=moderngl.create_standalone_context(require=330)
source=(root/'src/black-hole.frag').read_text(encoding='utf-8')
fragment='#version 330\nout vec4 fragColor;\n'+source.replace('precision highp float;','').replace('varying vec2','in vec2').replace('texture2D(','texture(').replace('gl_FragColor','fragColor')
vertex='''#version 330
in vec2 position; out vec2 outTexCoord;
void main(){outTexCoord=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0,1);}
'''
program=ctx.program(vertex_shader=vertex,fragment_shader=fragment)
image=Image.open(root/'src/assets/black-hole-orbits.png').convert('RGBA')
lut=ctx.texture(image.size,4,image.tobytes());lut.filter=(moderngl.LINEAR,moderngl.LINEAR);lut.repeat_x=False;lut.repeat_y=False;lut.use(0)
program['uMainSampler']=0
vertices=np.array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1],dtype='f4')
vbo=ctx.buffer(vertices.tobytes());vao=ctx.simple_vertex_array(program,vbo,'position')
width,height=720,480
frame=ctx.simple_framebuffer((width,height),components=4);frame.use()
ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA)
def render(seconds,angle=10):
    frame.clear(7/255,13/255,22/255,1)
    program['uTime']=seconds;program['uInclination']=np.deg2rad(angle);program['uResolutionX']=width;program['uSky']=1
    vao.render(moderngl.TRIANGLES)
    return Image.frombytes('RGB',(width,height),frame.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
out=root/'docs/evidence';out.mkdir(exist_ok=True)
a=render(0);b=render(2);paused=render(2);tilted=render(2,30)
aa,bb=np.asarray(a),np.asarray(b)
assert np.array_equal(bb,np.asarray(paused)), 'same time must reproduce frozen frame'
delta=np.abs(aa.astype(float)-bb.astype(float))
assert (delta.max(axis=2)>8).sum()>1000,'disc must visibly move'
assert np.abs(bb.astype(float)-np.asarray(tilted).astype(float)).mean()>2,'inclination must change geometry'
assert bb[height//2,width//2].max()<12,'shadow must stay dark'
assert bb.max()>180,'disc must remain luminous'
a.save(out/'v14-dynamic-t0.png');b.save(out/'v14-dynamic-t2.png');tilted.save(out/'v14-dynamic-angle30.png')
start=time.perf_counter();frames=[render(i/12) for i in range(72)]
frames[0].save(out/'v14-dynamic-black-hole.gif',save_all=True,append_images=frames[1:],duration=83,loop=0,optimize=False)
result={'renderer':ctx.info['GL_RENDERER'],'shaderCompiled':True,'frozenFrameIdentical':True,'changedPixels':int((delta.max(axis=2)>8).sum()),'meanTemporalDifference':float(delta.mean()),'inclinationChangesGeometry':True,'darkShadow':True,'frames':72,'previewSeconds':6,'renderAndEncodeSeconds':time.perf_counter()-start,'scope':'Offscreen desktop OpenGL of the runtime fragment shader with GLSL syntax adaptation; not Phaser/WebGL/mobile acceptance.'}
(out/'v14-render-validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
