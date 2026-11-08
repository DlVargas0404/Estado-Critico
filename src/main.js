/* ===== Interfaz, pantallas y bucle principal ===== */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const Save={key:'estadoCritico.v1',data:{unlocked:1,stars:{},volume:0.6,slow:0.35,hintsSeen:{}},
  load(){ try{ const r=localStorage.getItem(this.key); if(r) this.data={...this.data,...JSON.parse(r)}; }catch(e){} },
  save(){ try{ localStorage.setItem(this.key,JSON.stringify(this.data)); }catch(e){} }};
const App={screen:'menu',world:null,levelIdx:0,automata:false,paused:false,selIdx:0,keys:{},throwAim:null,lastTime:0,demo:null,ticker:[],hintQ:[],hintT:0,touch:{mx:0,my:0,hack:false,sneak:false},lastSel:null,lastRegAt:0};
let R=null, demoR=null;

function show(id){ $$('.screen').forEach(s=>s.hidden=true); if(id) $('#'+id).hidden=false; App.screen=id; document.body.dataset.screen=id||'game'; }
function overlay(id){ $$('.overlay').forEach(o=>o.hidden=true); if(id) $('#'+id).hidden=false; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- Menú con demo viva ---------- */
function startDemo(){
  App.demo=new Game.World(LEVELS[1]); App.demo.player.x=-9999; App.demo.player.y=-9999;
  demoR=new Renderer($('#demo')); demoR.buildBackground(App.demo); resizeDemo();
  App.demo.guards.concat(App.demo.cameras).forEach(e=>e.m.alSuceder(r=>{ App.ticker.unshift(`${e.id} · δ(${r.desde}, ${r.simbolo}) = ${r.hacia}`); App.ticker.length=Math.min(App.ticker.length,4); }));
  // ruido periódico para que los guardias cambien de estado en la demo
  App.demoNoiseT=2;
}
function resizeDemo(){ if(demoR) demoR.resize(window.innerWidth,window.innerHeight); }
function renderLevels(){
  const box=$('#level-list'); box.innerHTML='';
  LEVELS.forEach((l,i)=>{
    const locked=i>Save.data.unlocked-1, st=Save.data.stars[l.id]||0;
    const b=document.createElement('button'); b.className='level-card'; b.disabled=locked;
    b.innerHTML=`<span class="lv-num">${i===0?'Tutorial':'Nivel '+i}</span><span class="lv-name">${esc(l.nombre)}</span><span class="lv-sub">${esc(l.subtitulo)}</span>
      <span class="lv-meta">${l.guardias.length} centinela${l.guardias.length>1?'s':''}${l.camaras.length?` · ${l.camaras.length} cámara${l.camaras.length>1?'s':''}`:''}${l.drones.length?` · ${l.drones.length} dron${l.drones.length>1?'es':''}`:''}</span>
      <span class="stars" aria-label="${st} de 3 estrellas">${'★'.repeat(st)}${'☆'.repeat(3-st)}</span>${locked?'<span class="lock">Bloqueado</span>':''}`;
    b.onclick=()=>{ Sfx.click(); startLevel(i); };
    box.appendChild(b);
  });
}

/* ---------- Juego ---------- */
function startLevel(i){
  App.levelIdx=i; App.world=new Game.World(LEVELS[i]); R.buildBackground(App.world);
  App.automata=false; App.paused=false; App.selIdx=0; App.lastSel=null; toggleAutomata(false);
  show(null); overlay(null); $('#hud').hidden=false; resize();
  $('#hud-level').textContent=(i===0?'Tutorial':'Nivel '+i)+' · '+LEVELS[i].nombre;
  App.hintQ=[...LEVELS[i].consejos]; App.hintT=0.5; Sfx.alarm(false);
  buildEnemyTabs();
}
function buildEnemyTabs(){
  const tabs=$('#ap-tabs'); tabs.innerHTML='';
  App.world.enemies.forEach((e,i)=>{ const b=document.createElement('button'); b.textContent=e.id; b.onclick=()=>selectEnemy(i); tabs.appendChild(b); });
  selectEnemy(0);
}
function selectEnemy(i){
  const w=App.world; if(!w||!w.enemies.length) return; App.selIdx=(i+w.enemies.length)%w.enemies.length;
  const e=w.enemies[App.selIdx]; R.selected=e; $$('#ap-tabs button').forEach((b,k)=>b.setAttribute('aria-pressed',k===App.selIdx));
  buildDeltaTable($('#ap-delta'),e.m.def); App.lastSel=undefined; updatePanel(true);
}
function buildDeltaTable(tbl,def){
  const alf=def.alfabeto; let h='<thead><tr><th>δ</th>'+alf.map(s=>`<th title="${esc((Core.SYM_INFO[s]||{}).desc||s)}">${s}</th>`).join('')+'</tr></thead><tbody>';
  const d={}; for(const t of def.transiciones) if(!(t.desde+'|'+t.simbolo in d)) d[t.desde+'|'+t.simbolo]=t.hacia;
  for(const q of def.estados) h+=`<tr data-q="${q.id}"><th>${q.id}</th>`+alf.map(s=>`<td data-k="${q.id}|${s}" class="${d[q.id+'|'+s]===q.id?'loop':''}">${d[q.id+'|'+s]||'—'}</td>`).join('')+'</tr>';
  tbl.innerHTML=h+'</tbody>';
}
function highlightDelta(tbl,cur,last){
  tbl.querySelectorAll('tr').forEach(r=>r.classList.toggle('cur',r.dataset.q===cur));
  tbl.querySelectorAll('td.hit').forEach(c=>c.classList.remove('hit'));
  if(last){ const c=tbl.querySelector(`td[data-k="${last.desde}|${last.simbolo}"]`); if(c) c.classList.add('hit'); }
}
function updatePanel(force){
  if(!App.automata&&!force) return; const w=App.world; if(!w) return;
  const e=w.enemies[App.selIdx]; if(!e) return; const m=e.m, last=m.ultima;
  if(last!==App.lastSel){ App.lastSel=last; App.lastRegAt=performance.now();
    const st=m.estados[m.actual];
    $('#ap-state').innerHTML=`<span class="dot" style="background:${st.color}"></span>${st.id} · ${esc(st.nombre)}`;
    $('#ap-type').textContent=m.def.tipo==='moore'?'Máquina de Moore':'Máquina de Mealy';
    $('#ap-last').innerHTML=last?`δ(${last.desde}, <b>${last.simbolo}</b>) = ${last.hacia}<span class="out">λ: ${esc(last.salida)}</span>`:'Sin transiciones todavía';
    const tr=m.traza.slice(-14);
    $('#ap-w').textContent=tr.length?tr.map(r=>r.simbolo).join(' '):'ε';
    $('#ap-path').textContent=tr.length?[tr[0].desde,...tr.map(r=>r.hacia)].join(' → '):m.actual;
    highlightDelta($('#ap-delta'),m.actual,last);
  }
  drawAutomaton($('#ap-diagram'),m.def,m.actual,last,(performance.now()-App.lastRegAt)/1000);
}
function toggleAutomata(v){
  App.automata=v===undefined?!App.automata:v; document.body.classList.toggle('automata',App.automata);
  $('#automata-panel').hidden=!App.automata; $('#btn-automata').setAttribute('aria-pressed',App.automata);
  if(R){ resize(); } if(App.automata) updatePanel(true);
}
function hudUpdate(){
  const w=App.world, p=w.player, done=w.terminals.filter(t=>t.done).length;
  $('#hud-term').textContent=`${done}/${w.terminals.length}`; $('#hud-emp').textContent=p.emp;
  $('#hud-dis').textContent=p.distractCd>0?p.distractCd.toFixed(1)+' s':'listo';
  const t=Math.floor(w.time); $('#hud-time').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  $('#hud-alarm').hidden=!(w.alarmT>0); $('#hud-sneak').hidden=!p.sneak;
}
const TOUCH=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
function touchText(t){ if(!TOUCH) return t; return t.replace('con WASD o las flechas','con la palanca').replace('Mantén Shift','Activa Sigilo').replace('Pulsa Tab','Pulsa el botón Autómata').replace('mantén E','mantén Copiar').replace('Q lanza','El botón EMP lanza').replace('F lanza','Lanzar arroja'); }
function showHint(txt){ txt=touchText(txt); const h=$('#hint'); h.textContent=txt; h.hidden=false; h.classList.remove('in'); void h.offsetWidth; h.classList.add('in'); }
function processEvents(w){
  for(const ev of w.events){
    switch(ev.type){
      case 'step': if(Math.random()<0.6) Sfx.step(ev.metal); break;
      case 'spotted': Sfx.spotted(); R.shake=5; break;
      case 'transition': if(ev.reg.cambio&&ev.reg.hacia==='INV') Sfx.curious(); break;
      case 'emp': Sfx.emp(); R.shake=4; break;
      case 'throw': Sfx.throwIt(); break;
      case 'noise': if(ev.noise.src==='distractor') Sfx.land(); break;
      case 'hacked': Sfx.hacked(); showHint(w.terminals.every(t=>t.done)?'Datos copiados. La salida está abierta.':'Terminal copiada. Quedan '+w.terminals.filter(t=>!t.done).length+'.'); break;
      case 'pickup': Sfx.pickup(); showHint('+1 carga EMP'); break;
      case 'alarm': R.shake=8; showHint(`¡Alarma! ${ev.enemy.id} envió el símbolo g a los centinelas.`); break;
      case 'caught': onCaught(ev.enemy); break;
      case 'won': onWon(); break;
    }
  }
  Sfx.alarm(w.alarmT>0&&w.state==='playing');
  if(w.player.hacking && Math.random()<0.2) Sfx.hackTick();
}
function onCaught(e){
  Sfx.caught(); Sfx.alarm(false); R.shake=10;
  setTimeout(()=>{
    overlay('ov-caught');
    const tr=e.m.traza.slice(-6);
    $('#caught-who').textContent=`Te atrapó ${e.id}.`;
    $('#caught-trace').innerHTML=tr.map(r=>`<li><code>δ(${r.desde}, ${r.simbolo}) = ${r.hacia}</code><span>${esc((Core.SYM_INFO[r.simbolo]||{}).desc||'')}</span></li>`).join('');
    $('#caught-w').textContent=`w = ${tr.map(r=>r.simbolo).join('')}   ⇒   δ*(${tr.length?tr[0].desde:'PAT'}, w) = ${e.m.actual}`;
  },600);
}
function onWon(){
  Sfx.win(); Sfx.alarm(false);
  const w=App.world, ch=Game.makeChallenge(); App.challenge=ch; App.challengeOk=false;
  $('#win-stats').innerHTML=`<div><b>${Math.floor(w.time)} s</b><span>tiempo</span></div><div><b>${w.stats.spotted}</b><span>veces visto</span></div><div><b>${w.stats.alarms}</b><span>alarmas</span></div><div><b>${w.stats.emp}</b><span>EMP usados</span></div>`;
  $('#ch-q').innerHTML=`Un centinela está en <b>${ch.q0}</b> y recibe la cadena <code>w = ${ch.w.split('').join(' ')}</code>. ¿Cuál es δ*(${ch.q0}, w)?`;
  const box=$('#ch-opts'); box.innerHTML=''; $('#ch-explain').hidden=true; $('#win-next').hidden=true;
  ch.options.forEach(o=>{ const b=document.createElement('button'); b.textContent=o; b.onclick=()=>answer(o,b); box.appendChild(b); });
  updateStars(false); overlay('ov-win');
}
function answer(o,btn){
  const ch=App.challenge; $$('#ch-opts button').forEach(b=>{ b.disabled=true; if(b.textContent===ch.answer) b.classList.add('ok'); });
  App.challengeOk=o===ch.answer; if(!App.challengeOk) btn.classList.add('bad');
  $('#ch-explain').hidden=false;
  $('#ch-explain').innerHTML=(App.challengeOk?'<b>¡Correcto!</b> ':'<b>No es correcto.</b> ')+'Recorrido: '+ch.pasos.map(p=>`δ(${p.desde}, ${p.simbolo}) = ${p.hacia}`).join(' → ');
  App.challengeOk?Sfx.hacked():Sfx.click(); updateStars(true);
}
function updateStars(final){
  const w=App.world; let st=1+(w.stats.alarms===0?1:0)+(App.challengeOk?1:0);
  $('#win-stars').innerHTML=`<span class="${'on'}">★</span><span class="${w.stats.alarms===0?'on':''}" title="Sin alarmas">★</span><span class="${App.challengeOk?'on':''}" title="Desafío correcto">★</span>`;
  if(final){ const id=LEVELS[App.levelIdx].id; Save.data.stars[id]=Math.max(Save.data.stars[id]||0,st); Save.data.unlocked=Math.max(Save.data.unlocked,Math.min(LEVELS.length,App.levelIdx+2)); Save.save(); $('#win-next').hidden=false; $('#win-next').textContent=App.levelIdx<LEVELS.length-1?'Siguiente nivel':'Volver al menú'; }
}

/* ---------- Entrada ---------- */
const KEYMAP={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'sneak',ShiftRight:'sneak',KeyE:'hack',Space:'hack'};
window.addEventListener('keydown',e=>{
  Sfx.init();
  if(App.screen===null && App.world){
    if(KEYMAP[e.code]){ App.keys[KEYMAP[e.code]]=true; e.preventDefault(); }
    if(e.code==='KeyQ') App.empQ=true;
    if(e.code==='KeyF') App.throwQ=true;
    if(e.code==='Tab'||e.code==='F1'){ e.preventDefault(); toggleAutomata(); }
    if(e.code==='BracketRight'||e.code==='KeyX'){ selectEnemy(App.selIdx+1); }
    if(e.code==='BracketLeft'||e.code==='KeyZ'){ selectEnemy(App.selIdx-1); }
    if(e.code==='Escape'||e.code==='KeyP'){ if(App.world.state==='playing') togglePause(); }
    if(e.code==='KeyR' && App.world.state==='caught') startLevel(App.levelIdx);
  }
});
window.addEventListener('keyup',e=>{ if(KEYMAP[e.code]) App.keys[KEYMAP[e.code]]=false; });
window.addEventListener('blur',()=>{ App.keys={}; });
function togglePause(v){ App.paused=v===undefined?!App.paused:v; overlay(App.paused?'ov-pause':null); if(App.paused) Sfx.alarm(false); }
function canvasPoint(ev){ const r=$('#game').getBoundingClientRect(); return {x:(ev.clientX-r.left)/R.scale,y:(ev.clientY-r.top)/R.scale}; }
function setupPointer(){
  const cv=$('#game');
  cv.addEventListener('pointermove',ev=>{ if(ev.pointerType==='mouse') App.throwAim=canvasPoint(ev); });
  cv.addEventListener('pointerdown',ev=>{
    Sfx.init(); if(!App.world) return; const pt=canvasPoint(ev);
    let best=-1,bd=30; App.world.enemies.forEach((e,i)=>{ const d=Math.hypot(e.x-pt.x,e.y-pt.y); if(d<bd){bd=d;best=i;} });
    if(best>=0){ selectEnemy(best); if(!App.automata) toggleAutomata(true); }
    else if(ev.pointerType==='mouse' && ev.button===0){ App.throwAim=pt; App.throwQ=true; }
  });
  // controles táctiles
  const joy=$('#joy'), knob=$('#joy-knob'); let jid=null, jc=null;
  joy.addEventListener('pointerdown',ev=>{ Sfx.init(); jid=ev.pointerId; joy.setPointerCapture(jid); const r=joy.getBoundingClientRect(); jc={x:r.left+r.width/2,y:r.top+r.height/2,R:r.width/2}; moveJoy(ev); });
  joy.addEventListener('pointermove',ev=>{ if(ev.pointerId===jid) moveJoy(ev); });
  const endJoy=ev=>{ if(ev.pointerId!==jid) return; jid=null; App.touch.mx=0; App.touch.my=0; knob.style.transform=''; };
  joy.addEventListener('pointerup',endJoy); joy.addEventListener('pointercancel',endJoy);
  function moveJoy(ev){ let dx=ev.clientX-jc.x, dy=ev.clientY-jc.y; const l=Math.hypot(dx,dy), m=jc.R*0.8; if(l>m){dx=dx/l*m;dy=dy/l*m;} knob.style.transform=`translate(${dx}px,${dy}px)`; App.touch.mx=dx/m; App.touch.my=dy/m; }
  const hold=(id,key)=>{ const b=$(id); b.addEventListener('pointerdown',e=>{ e.preventDefault(); Sfx.init(); App.touch[key]=true; }); ['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,()=>App.touch[key]=false)); };
  hold('#t-hack','hack');
  $('#t-sneak').addEventListener('click',()=>{ App.touch.sneak=!App.touch.sneak; $('#t-sneak').setAttribute('aria-pressed',App.touch.sneak); });
  $('#t-emp').addEventListener('click',()=>{ App.empQ=true; });
  $('#t-throw').addEventListener('click',()=>{ App.throwAim=null; App.throwQ=true; });
  $('#t-auto').addEventListener('click',()=>toggleAutomata());
}
function readInput(){
  const k=App.keys, t=App.touch;
  let mx=(k.right?1:0)-(k.left?1:0)+t.mx, my=(k.down?1:0)-(k.up?1:0)+t.my;
  const inp={mx,my,sneak:k.sneak||t.sneak,hack:k.hack||t.hack,emp:App.empQ,throw:App.throwQ};
  if(App.throwQ&&App.throwAim){ inp.tx=App.throwAim.x; inp.ty=App.throwAim.y; }
  App.empQ=false; App.throwQ=false; return inp;
}

/* ---------- Bucle ---------- */
function resize(){
  const stage=$('#stage'), r=stage.getBoundingClientRect();
  R.resize(Math.max(200,r.width),Math.max(150,r.height)); resizeDemo();
}
function loop(ts){
  const dt=Math.min(0.05,(ts-(App.lastTime||ts))/1000); App.lastTime=ts;
  if(App.screen==='menu'||App.screen==='levels'||App.screen==='howto'){
    const d=App.demo; if(d){ App.demoNoiseT-=dt; if(App.demoNoiseT<=0){ App.demoNoiseT=5+Math.random()*4; const fl=[]; for(let y=1;y<17;y++) for(let x=1;x<29;x++) if(d.grid[y][x]!=='#') fl.push([x,y]); const [x,y]=fl[Math.floor(Math.random()*fl.length)]; d.pendingNoise={x:(x+0.5)*32,y:(y+0.5)*32}; }
      d.update(dt,{}); if(d.pendingNoise){ d.emitNoise(d.pendingNoise.x,d.pendingNoise.y,7*32,'distractor'); d.pendingNoise=null; }
      demoR.draw(d,{}); $('#ticker').innerHTML=App.ticker.map((t,i)=>`<li style="opacity:${1-i*0.22}">${esc(t)}</li>`).join(''); }
  }
  const w=App.world;
  if(App.screen===null && w){
    if(!App.paused && w.state==='playing'){
      const scale=App.automata?Save.data.slow:1;
      w.update(dt*scale,readInput()); processEvents(w);
      if(App.hintQ.length){ App.hintT-=dt; if(App.hintT<=0){ showHint(App.hintQ.shift()); App.hintT=14.5; } }
      const near=w.terminals.find(t=>!t.done&&Game.dist(t,w.player)<Game.TILE*0.95);
      $('#ctx-hint').hidden=!near; if(near&&TOUCH) $('#ctx-hint').textContent='Mantén Copiar para extraer los datos'; 
    } else if(w.state!=='playing'){ w.update(dt,{}); }
    R.draw(w,{automataMode:App.automata}); hudUpdate(); updatePanel(false);
  }
  requestAnimationFrame(loop);
}

/* ---------- Laboratorio ---------- */
const Lab={def:null,m:null,trace:[],w:'',pos:0};
function labLoad(def){
  const v=Core.validar(def); Lab.def=def; Lab.trace=[]; Lab.pos=0;
  try{ Lab.m=new Core.MaquinaEstados(def); }catch(e){ Lab.m=null; }
  $('#lab-json').value=JSON.stringify(stripLayout(def),null,1);
  $('#lab-title').textContent=def.nombre||def.id||'Autómata';
  $('#lab-kind').textContent=(def.tipo==='moore'?'Máquina de Moore':'Máquina de Mealy')+` · |Q| = ${def.estados.length} · |Σ| = ${def.alfabeto.length}`;
  const sb=$('#lab-syms'); sb.innerHTML='';
  def.alfabeto.forEach(s=>{ const b=document.createElement('button'); b.innerHTML=`<code>${esc(s)}</code><span>${esc((Core.SYM_INFO[s]||{}).nombre||s)}</span>`; b.title=(Core.SYM_INFO[s]||{}).desc||s; b.onclick=()=>labStep(s); sb.appendChild(b); });
  buildDeltaTable($('#lab-delta'),def); renderValidation(v); $('#lab-min').innerHTML=''; labRender();
}
function stripLayout(d){ const c={...d}; delete c.layout; return c; }
function renderValidation(v){
  const ok=(b,t)=>`<li class="${b?'ok':'bad'}">${b?'✔':'✘'} ${t}</li>`;
  $('#lab-valid').innerHTML=ok(v.determinista,'Determinista'+(v.determinista?'':': '+v.duplicados.map(d=>`(${d[0]}, ${d[1]})`).join(', ')))
    +ok(v.completo,'Completo'+(v.completo?'':': faltan '+v.faltantes.map(d=>`(${d[0]}, ${d[1]})`).join(', ')))
    +ok(!v.inalcanzables.length,'Alcanzables desde el estado inicial'+(v.inalcanzables.length?': sobran '+v.inalcanzables.join(', '):''))
    +ok(!v.simbolosInvalidos.length&&!v.estadosInvalidos.length,'Símbolos y estados declarados'+(v.simbolosInvalidos.length||v.estadosInvalidos.length?': '+[...v.simbolosInvalidos,...v.estadosInvalidos].join(', '):''));
  $('#lab-status').textContent=v.valido?'Autómata válido: puede ejecutarse.':'Autómata inválido: corrige los errores para ejecutarlo.';
  $('#lab-status').className=v.valido?'ok':'bad';
}
function labStep(s){
  if(!Lab.m){ $('#lab-status').textContent='No se puede ejecutar un autómata inválido.'; return; }
  if(!Lab.def.alfabeto.includes(s)){ $('#lab-status').textContent=`"${s}" no pertenece a Σ.`; $('#lab-status').className='bad'; return; }
  const r=Lab.m.procesar(s); Lab.trace.push(r); Sfx.click(); labRender();
}
function labRender(){
  const m=Lab.m, def=Lab.def; const last=Lab.trace[Lab.trace.length-1];
  drawAutomaton($('#lab-diagram'),def,m?m.actual:def.inicial,last,0.3);
  if(m){ highlightDelta($('#lab-delta'),m.actual,last); }
  $('#lab-cur').textContent=m?`Estado actual: ${m.actual}`:'—';
  $('#lab-trace').innerHTML=Lab.trace.length?Lab.trace.map((r,i)=>`<tr><td>${i+1}</td><td>${r.desde}</td><td><code>${esc(r.simbolo)}</code></td><td>${r.hacia}</td><td>${esc(r.salida)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Inyecta un símbolo o ejecuta una cadena.</td></tr>';
  $('#lab-wshow').textContent=Lab.trace.length?`δ*(${def.inicial}, ${Lab.trace.map(r=>r.simbolo).join('')}) = ${m.actual}`:`δ*(${def.inicial}, ε) = ${def.inicial}`;
}
function labReset(){ if(Lab.m) Lab.m.reiniciar(); Lab.trace=[]; Lab.pos=0; labRender(); }
function labParseW(){ const raw=$('#lab-w').value.trim(); if(!raw) return []; return raw.includes(' ')||raw.includes(',')?raw.split(/[\s,]+/).filter(Boolean):raw.split(''); }
function setupLab(){
  const sel=$('#lab-select');
  [['centinela','Centinela (Mealy)'],['camara','Cámara (Moore)'],['dron','Dron (Mealy)'],['defectuoso','Ejemplo defectuoso'],['redundante','Ejemplo con estados equivalentes']].forEach(([k,n])=>{ const o=document.createElement('option'); o.value=k; o.textContent=n; sel.appendChild(o); });
  sel.onchange=()=>labLoad(JSON.parse(JSON.stringify(Core.DEFS[sel.value])));
  $('#lab-run').onclick=()=>{ labReset(); const w=labParseW(); for(const s of w){ if(!Lab.m) break; if(!Lab.def.alfabeto.includes(s)){ $('#lab-status').textContent=`"${s}" no pertenece a Σ = {${Lab.def.alfabeto.join(', ')}}.`; $('#lab-status').className='bad'; break; } Lab.trace.push(Lab.m.procesar(s)); } labRender(); };
  $('#lab-next').onclick=()=>{ const w=labParseW(); if(Lab.pos===0) labReset(); if(Lab.pos<w.length){ labStep(w[Lab.pos]); Lab.pos++; } };
  $('#lab-reset').onclick=labReset;
  $('#lab-validate').onclick=()=>{ let d; try{ d=JSON.parse($('#lab-json').value); }catch(e){ $('#lab-status').textContent='JSON inválido: '+e.message; $('#lab-status').className='bad'; return; } d.layout=d.layout||((Core.DEFS[d.id]||{}).layout); d.nombre=d.nombre||d.id; if(d.estados) d.estados.forEach((e,i)=>e.color=e.color||['#5fbf73','#f2c94c','#f2994a','#eb5757','#b48ee6','#5aa7e6','#9aa5b1'][i%7]); const v=Core.validar(d); if(!d.estados||!d.alfabeto||!d.transiciones){ renderValidation(v); return; } labLoad(d); };
  $('#lab-minimize').onclick=()=>{ const r=Core.minimizar(Lab.def); const box=$('#lab-min');
    if(r.error){ box.innerHTML=`<p class="bad">${esc(r.error)}</p>`; return; }
    box.innerHTML=`<p>${r.esMinimo?'<b>El autómata ya es mínimo.</b>':`<b>Se puede reducir de ${r.original} a ${r.minimo} estados.</b>`} Clases de equivalencia (${r.iteraciones} refinamientos):</p><p class="classes">${r.bloques.map(b=>'{'+b.join(', ')+'}').join('  ')}</p>${r.eliminadosInalcanzables.length?`<p>Inalcanzables eliminados: ${r.eliminadosInalcanzables.join(', ')}</p>`:''}`; };
  labLoad(JSON.parse(JSON.stringify(Core.DEFS.centinela)));
}

/* ---------- Traza exportable ---------- */
function openTrace(){
  const w=App.world; const data={nivel:LEVELS[App.levelIdx].nombre,tiempo:+w.time.toFixed(2),enemigos:w.enemies.map(e=>({id:e.id,automata:e.m.def.id,estado:e.m.actual,cadena:e.m.cadena(),transiciones:e.m.traza.map(r=>({t:+r.tiempo.toFixed(2),desde:r.desde,simbolo:r.simbolo,hacia:r.hacia,salida:r.salida}))}))};
  $('#trace-text').value=JSON.stringify(data,null,1); togglePause(true); overlay('ov-trace');
}

/* ---------- Arranque ---------- */
function init(){
  Save.load(); Sfx.setVol(Save.data.volume);
  R=new Renderer($('#game')); setupPointer(); setupLab(); startDemo(); renderLevels(); show('menu');
  $('#btn-play').onclick=()=>{ Sfx.init(); Sfx.click(); renderLevels(); show('levels'); };
  $('#btn-lab').onclick=()=>{ Sfx.init(); Sfx.click(); show('lab'); requestAnimationFrame(labRender); };
  $('#btn-how').onclick=()=>{ Sfx.init(); Sfx.click(); show('howto'); };
  $('#btn-opts').onclick=()=>{ Sfx.init(); Sfx.click(); show('options'); };
  $$('[data-back]').forEach(b=>b.onclick=()=>{ Sfx.click(); show('menu'); });
  $('#btn-automata').onclick=()=>toggleAutomata();
  $('#btn-pause').onclick=()=>togglePause();
  $('#ap-close').onclick=()=>toggleAutomata(false);
  $('#ap-trace').onclick=openTrace;
  $('#p-resume').onclick=()=>togglePause(false);
  $('#p-restart').onclick=()=>startLevel(App.levelIdx);
  $$('.to-menu').forEach(b=>b.onclick=()=>{ App.world=null; Sfx.alarm(false); overlay(null); $('#hud').hidden=true; toggleAutomata(false); renderLevels(); show('levels'); });
  $('#c-retry').onclick=()=>startLevel(App.levelIdx);
  $('#win-next').onclick=()=>{ if(App.levelIdx<LEVELS.length-1) startLevel(App.levelIdx+1); else { App.world=null; overlay(null); $('#hud').hidden=true; show('menu'); } };
  $('#trace-copy').onclick=()=>{ const t=$('#trace-text'); t.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(e){} if(navigator.clipboard) navigator.clipboard.writeText(t.value).then(()=>{$('#trace-copy').textContent='Copiado';}).catch(()=>{}); if(ok) $('#trace-copy').textContent='Copiado'; };
  $('#trace-close').onclick=()=>{ $('#trace-copy').textContent='Copiar'; togglePause(false); };
  const vol=$('#opt-vol'); vol.value=Save.data.volume; vol.oninput=()=>{ Save.data.volume=+vol.value; Sfx.setVol(+vol.value); Save.save(); };
  const sl=$('#opt-slow'); sl.value=Save.data.slow; sl.oninput=()=>{ Save.data.slow=+sl.value; Save.save(); };
  $('#opt-reset').onclick=()=>{ Save.data.unlocked=1; Save.data.stars={}; Save.save(); renderLevels(); $('#opt-reset').textContent='Progreso borrado'; };
  window.addEventListener('resize',()=>{ if(App.world) resize(); resizeDemo(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&App.world&&App.world.state==='playing') togglePause(true); });
  requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded',init);
