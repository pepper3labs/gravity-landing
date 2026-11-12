import type { StoragePort } from './progress';

export const SETTINGS_KEY='gravity-settings';
export interface Preferences { sound:boolean; vibration:boolean; lowEffects:boolean; controlMode:'buttons'|'tilt' }
export class GameSettings {
  data:Preferences={sound:true,vibration:true,lowEffects:false,controlMode:'buttons'};
  warning='';
  private readOnly=false;
  constructor(private storage?:StoragePort){
    try {
      const raw=storage?.getItem(SETTINGS_KEY);if(!raw)return;
      const value:unknown=JSON.parse(raw);
      if(!value||typeof value!=='object'||!('version' in value)||value.version!==1)throw new Error('version');
      const v=value as Record<string,unknown>;
      if(typeof v.sound!=='boolean'||typeof v.vibration!=='boolean'||typeof v.lowEffects!=='boolean')throw new Error('value');
      if(v.controlMode!==undefined&&v.controlMode!=='buttons'&&v.controlMode!=='tilt')throw new Error('controlMode');
      this.data={sound:v.sound,vibration:v.vibration,lowEffects:v.lowEffects,controlMode:v.controlMode??'buttons'};
    } catch {this.readOnly=true;this.warning='设置无法读取，本次使用临时设置；原数据已保留。';}
  }
  set<K extends keyof Preferences>(key:K,value:Preferences[K]){
    this.data={...this.data,[key]:value};
    if(this.readOnly)return;
    try {
      if(!this.storage)throw new Error('unavailable');
      this.storage.setItem(SETTINGS_KEY,JSON.stringify({version:1,...this.data}));this.warning='';
    } catch {this.warning='设置暂时无法保存，本次仍然生效。';}
  }
  reduced(systemReduced:boolean){return systemReduced||this.data.lowEffects;}
  canVibrate(systemReduced:boolean){return this.data.vibration&&!systemReduced;}
}
