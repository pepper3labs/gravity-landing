import {CONFIG} from './physics';
export const TILT_RATE={deadZone:4,fullTilt:30,maxSpeed:1.8,responseSeconds:.25};
/** Signal recovery never resumes flight by itself; resuming is a separate player action. */
export class TiltSafety {
 interrupted=false;
 check(enabled:boolean,fresh:boolean){if(enabled&&!fresh)this.interrupted=true;return this.interrupted;}
 resume(enabled:boolean,fresh:boolean){if(enabled&&!fresh){this.interrupted=true;return false;}this.interrupted=false;return true;}
 reset(){this.interrupted=false;}
}
/** Produce bounded attitude thrust, never directly change angle or collision impulses. */
export function tiltRateCommand(targetRate:number,omega:number):number {
 if(!Number.isFinite(targetRate)||!Number.isFinite(omega))return 0;
 const target=Math.max(-TILT_RATE.maxSpeed,Math.min(TILT_RATE.maxSpeed,targetRate));
 if(target===0&&Math.abs(omega)<.02)return 0;
 const next=omega+(target-omega)*(1-Math.exp(-CONFIG.step/TILT_RATE.responseSeconds));
 const command=(next*Math.exp(CONFIG.angularDamping*CONFIG.step)-omega)/(CONFIG.rotation*CONFIG.step);
 return Math.abs(command)<.01?0:Math.max(-1,Math.min(1,command));
}
/** Screen-relative tilt mapped continuously to target angular velocity. */
export class TiltState {
 private neutral:number|undefined;
 private angle:number|undefined;
 private last=-Infinity;
 private value=0;
 sample(beta:number|null,gamma:number|null,angle:number,now:number){
  if(beta===null||gamma===null||!Number.isFinite(beta)||!Number.isFinite(gamma))return;
  const radians=angle*Math.PI/180,position=gamma*Math.cos(radians)+beta*Math.sin(radians);
  if(this.angle!==angle){this.neutral=undefined;this.angle=angle;}
  if(this.neutral===undefined)this.neutral=position;
  const delta=position-this.neutral;
  this.value=Math.sign(delta)*Math.min(1,Math.max(0,(Math.abs(delta)-TILT_RATE.deadZone)/(TILT_RATE.fullTilt-TILT_RATE.deadZone)))*TILT_RATE.maxSpeed;
  this.last=now;
 }
 fresh(now:number){return now-this.last<1000;}
 targetRate(now:number){return this.fresh(now)?this.value:0;}
 clear(){this.last=-Infinity;this.value=0;}
 calibrate(){this.neutral=undefined;this.clear();}
}
export class TiltControl {
 readonly state=new TiltState();
 enabled=false;
 private serial=0;
 private listener:((event:DeviceOrientationEvent)=>void)|undefined;
 private pendingCancel:(()=>void)|undefined;
 constructor(private target:Window=window){}
 disable(){this.serial++;this.pendingCancel?.();this.pendingCancel=undefined;if(this.listener)this.target.removeEventListener('deviceorientation',this.listener);this.listener=undefined;this.enabled=false;this.state.calibrate();}
 async enable():Promise<void>{
  this.disable();const token=this.serial;
  const api=(this.target as unknown as {DeviceOrientationEvent?:{requestPermission?:()=>Promise<string>}}).DeviceOrientationEvent;
  if(!api)throw Error('当前设备或容器不支持倾斜操作，请使用按钮操作。');
  try{
   if(api.requestPermission&&await api.requestPermission()!=='granted')throw Error('未获得传感器权限，请使用按钮操作。');
   if(token!==this.serial)throw Error('已取消开启倾斜操作。');
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{this.pendingCancel=undefined;this.disable();reject(Error('未收到传感器数据，请检查权限或使用按钮操作。'));},3000);
    this.pendingCancel=()=>{clearTimeout(timer);reject(Error('已取消开启倾斜操作。'));};
    this.listener=event=>{
     const angle=this.target.screen?.orientation?.angle??(this.target as unknown as {orientation?:number}).orientation??0;
     this.state.sample(event.beta,event.gamma,angle,performance.now());
     if(this.state.fresh(performance.now())){clearTimeout(timer);this.pendingCancel=undefined;resolve();}
    };
    this.target.addEventListener('deviceorientation',this.listener);
   });
   if(token!==this.serial)throw Error('已取消开启倾斜操作。');
   this.enabled=true;
  }catch(error){if(token===this.serial)this.disable();throw error;}
 }
}
