/* ===== Sonido sintetizado (Web Audio) ===== */
'use strict';
const Sfx={ctx:null,vol:0.6,master:null,sirenOsc:null,
  init(){ if(this.ctx) return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=this.vol; this.master.connect(this.ctx.destination);}catch(e){ this.ctx=null; } },
  setVol(v){ this.vol=v; if(this.master) this.master.gain.value=v; },
  tone(f,d,type='sine',v=0.2,when=0,slide=0){ if(!this.ctx) return; const t=this.ctx.currentTime+when, o=this.ctx.createOscillator(), g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+d+0.02); },
  noise(d,v=0.15,hp=800){ if(!this.ctx) return; const n=this.ctx.sampleRate*d, b=this.ctx.createBuffer(1,n,this.ctx.sampleRate), a=b.getChannelData(0); for(let i=0;i<n;i++) a[i]=(Math.random()*2-1)*(1-i/n); const s=this.ctx.createBufferSource(); s.buffer=b; const f=this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; const g=this.ctx.createGain(); g.gain.value=v; s.connect(f); f.connect(g); g.connect(this.master); s.start(); },
  step(metal){ metal?this.tone(1800,0.05,'square',0.03):this.noise(0.04,0.03,2500); },
  spotted(){ this.tone(520,0.12,'square',0.12); this.tone(780,0.18,'square',0.12,0.1); },
  curious(){ this.tone(440,0.1,'triangle',0.1); this.tone(560,0.14,'triangle',0.08,0.09); },
  emp(){ this.tone(900,0.4,'sawtooth',0.12,0,-800); this.noise(0.3,0.12,300); },
  throwIt(){ this.tone(300,0.1,'triangle',0.08,0,200); },
  land(){ this.tone(1400,0.08,'square',0.06); this.tone(1100,0.08,'square',0.05,0.06); },
  hackTick(){ this.tone(1200+Math.random()*400,0.03,'square',0.03); },
  hacked(){ [660,880,1320].forEach((f,i)=>this.tone(f,0.12,'triangle',0.1,i*0.07)); },
  pickup(){ this.tone(980,0.08,'sine',0.1); this.tone(1470,0.12,'sine',0.1,0.06); },
  caught(){ [400,300,200,130].forEach((f,i)=>this.tone(f,0.22,'sawtooth',0.12,i*0.12)); },
  win(){ [523,659,784,1046,1318].forEach((f,i)=>this.tone(f,0.25,'triangle',0.12,i*0.09)); },
  click(){ this.tone(700,0.04,'square',0.05); },
  alarm(on){ if(!this.ctx) return; if(on&&!this.sirenOsc){ const o=this.ctx.createOscillator(), g=this.ctx.createGain(), l=this.ctx.createOscillator(), lg=this.ctx.createGain(); o.type='sawtooth'; o.frequency.value=600; l.frequency.value=1.6; lg.gain.value=220; l.connect(lg); lg.connect(o.frequency); g.gain.value=0.05; o.connect(g); g.connect(this.master); o.start(); l.start(); this.sirenOsc=[o,l,g]; } else if(!on&&this.sirenOsc){ const [o,l]=this.sirenOsc; o.stop(); l.stop(); this.sirenOsc=null; } }
};
