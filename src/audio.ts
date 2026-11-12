/** Small synthesized sound bank: no downloads, one shared context, bounded voices. */
export class FlightAudio {
  context?: AudioContext; master?: GainNode; engineGain?: GainNode; engineFilter?: BiquadFilterNode;
  enabled = true; ready = false; voices = 0; lastWarning = -10; lastAttitude = -1;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      const c = this.context;
      this.master = c.createGain(); this.master.gain.value = this.enabled ? .36 : 0; this.master.connect(c.destination);
      const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const samples = noise.getChannelData(0);
      for(let i=0;i<samples.length;i++) samples[i] = Math.random()*2-1;
      const source = c.createBufferSource(); source.buffer=noise; source.loop=true;
      this.engineFilter=c.createBiquadFilter(); this.engineFilter.type='lowpass'; this.engineFilter.frequency.value=220;
      this.engineGain=c.createGain(); this.engineGain.gain.value=0;
      source.connect(this.engineFilter); this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master); source.start();
      const low=c.createOscillator(); low.type='sawtooth'; low.frequency.value=43;
      const bass=c.createGain(); bass.gain.value=.18; low.connect(bass);bass.connect(this.engineGain);low.start();
    }
    try { await this.context.resume(); this.ready=true; } catch { this.ready=false; }
  }
  setEnabled(enabled:boolean) { this.enabled=enabled;if(this.context&&this.master)this.master.gain.setTargetAtTime(this.enabled?.36:0,this.context.currentTime,.04); }
  engine(power:number) {
    if(!this.context||!this.engineGain||!this.engineFilter)return;
    this.engineGain.gain.setTargetAtTime(power*.65,this.context.currentTime,.07);
    this.engineFilter.frequency.setTargetAtTime(180+power*650,this.context.currentTime,.08);
  }
  attitude(turn:number) {
    if(!turn||!this.context||this.context.currentTime-this.lastAttitude<.14)return;
    this.lastAttitude=this.context.currentTime;this.tone(turn>0?720:660,.08,.035,'triangle',0,210);
  }
  tone(frequency:number,duration:number,volume=.2,type:OscillatorType='sine',delay=0,endFrequency=frequency) {
    if(!this.context||!this.master||!this.enabled||this.voices>=16)return;
    const c=this.context,at=c.currentTime+delay,osc=c.createOscillator(),gain=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,at);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),at+duration);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.01);gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    osc.connect(gain);gain.connect(this.master);osc.start(at);osc.stop(at+duration+.02);this.voices++;
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};
  }
  cue(kind:'launch'|'contact'|'break'|'failed'|'won'|'recovery'|'click'|'warning',strength=1) {
    if(kind==='click')this.tone(520,.07,.1);
    if(kind==='launch'){this.tone(65,.5,.3,'sawtooth',0,130);this.tone(800,.16,.08);}
    if(kind==='contact'){this.tone(90,.22,Math.min(.5,.1+strength*.3),'triangle',0,28);this.tone(280,.08,.12,'sine',0,65);}
    if(kind==='break'){this.tone(160,.34,.35,'sawtooth',0,25);this.tone(1300,.1,.16,'square',0,180);}
    if(kind==='failed'){this.tone(100,.7,.6,'sawtooth',0,20);this.tone(400,.6,.1,'triangle',.2,80);}
    if(kind==='won') [523,659,784,1047].forEach((f,i)=>this.tone(f,.45,.17,'sine',i*.14));
    if(kind==='recovery'){this.tone(440,.2,.13);this.tone(660,.3,.13,'sine',.15);}
    if(kind==='warning'&&this.context&&this.context.currentTime-this.lastWarning>2.5){this.lastWarning=this.context.currentTime;this.tone(630,.1,.12,'triangle');this.tone(630,.1,.1,'triangle',.16);}
  }
}
