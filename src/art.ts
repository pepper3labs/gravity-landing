import Phaser from 'phaser';

/** Textures are generated once. No per-frame gradients, filters, or external assets. */
export function createArt(scene: Phaser.Scene) {
  const planet = scene.textures.createCanvas('planet', 1400, 1400)!;
  const c = planet.context, center=700, radius=650;
  const halo=c.createRadialGradient(center,center,642,center,center,697);
  halo.addColorStop(0,'#a0f4e633');halo.addColorStop(.18,'#80cfc540');halo.addColorStop(.5,'#398ca91c');halo.addColorStop(1,'#29789900');
  c.fillStyle=halo;c.fillRect(0,0,1400,1400);
  c.save();c.beginPath();c.arc(center,center,radius,0,Math.PI*2);c.clip();
  const ground=c.createLinearGradient(180,140,1150,1300);
  ground.addColorStop(0,'#426675');ground.addColorStop(.32,'#263f50');ground.addColorStop(.72,'#132436');ground.addColorStop(1,'#0a1423');
  c.fillStyle=ground;c.fillRect(0,0,1400,1400);
  let seed=842;
  const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  for(let i=0;i<260;i++){
    const x=random()*1400,y=random()*1400,r=3+random()*32;
    c.beginPath();c.ellipse(x,y,r,r*.75,random()*Math.PI,0,Math.PI*2);
    c.fillStyle='rgba(6,18,30,'+(.08+random()*.22)+')';c.fill();
    c.beginPath();c.arc(x,y,r,.8,3.8);c.strokeStyle='#9ec2c31b';c.lineWidth=1.3;c.stroke();
    c.beginPath();c.arc(x+2,y+3,r*.75,3.5,5.8);c.strokeStyle='#05142044';c.lineWidth=2;c.stroke();
  }
  for(let i=0;i<1400;i++){c.fillStyle=i%2?'#b8d6ce10':'#010b161f';c.fillRect(random()*1400,random()*1400,1+random()*3,1);}
  c.strokeStyle='#93c8c611';c.lineWidth=1;
  for(let i=0;i<11;i++){c.beginPath();c.ellipse(750,760,260+i*39,380+i*24,-.5,0,Math.PI*2);c.stroke();}
  const shade=c.createLinearGradient(250,160,1150,800);shade.addColorStop(0,'#030c1700');shade.addColorStop(.45,'#030c1720');shade.addColorStop(1,'#030c17cc');
  c.fillStyle=shade;c.fillRect(0,0,1400,1400);c.restore();
  c.beginPath();c.arc(center,center,radius,0,Math.PI*2);c.strokeStyle='#a5ded470';c.lineWidth=2;c.stroke();
  planet.refresh();

  // Small cached variants reuse the original lighting, with distinct geological marks.
  for(const type of ['rock','ice','volcanic']){
    const texture=scene.textures.createCanvas('planet-'+type,700,700)!,v=texture.context;
    v.drawImage(planet.canvas,0,0,700,700);v.save();v.beginPath();v.arc(350,350,325,0,Math.PI*2);v.clip();
    v.strokeStyle=type==='ice'?'#92dbea70':type==='volcanic'?'#ef925460':'#beaa8150';v.lineWidth=type==='ice'?1:2;
    for(let i=0;i<32;i++){
      const x=random()*700,y=random()*700;v.beginPath();v.moveTo(x,y);
      for(let j=1;j<5;j++)v.lineTo(x+j*12+random()*18,y+j*9+(random()-.5)*25);
      v.stroke();
    }
    if(type==='ice'){v.fillStyle='#a5d6f00c';v.fillRect(0,0,700,700);}
    v.restore();texture.refresh();
  }
  const ship=scene.textures.createCanvas('lander',192,256)!;
  const s=ship.context;s.translate(96,128);s.scale(6,6);
  const poly=(points:number[][],fill:string,stroke='#172637')=>{
    s.beginPath();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();s.fillStyle=fill;s.fill();s.strokeStyle=stroke;s.lineWidth=.45;s.stroke();
  };
  // Engine bell and armored side pods.
  poly([[-5,8],[5,8],[6,14],[-6,14]],'#687e8a');
  poly([[-4,10],[4,10],[4.5,13],[-4.5,13]],'#182837');
  poly([[-8,-3],[-12,1],[-11,10],[-7,11]],'#788d9b');
  poly([[8,-3],[12,1],[11,10],[7,11]],'#526a7c');
  const metal=s.createLinearGradient(-10,0,10,0);metal.addColorStop(0,'#f0f3e8');metal.addColorStop(.48,'#c4d6d6');metal.addColorStop(.54,'#95adb7');metal.addColorStop(1,'#667f90');
  s.beginPath();s.moveTo(0,-17);s.lineTo(8,-9);s.lineTo(10,3);s.lineTo(8,10);s.lineTo(-8,10);s.lineTo(-10,3);s.lineTo(-8,-9);s.closePath();s.fillStyle=metal;s.fill();s.strokeStyle='#dcebe1';s.lineWidth=.45;s.stroke();
  poly([[-5,-8],[0,-12],[5,-8],[5,-2],[-5,-2]],'#0b202f','#d9eee4');
  const glass=s.createLinearGradient(-4,-10,4,-2);glass.addColorStop(0,'#a1f0e7');glass.addColorStop(.4,'#368d9d');glass.addColorStop(1,'#163d58');
  s.fillStyle=glass;s.fillRect(-3.8,-7.5,7.6,4.5);
  s.strokeStyle='#d9fff7';s.lineWidth=.35;s.beginPath();s.moveTo(-3,-7);s.lineTo(1,-7);s.stroke();
  s.fillStyle='#e3ae5d';s.fillRect(-8,3,16,2.3);
  s.fillStyle='#203747';s.fillRect(-6,7,12,.7);s.fillRect(-1,-.5,2,2);
  for(const x of [-8,8]){s.fillStyle='#243849';s.fillRect(x-1,-2,2,2);s.fillStyle='#78e1d0';s.fillRect(x-.55,-1.5,1.1,1);}
  s.fillStyle='#eaf5e8';s.font='bold 2.1px sans-serif';s.textAlign='center';s.fillText('GL–01',0,1.5);
  ship.refresh();

  const haze=scene.textures.createCanvas('haze',512,768)!;const h=haze.context;
  const nebula=h.createRadialGradient(370,250,10,370,250,380);
  nebula.addColorStop(0,'#25495265');nebula.addColorStop(.4,'#19344930');nebula.addColorStop(1,'#0b142800');
  h.fillStyle=nebula;h.fillRect(0,0,512,768);haze.refresh();
}
