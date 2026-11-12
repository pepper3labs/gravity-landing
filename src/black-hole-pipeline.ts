import Phaser from 'phaser';
import fragment from './black-hole.frag?raw';
import {checkVisualShader} from './shader-check';

const KEY='DynamicBlackHole';
const unsupported=new WeakSet<Phaser.Renderer.WebGL.WebGLRenderer>();
export class BlackHolePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  clock=0;
  constructor(game:Phaser.Game){super({game,fragShader:fragment});}
  onBind(gameObject:Phaser.GameObjects.Image){
    this.set1f('uTime',this.clock);
    this.set1f('uInclination',10*Math.PI/180);
    this.set1f('uResolutionX',Math.max(200,gameObject?.displayWidth??600));
    this.set1f('uSky',1);
  }
}
export function createBlackHole(scene:Phaser.Scene){
  const renderer=scene.game.renderer;
  // Canvas/low precision devices keep the previously verified static asset.
  if(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !unsupported.has(renderer) &&
     renderer.gl.getShaderPrecisionFormat(renderer.gl.FRAGMENT_SHADER,renderer.gl.HIGH_FLOAT)?.precision){
    if(!renderer.pipelines.has(KEY)){
      const error=checkVisualShader(renderer.gl,fragment);
      if(error){unsupported.add(renderer);console.warn('动态黑洞不可用，回退静态画面：',error);return scene.add.image(0,0,'black-hole');}
    }
    // Data lookup must sample the original level, never averaged mipmaps.
    scene.textures.get('black-hole-orbits').setFilter(Phaser.Textures.FilterMode.LINEAR);
    if(!renderer.pipelines.has(KEY))renderer.pipelines.add(KEY,new BlackHolePipeline(scene.game));
    return scene.add.image(0,0,'black-hole-orbits').setPipeline(KEY);
  }
  return scene.add.image(0,0,'black-hole');
}
export function updateBlackHole(image:Phaser.GameObjects.Image,time:number){
  if(image.pipeline instanceof BlackHolePipeline)image.pipeline.clock=time;
}
