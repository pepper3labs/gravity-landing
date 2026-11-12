// Explicit compatibility pair: dev.8 only adds an opt-in tilt speed limit.
// Historical inputs never enable it; strict terminal/score/trajectory checks still apply.
export const LEGACY_BUTTON_RULES='52c8119ddce00ebfac61b5f5ae08e800f2dda90ef12b9610154a4fcf65aa81a1';
const TILT_RATE_RULES='87dbdf819b0ffcb9663cab2c0b394ffaed0f4dc6a066e5beb396500ebe295cce';
const OBSERVATORY_RULES='c821ea6d9a9b84c42e9964aee21d40114ec302f68251a29130e4d7843117c6cb';
export function compatibleButtonRules(recorded:string,current:string){
 return recorded===current||(recorded===LEGACY_BUTTON_RULES&&current===TILT_RATE_RULES)||
  ([LEGACY_BUTTON_RULES,TILT_RATE_RULES].includes(recorded)&&current===OBSERVATORY_RULES);
}
