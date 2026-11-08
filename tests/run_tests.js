/* Pruebas automatizadas: núcleo de autómatas, niveles y simulación del juego */
const Core=require('../src/core.js'), Game=require('../src/game.js'), LEVELS=require('../src/levels.js');
const results=[]; let current='';
function suite(n){ current=n; }
function test(id,name,fn){ const t0=process.hrtime.bigint(); let ok=true,msg=''; try{ fn(); }catch(e){ ok=false; msg=e.message; } results.push({suite:current,id,name,ok,msg,ms:Number(process.hrtime.bigint()-t0)/1e6}); }
function eq(a,b,m){ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error((m||'')+` esperado ${JSON.stringify(b)} y se obtuvo ${JSON.stringify(a)}`); }
function ok(c,m){ if(!c) throw new Error(m||'condición falsa'); }
const T=Game.TILE, C=t=>({x:(t[0]+0.5)*T,y:(t[1]+0.5)*T});
const DOC_DELTA={PAT:['PER','INV','PER','PAT','PAT','PAT','PAT','INV','ATU'],INV:['PER','INV','PER','INV','INV','REG','BUS','INV','ATU'],PER:['PER','PER','ATA','PER','BUS','PER','PER','PER','ATU'],
  ATA:['ATA','ATA','ATA','PER','BUS','ATA','ATA','ATA','ATU'],BUS:['PER','INV','PER','BUS','BUS','REG','BUS','BUS','ATU'],REG:['PER','INV','PER','REG','REG','REG','PAT','INV','ATU'],ATU:['ATU','ATU','ATU','ATU','ATU','BUS','ATU','ATU','ATU']};
const ORDER=['v','r','c','l','p','t','d','g','s'];
const hide=w=>{ w.player.x=-5000; w.player.y=-5000; };
const step=(w,sec,inp={})=>{ for(let i=0;i<Math.round(sec*60);i++){ w.update(1/60,inp); } };
const statesOf=e=>[e.m.def.inicial,...e.m.traza.filter(r=>r.cambio).map(r=>r.hacia)];

suite('Núcleo de autómatas');
test('U01','La tabla δ del Centinela coincide con el diseño (63 transiciones)',()=>{ let n=0; const m=new Core.MaquinaEstados(Core.DEFS.centinela);
  for(const q in DOC_DELTA) ORDER.forEach((s,j)=>{ eq(m.delta[q+'|'+s],DOC_DELTA[q][j],`δ(${q},${s})`); n++; }); eq(n,63); });
for(const k of ['centinela','camara','dron']) test('U02-'+k,`${Core.DEFS[k].nombre}: determinista, completo y sin inalcanzables`,()=>{ const v=Core.validar(Core.DEFS[k]); ok(v.valido,v.errores.join(';')); eq(v.inalcanzables,[]); });
test('U03','δ*(PAT, rdvclptd) = PAT con el recorrido del diseño',()=>{ const r=Core.deltaEstrella(Core.DEFS.centinela,'PAT','rdvclptd'); eq(r.final,'PAT'); eq(r.pasos.map(p=>p.hacia).join(''),'INVBUSPERATAPERBUSREGPAT'); });
test('U04','El validador detecta no determinismo, incompletitud e inalcanzables',()=>{ const v=Core.validar(Core.DEFS.defectuoso); ok(!v.valido); eq(v.duplicados,[['A','v']]); eq(v.faltantes,[['A','t'],['C','p'],['C','t']]); eq(v.inalcanzables,['C']); });
test('U05','El validador detecta símbolos y estados no declarados',()=>{ const d=JSON.parse(JSON.stringify(Core.DEFS.camara)); d.transiciones.push({desde:'BAR',simbolo:'z',hacia:'NADA',accion:'x'}); const v=Core.validar(d); ok(!v.valido); eq(v.simbolosInvalidos,['z']); eq(v.estadosInvalidos,['NADA']); });
test('U06','La máquina rechaza definiciones inválidas al construirse',()=>{ let lanz=false; try{ new Core.MaquinaEstados(Core.DEFS.defectuoso); }catch(e){ lanz=true; } ok(lanz); });
test('U07','La máquina rechaza símbolos fuera de Σ',()=>{ const m=new Core.MaquinaEstados(Core.DEFS.centinela); let lanz=false; try{ m.procesar('z'); }catch(e){ lanz=true; } ok(lanz); eq(m.actual,'PAT'); });
test('U08','Minimización: el Centinela, la Cámara y el Dron ya son mínimos',()=>{ for(const k of ['centinela','camara','dron']) ok(Core.minimizar(Core.DEFS[k]).esMinimo,k); });
test('U09','Minimización: fusiona estados equivalentes {P1, P2}',()=>{ const r=Core.minimizar(Core.DEFS.redundante); eq(r.minimo,2); ok(r.bloques.some(b=>b.join()==='P1,P2')); });
test('U10','Minimización elimina estados inalcanzables',()=>{ const d=JSON.parse(JSON.stringify(Core.DEFS.camara)); d.estados.push({id:'Z',nombre:'Z',salida:'luz_verde'}); for(const s of d.alfabeto) d.transiciones.push({desde:'Z',simbolo:s,hacia:'Z',accion:'x'}); const r=Core.minimizar(d); eq(r.eliminadosInalcanzables,['Z']); eq(r.minimo,3); });
test('U11','Determinismo: 10 000 cadenas aleatorias producen siempre el mismo recorrido',()=>{ let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let i=0;i<10000;i++){ let w=''; const n=1+Math.floor(rnd()*12); for(let j=0;j<n;j++) w+=ORDER[Math.floor(rnd()*9)]; const a=Core.deltaEstrella(Core.DEFS.centinela,'PAT',w), m=new Core.MaquinaEstados(Core.DEFS.centinela); for(const s of w) m.procesar(s); eq(m.actual,a.final,w); } });
test('U12','Prioridad de símbolos: s > c > v > p > l > g > r > d > t',()=>{ eq(Core.seleccionarSimbolo(['t','d','r','g','l','p','v','c','s']),'s'); eq(Core.seleccionarSimbolo(['t','v','r']),'v'); eq(Core.seleccionarSimbolo(['t','d']),'d'); eq(Core.seleccionarSimbolo([]),null); });
test('U13','Máquina de Moore: la salida depende solo del estado destino',()=>{ const m=new Core.MaquinaEstados(Core.DEFS.camara); eq(m.procesar('v').salida,'luz_amarilla'); eq(m.procesar('v').salida,'luz_amarilla'); eq(m.procesar('t').salida,'luz_roja_emitir_g'); });
test('U14','Máquina de Mealy: λ(PAT, d) = siguiente_punto y λ(ATA, t) = repetir_ataque',()=>{ const m=new Core.MaquinaEstados(Core.DEFS.centinela); eq(m.procesar('d').salida,'siguiente_punto'); m.procesar('c'); m.procesar('c'); eq(m.actual,'ATA'); eq(m.procesar('t').salida,'repetir_ataque'); });

suite('Niveles');
for(const L of LEVELS){
  test('N0'+L.id,`${L.nombre}: mapa 30×18 con borde cerrado, inicio, terminales y salida`,()=>{ eq(L.mapa.length,18); L.mapa.forEach((r,i)=>{ eq(r.length,30,'fila '+i); ok(r[0]==='#'&&r[29]==='#','borde fila '+i); }); ok(/^#+$/.test(L.mapa[0])&&/^#+$/.test(L.mapa[17]),'borde superior/inferior'); const s=L.mapa.join(''); eq((s.match(/P/g)||[]).length,1); eq((s.match(/X/g)||[]).length,1); ok((s.match(/T/g)||[]).length>=1); });
  test('N1'+L.id,`${L.nombre}: todas las terminales y la salida son alcanzables desde el inicio`,()=>{ const w=new Game.World(L); for(const t of [...w.terminals,w.exit]){ const p=w.astar(w.start,t); ok(p&&p.length,'sin camino a '+t.tx+','+t.ty); } });
  test('N2'+L.id,`${L.nombre}: las rutas de patrulla están sobre piso y son recorribles`,()=>{ const w=new Game.World(L); L.guardias.forEach((g,i)=>g.ruta.forEach((pt,j)=>{ ok(L.mapa[pt[1]][pt[0]]!=='#',`guardia ${i+1} punto ${j}`); const nx=g.ruta[(j+1)%g.ruta.length]; ok(w.astar(C(pt),C(nx)),`guardia ${i+1} tramo ${j}`); })); (L.camaras||[]).forEach(c=>ok(L.mapa[c.y][c.x]!=='#','cámara sobre muro')); });
}

suite('Simulación del juego');
for(const L of LEVELS) test('S0'+L.id,`${L.nombre}: 5 min sin jugador, sin errores y con transiciones válidas`,()=>{ const w=new Game.World(L); hide(w); const pos0=w.guards.map(g=>[g.x,g.y]); step(w,300);
  for(const e of w.enemies){ ok(Number.isFinite(e.x)&&Number.isFinite(e.y),'posición no finita'); for(const r of e.m.traza) eq(e.m.delta[r.desde+'|'+r.simbolo],r.hacia,'transición inválida'); }
  w.guards.forEach((g,i)=>{ ok(g.m.traza.filter(r=>r.simbolo==='d').length>=3,`${g.id} no completó su patrulla`); }); eq(w.state,'playing'); });
test('S10','Ruido cercano: ciclo completo PAT → INV → BUS → REG → PAT',()=>{ const w=new Game.World(LEVELS[0]); hide(w); step(w,1); const g=w.guards[0]; w.emitNoise(g.x+2*T,g.y,4*T,'distractor'); step(w,25); const s=statesOf(g); const i=s.indexOf('INV'); ok(i>0,'no investigó'); eq(s.slice(i,i+4),['INV','BUS','REG','PAT']); });
test('S11','Jugador visible: PAT → PER → ATA y captura',()=>{ const w=new Game.World(LEVELS[0]); step(w,0.5); const g=w.guards[0]; w.player.x=g.x+Math.cos(g.dir)*3*T; w.player.y=g.y+Math.sin(g.dir)*3*T; if(w.solid(w.player.x,w.player.y)){ w.player.x=g.x+Math.cos(g.dir)*1.5*T; w.player.y=g.y+Math.sin(g.dir)*1.5*T; } step(w,6); const s=statesOf(g); ok(s.includes('PER'),'no persiguió: '+s); ok(s.includes('ATA'),'no atacó: '+s); eq(w.state,'caught'); });
test('S12','Romper la línea de visión: PER → BUS (símbolo p)',()=>{ const w=new Game.World(LEVELS[0]); hide(w); step(w,0.5); const g=w.guards[0]; g.m.procesar('v'); g.lastSeen={x:g.x+3*T,y:g.y}; step(w,0.2); const s=statesOf(g); eq(s.slice(-2),['PER','BUS']); eq(g.m.traza[g.m.traza.length-1].simbolo,'p'); });
test('S13','EMP: s → ATU y, tras 4 s, t → BUS',()=>{ const w=new Game.World(LEVELS[0]); step(w,0.5); const g=w.guards[0]; w.player.x=g.x-1.5*T; w.player.y=g.y; if(w.solid(w.player.x,w.player.y)) w.player.x=g.x+1.5*T; w.update(1/60,{emp:true}); w.update(1/60,{}); eq(g.m.actual,'ATU'); hide(w); step(w,4.2); ok(['BUS','REG','PAT','INV'].includes(g.m.actual)); ok(statesOf(g).join(',').includes('ATU,BUS'),'no pasó a BUS'); eq(w.player.emp,1); });
test('S14','Alarma de cámara: BAR → DET → ALA y los centinelas reciben g',()=>{ const w=new Game.World(LEVELS[1]); step(w,0.2); const c=w.cameras[0]; c.phase=0; w.player.x=c.x+Math.cos(c.dir)*3*T; w.player.y=c.y+Math.sin(c.dir)*3*T; for(let i=0;i<120;i++){ c.dir=c.base; w.update(1/60,{}); if(c.m.actual==='ALA') break; } eq(statesOf(c).slice(0,3),['BAR','DET','ALA']); hide(w); step(w,0.1); ok(w.guards.every(g=>g.m.traza.some(r=>r.simbolo==='g')),'algún centinela no recibió g'); ok(w.stats.alarms>=1); });
test('S15','Dron: ORB → RAS → MAR (emite g); EMP → REC; recarga → ORB',()=>{ const w=new Game.World(LEVELS[2]); step(w,0.2); const d=w.drones[0]; w.player.x=d.x; w.player.y=d.y+1.5*T; if(w.solid(w.player.x,w.player.y)) w.player.y=d.y-1.5*T; step(w,3.2); const s=statesOf(d); ok(s.includes('RAS')&&s.includes('MAR'),'estados: '+s); ok(w.stats.alarms>=1,'no emitió alarma'); w.player.x=d.x; w.player.y=d.y; w.update(1/60,{emp:true}); step(w,0.1); eq(d.m.actual,'REC'); hide(w); step(w,6); eq(d.m.actual,'ORB'); eq(d.m.traza.filter(r=>r.cambio).slice(-1)[0].simbolo,'k'); });
test('S16','Sigilo en sombra reduce la distancia de detección a menos de la mitad',()=>{ const w=new Game.World(LEVELS[0]); w.player.inShadow=true; w.player.sneak=true; ok(w.playerVisibility()<0.5); w.player.sneak=false; ok(w.playerVisibility()>0.5); });
test('S17','Caminar emite ruido; en sigilo no (excepto en rejilla metálica)',()=>{ const nz=w=>w.events.filter(e=>e.type==='noise').length; const w=new Game.World(LEVELS[0]); w.update(1/60,{mx:1}); eq(nz(w),1); const w2=new Game.World(LEVELS[0]); w2.update(1/60,{mx:1,sneak:true}); eq(nz(w2),0); const w3=new Game.World(LEVELS[0]); w3.player.x=(2.5)*T; w3.player.y=(14.5)*T; w3.update(1/60,{mx:1,sneak:true}); eq(nz(w3),1); });
test('S18','Hackear todas las terminales abre la salida y llegar a ella gana el nivel',()=>{ const w=new Game.World(LEVELS[0]); hide(w); const t=w.terminals[0]; w.player.x=t.x; w.player.y=t.y+T*0.5; step(w,2.4,{hack:true}); ok(t.done); w.player.x=w.exit.x; w.player.y=w.exit.y; w.update(1/60,{}); eq(w.state,'won'); });
test('S19','La salida no funciona si faltan terminales',()=>{ const w=new Game.World(LEVELS[1]); w.player.x=w.exit.x; w.player.y=w.exit.y; w.update(1/60,{}); eq(w.state,'playing'); });
test('S20','El distractor no atraviesa muros',()=>{ const w=new Game.World(LEVELS[0]); w.update(1/60,{throw:true,tx:w.player.x+20*T,ty:w.player.y}); const pr=w.projectiles[0]; ok(pr.tx<5*T,'atravesó el muro: '+pr.tx); });
test('S21','Reproducibilidad: misma entrada, misma traza',()=>{ const run=()=>{ const w=new Game.World(LEVELS[2]); for(let i=0;i<60*40;i++) w.update(1/60,{mx:i%240<120?1:0,my:i%300<150?0.5:-0.5}); return w.enemies.map(e=>e.m.cadena()).join('|'); }; eq(run(),run()); });
test('S22','Desafío del autómata: la respuesta coincide con δ* y hay 4 opciones distintas',()=>{ for(let i=0;i<500;i++){ const c=Game.makeChallenge(); eq(Core.deltaEstrella(Core.DEFS.centinela,c.q0,c.w).final,c.answer); eq(new Set(c.options).size,4); ok(c.options.includes(c.answer)); } });

suite('Rendimiento');
let perf={};
test('R01','Procesar un símbolo toma menos de 1 ms (RNF02)',()=>{ const m=new Core.MaquinaEstados(Core.DEFS.centinela); const n=1e6; const t0=process.hrtime.bigint(); for(let i=0;i<n;i++) m.procesar(ORDER[i%9]); const us=Number(process.hrtime.bigint()-t0)/1e3/n; perf.procesar_us=+us.toFixed(4); ok(us<1000); });
test('R02','15 enemigos: la lógica de un cuadro cabe holgadamente en 16,7 ms (RNF01)',()=>{ const L=JSON.parse(JSON.stringify(LEVELS[3])); while(L.guardias.length<11) L.guardias.push(L.guardias[L.guardias.length%4]); const w=new Game.World(L); w.attack=()=>{}; ok(w.enemies.length>=15,'enemigos '+w.enemies.length); step(w,1); const n=60*60; const t0=process.hrtime.bigint(); for(let i=0;i<n;i++) w.update(1/60,{mx:Math.sin(i/50),my:Math.cos(i/70)}); eq(w.state,'playing','la simulación terminó antes de tiempo'); ok(w.enemies.some(e=>e.m.traza.some(r=>r.simbolo==='v')),'nadie vio al jugador'); const ms=Number(process.hrtime.bigint()-t0)/1e6/n; perf.cuadro_ms=+ms.toFixed(3); perf.enemigos=w.enemies.length; ok(ms<8,'ms/cuadro '+ms); });

const fails=results.filter(r=>!r.ok);
for(const r of results) console.log(`${r.ok?'✔':'✘'} ${r.id} ${r.name}${r.ok?'':' → '+r.msg}`);
console.log(`\n${results.length-fails.length}/${results.length} pruebas aprobadas (${((results.length-fails.length)/results.length*100).toFixed(1)} %)`, JSON.stringify(perf));
require('fs').writeFileSync(__dirname+'/resultados.json',JSON.stringify({results,perf,fecha:new Date().toISOString()},null,1));
process.exit(fails.length?1:0);
