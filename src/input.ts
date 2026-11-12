export class FlightInput {
  keys = new Set<string>();
  pointers = {left:new Set<number>(),right:new Set<number>(),thrust:new Set<number>()};
  private screenPointers=new Set<number>();
  constructor(private allowed:()=>boolean, private activate:()=>void, private shortcut:(key:string)=>void,
    private tilt?:{active:()=>boolean;ready:()=>boolean;turn:()=>number;clear:()=>void}) {
    for (const id of ['left','right','thrust'] as const) {
      const button=document.getElementById(id)!;
      button.addEventListener('pointerdown',e=>{
        if(this.tilt?.active())return;
        e.preventDefault();if(!this.allowed())return;this.activate();
        button.setPointerCapture(e.pointerId);this.pointers[id].add(e.pointerId);this.paint();
      });
      for(const name of ['pointerup','pointercancel','lostpointercapture'])
        button.addEventListener(name,e=>{this.pointers[id].delete((e as PointerEvent).pointerId);this.paint();});
      button.addEventListener('contextmenu',e=>e.preventDefault());
    }
    document.getElementById('shell')?.addEventListener('pointerdown',e=>{
      if(!this.tilt?.active()||!this.tilt.ready()||!this.allowed())return;
      const target=e.target as Element;
      if(target.closest('button,a,input,select,dialog,#overlay,#intro'))return;
      e.preventDefault();this.activate();
      try{document.getElementById('shell')!.setPointerCapture(e.pointerId);}catch{return;}
      this.screenPointers.add(e.pointerId);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(event,e=>{this.screenPointers.delete((e as PointerEvent).pointerId);});
    window.addEventListener('keydown',e=>{
      const key=e.key.toLowerCase();
      if(['arrowup','arrowleft','arrowright',' '].includes(key))e.preventDefault();
      if(e.repeat)return;
      if(['r','p','escape','m'].includes(key)){this.shortcut(key);return;}
      if(this.allowed()){this.activate();this.keys.add(key);this.paint();}
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.key.toLowerCase());this.paint();});
  }
  get thrust(){return (this.tilt?.active()?this.tilt.ready()&&this.screenPointers.size>0:this.pointers.thrust.size>0)||this.keys.has('w')||this.keys.has('arrowup')||this.keys.has(' ');}
  get left(){return this.pointers.left.size>0||this.keys.has('a')||this.keys.has('arrowleft');}
  get right(){return this.pointers.right.size>0||this.keys.has('d')||this.keys.has('arrowright');}
  get turn(){const manual=Number(this.right)-Number(this.left);return manual||(this.tilt?.active()?this.tilt.turn():0);}
  clear(resetTilt=true){this.keys.clear();this.screenPointers.clear();if(resetTilt)this.tilt?.clear();Object.values(this.pointers).forEach(s=>s.clear());this.paint();}
  paint(){for(const id of ['left','right','thrust'] as const){document.getElementById(id)?.classList.toggle('held',this[id]);}}
}
