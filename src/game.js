/* ===== Lógica del juego (sin DOM): mundo, sensores, movimiento ===== */
'use strict';
const _Core=(typeof module!=='undefined')?require('./core.js'):Core;
const TILE=32, COLS=30, ROWS=18;
const CFG={
  playerWalk:125, playerSneak:62, playerR:10, guardR:11,
  guardPatrol:70, guardInvestigate:95, guardChase:132, guardReturn:85,
  fov:75*Math.PI/180, visionRange:6*TILE, attackRange:1.35*TILE,
  hearWalk:2.4*TILE, hearMetal:3.6*TILE, hearMetalSneak:1.8*TILE, distractRadius:5.5*TILE,
  empRadius:2.6*TILE, empCharges:2, distractCd:3.0, hackTime:2.2,
  tINV:9, tBUS:5, tATU:4, tATA:0.55,
  camRange:7*TILE, camFov:50*Math.PI/180, camDetect:1.0, camAlarm:6,
  droneVision:3.6*TILE, droneSpeed:95, droneTrack:1.3, droneMark:1.3, droneDrain:5, droneDrainIdle:1.2, droneCharge:30
};
function angDiff(a,b){ let d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }

class World{
  constructor(level, opts={}){
    this.level=level; this.time=0; this.events=[]; this.noises=[]; this.fx=[]; this.alarmT=0; this.alarmPos=null;
    this.grid=[]; this.terminals=[]; this.pickups=[]; this.exit=null; this.state='playing';
    this.stats={time:0,alarms:0,spotted:0,emp:0,distract:0,transitions:0};
    this.pendingGlobal=null; this.rng=opts.rng||Math.random;
    level.mapa.forEach((row,y)=>{ this.grid[y]=[]; [...row].forEach((ch,x)=>{
      const c=ch==='#'?'#':(ch==='H'?'H':(ch==='M'?'M':'.')); this.grid[y][x]=c;
      if(ch==='P') this.start={x:(x+0.5)*TILE,y:(y+0.5)*TILE};
      if(ch==='T') this.terminals.push({x:(x+0.5)*TILE,y:(y+0.5)*TILE,tx:x,ty:y,progress:0,done:false});
      if(ch==='X') this.exit={x:(x+0.5)*TILE,y:(y+0.5)*TILE,tx:x,ty:y};
      if(ch==='E') this.pickups.push({x:(x+0.5)*TILE,y:(y+0.5)*TILE,taken:false});
    }); });
    this.player={x:this.start.x,y:this.start.y,dir:0,sneak:false,moving:false,emp:(level.emp||CFG.empCharges),distractCd:0,stepT:0,hacking:null,inShadow:false};
    this.guards=level.guardias.map((g,i)=>this.makeGuard(g,i));
    this.cameras=(level.camaras||[]).map((c,i)=>this.makeCamera(c,i));
    this.drones=(level.drones||[]).map((d,i)=>this.makeDrone(d,i));
    this.enemies=[...this.guards,...this.cameras,...this.drones];
    this.projectiles=[];
  }
  /* --------- mapa --------- */
  tileAt(px,py){ const tx=Math.floor(px/TILE), ty=Math.floor(py/TILE); if(tx<0||ty<0||tx>=COLS||ty>=ROWS) return '#'; return this.grid[ty][tx]; }
  solid(px,py){ return this.tileAt(px,py)==='#'; }
  los(a,b){ // línea de visión muestreando cada 1/4 de casilla
    const d=Math.hypot(b.x-a.x,b.y-a.y), n=Math.ceil(d/(TILE/4));
    for(let i=1;i<n;i++){ const t=i/n; if(this.solid(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)) return false; }
    return true;
  }
  rayLen(x,y,ang,max){ const step=4; for(let r=0;r<max;r+=step){ if(this.solid(x+Math.cos(ang)*r,y+Math.sin(ang)*r)) return r; } return max; }
  moveCircle(e,dx,dy,r){
    const tryMove=(nx,ny)=>{ for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r],[0,-r],[0,r],[-r,0],[r,0]]) if(this.solid(nx+ox*0.92,ny+oy*0.92)) return false; return true; };
    if(dx&&tryMove(e.x+dx,e.y)) e.x+=dx;
    if(dy&&tryMove(e.x,e.y+dy)) e.y+=dy;
  }
  astar(from,to){ // A* en casillas, 8 direcciones sin cortar esquinas
    const sx=Math.floor(from.x/TILE), sy=Math.floor(from.y/TILE); let gx=Math.floor(to.x/TILE), gy=Math.floor(to.y/TILE);
    if(this.grid[gy]&&this.grid[gy][gx]==='#'){ // destino en muro: buscar vecino libre
      let best=null; for(const [ox,oy] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){ const x=gx+ox,y=gy+oy; if(this.grid[y]&&this.grid[y][x]&&this.grid[y][x]!=='#'){best=[x,y];break;} }
      if(!best) return null; [gx,gy]=best;
    }
    const key=(x,y)=>y*COLS+x, open=[[sx,sy]], g={}, f={}, came={}, closed=new Set();
    g[key(sx,sy)]=0; f[key(sx,sy)]=Math.hypot(gx-sx,gy-sy);
    let it=0;
    while(open.length&&it++<4000){
      let bi=0; for(let i=1;i<open.length;i++) if(f[key(...open[i])]<f[key(...open[bi])]) bi=i;
      const [cx,cy]=open.splice(bi,1)[0], ck=key(cx,cy);
      if(cx===gx&&cy===gy){ const path=[]; let k=ck; while(k!==undefined){ path.unshift({x:(k%COLS+0.5)*TILE,y:(Math.floor(k/COLS)+0.5)*TILE}); k=came[k]; } return path; }
      closed.add(ck);
      for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=cx+ox, ny=cy+oy; if(nx<0||ny<0||nx>=COLS||ny>=ROWS||this.grid[ny][nx]==='#') continue;
        if(ox&&oy&&(this.grid[cy][nx]==='#'||this.grid[ny][cx]==='#')) continue;
        const nk=key(nx,ny); if(closed.has(nk)) continue;
        const ng=g[ck]+(ox&&oy?1.414:1);
        if(g[nk]===undefined||ng<g[nk]){ g[nk]=ng; f[nk]=ng+Math.hypot(gx-nx,gy-ny); came[nk]=ck; if(!open.some(o=>o[0]===nx&&o[1]===ny)) open.push([nx,ny]); }
      }
    }
    return null;
  }
  /* --------- entidades --------- */
  makeGuard(g,i){
    const ruta=g.ruta.map(([x,y])=>({x:(x+0.5)*TILE,y:(y+0.5)*TILE}));
    const m=new _Core.MaquinaEstados(_Core.DEFS.centinela);
    const e={kind:'guard',id:'Centinela '+(i+1),x:ruta[0].x,y:ruta[0].y,dir:0,m,ruta,wp:1,path:null,pathT:0,target:null,timer:0,
      prevVis:null,prevRange:null,lastSeen:null,alertPos:null,mark:null,markT:0,scanBase:0,attackFlash:0};
    m.alSuceder(r=>this.onTransition(e,r));
    this.enter(e,m.actual);
    return e;
  }
  makeCamera(c,i){
    const m=new _Core.MaquinaEstados(_Core.DEFS.camara);
    const e={kind:'camera',id:'Cámara '+(i+1),x:(c.x+0.5)*TILE,y:(c.y+0.5)*TILE,base:c.dir,arco:c.arco,dir:c.dir,phase:i*1.7,m,timer:0,prevVis:null};
    m.alSuceder(r=>this.onTransition(e,r)); return e;
  }
  makeDrone(d,i){
    const m=new _Core.MaquinaEstados(_Core.DEFS.dron);
    const cx=(d.cx+0.5)*TILE, cy=(d.cy+0.5)*TILE;
    const e={kind:'drone',id:'Dron '+(i+1),cx,cy,radio:d.radio*TILE,ang:i*2,x:cx+d.radio*TILE,y:cy,dir:0,m,timer:0,prevVis:null,battery:100,sentLow:false,sentFull:false};
    m.alSuceder(r=>this.onTransition(e,r)); return e;
  }
  onTransition(e,r){
    this.stats.transitions++;
    this.events.push({type:'transition',enemy:e,reg:r});
    if(r.cambio){ this.enter(e,r.hacia); }
    // acciones especiales de bucle (salidas λ)
    if(e.kind==='guard'){
      if(r.salida==='siguiente_punto'){ e.wp=(e.wp+1)%e.ruta.length; e.target=e.ruta[e.wp]; e.path=null; }
      if(r.salida==='actualizar_objetivo'){ if(r.hacia==='INV'){ e.target=e.alertPos; e.path=null; e.timer=CFG.tINV; } else { e.target=e.lastSeen; e.path=null; } }
      if(r.salida==='repetir_ataque'){ this.attack(e); e.timer=CFG.tATA; }
    }
  }
  enter(e,q){ // acciones de entrada (salida λ del estado destino)
    e.prevVis=null; e.prevRange=null; // reinicio de memoria de percepción: re-evaluar al entrar
    if(e.kind==='guard'){
      e.path=null;
      switch(q){
        case 'PAT': e.target=e.ruta[e.wp]; e.mark=null; break;
        case 'INV': e.target=e.alertPos; e.timer=CFG.tINV; e.mark='?'; e.markT=1.2; break;
        case 'PER': e.target=e.lastSeen||{x:this.player.x,y:this.player.y}; e.mark='!'; e.markT=1.2; this.stats.spotted++; this.events.push({type:'spotted',enemy:e}); break;
        case 'ATA': e.timer=CFG.tATA; break;
        case 'BUS': e.timer=CFG.tBUS; e.scanBase=e.dir; e.mark='?'; e.markT=1.0; e.target=null; break;
        case 'REG': { let best=0,bd=1e9; e.ruta.forEach((p,i)=>{const d=dist(p,e); if(d<bd){bd=d;best=i;}}); e.wp=best; e.target=e.ruta[best]; e.mark=null; break; }
        case 'ATU': e.timer=CFG.tATU; e.mark='z'; e.markT=CFG.tATU; break;
      }
    } else if(e.kind==='camera'){
      if(q==='DET') e.timer=CFG.camDetect;
      if(q==='ALA'){ e.timer=CFG.camAlarm; this.raiseAlarm(e,{x:this.player.x,y:this.player.y}); }
    } else if(e.kind==='drone'){
      if(q==='RAS') e.timer=CFG.droneTrack;
      if(q==='MAR'){ e.timer=CFG.droneMark; this.raiseAlarm(e,{x:this.player.x,y:this.player.y}); }
      if(q==='REC'){ e.sentFull=false; }
      if(q==='ORB'){ e.sentLow=false; }
    }
  }
  raiseAlarm(src,pos){ this.alarmT=Math.max(this.alarmT,4); this.alarmPos=pos; this.pendingGlobal={pos,src}; this.stats.alarms++; this.events.push({type:'alarm',enemy:src}); }
  attack(e){
    e.attackFlash=0.25;
    const p=this.player; if(dist(e,p)<=CFG.attackRange*1.05 && this.los(e,p) && this.state==='playing'){ this.state='caught'; this.events.push({type:'caught',enemy:e}); }
  }
  /* --------- percepción --------- */
  playerVisibility(){ const p=this.player; let k=1; if(p.inShadow) k=p.sneak?0.45:0.75; return k; }
  canSee(e,fov,range){
    const p=this.player, d=dist(e,p); if(d>range*this.playerVisibility()) return false;
    if(fov<Math.PI*2-0.01 && Math.abs(angDiff(Math.atan2(p.y-e.y,p.x-e.x),e.dir))>fov/2) return false;
    if(d<TILE*0.8) return true; // contacto directo
    return this.los(e,p);
  }
  sensorsGuard(e){
    const p=this.player, cand=[];
    const vis=this.canSee(e,CFG.fov,CFG.visionRange) || (dist(e,p)<TILE*1.1 && this.los(e,p));
    const inRange=vis && dist(e,p)<=CFG.attackRange;
    const q=e.m.actual;
    if(vis){ e.lastSeen={x:p.x,y:p.y}; }
    if(e.prevVis!==vis){
      if(vis) cand.push('v');
      else if(e.prevVis===true || (e.prevVis===null && (q==='PER'||q==='ATA'))) cand.push('p');
    }
    if(e.prevRange!==inRange){
      if(inRange) cand.push('c');
      else if(e.prevRange===true && vis) cand.push('l');
    }
    e.prevVis=vis; e.prevRange=inRange;
    // ruido
    for(const n of this.noises){ if(dist(n,e)<=n.radius && q!=='PER' && q!=='ATA'){ e.alertPos={x:n.x,y:n.y}; cand.push('r'); break; } }
    if(this.globalNow){ e.alertPos={x:this.globalNow.pos.x,y:this.globalNow.pos.y}; cand.push('g'); }
    if(e.empHit){ cand.push('s'); e.empHit=false; }
    if(e.reached){ cand.push('d'); e.reached=false; }
    if(e.timerFired){ cand.push('t'); e.timerFired=false; }
    return cand;
  }
  /* --------- actualización --------- */
  update(dt, input){
    if(this.state!=='playing') { this.updateFx(dt); return; }
    this.time+=dt; this.stats.time=this.time; this.events.length=0;
    this.globalNow=this.pendingGlobal; this.pendingGlobal=null;
    this.updatePlayer(dt,input);
    for(const pr of this.projectiles){ pr.t+=dt; if(pr.t>=pr.dur && !pr.done){ pr.done=true; this.emitNoise(pr.tx,pr.ty,CFG.distractRadius,'distractor'); } }
    this.projectiles=this.projectiles.filter(p=>!p.done);
    for(const g of this.guards) this.updateGuard(g,dt);
    for(const c of this.cameras) this.updateCamera(c,dt);
    for(const d of this.drones) this.updateDrone(d,dt);
    if(this.alarmT>0) this.alarmT-=dt;
    this.noises=[]; // los ruidos se consumen al final del ciclo (incluye los emitidos fuera de update)
    this.updateFx(dt);
    // victoria
    if(this.terminals.every(t=>t.done) && this.exit && dist(this.player,this.exit)<TILE*0.7 && this.state==='playing'){ this.state='won'; this.events.push({type:'won'}); }
  }
  emitNoise(x,y,radius,src){ const n={x,y,radius,src}; this.noises.push(n); this.fx.push({type:'ring',x,y,r:radius,t:0,dur:0.6,color:src==='distractor'?'#f2c94c':'#9fd3ff'}); this.events.push({type:'noise',noise:n}); }
  updatePlayer(dt,inp){
    const p=this.player; p.sneak=!!inp.sneak;
    let mx=inp.mx||0, my=inp.my||0; const l=Math.hypot(mx,my); if(l>1){mx/=l;my/=l;}
    p.moving=l>0.1;
    const sp=p.sneak?CFG.playerSneak:CFG.playerWalk;
    if(p.moving){ p.dir=Math.atan2(my,mx); this.moveCircle(p,mx*sp*dt,my*sp*dt,CFG.playerR); }
    const tile=this.tileAt(p.x,p.y); p.inShadow=tile==='H';
    p.stepT-=dt;
    if(p.moving && p.stepT<=0){
      p.stepT=0.4;
      if(tile==='M') this.emitNoise(p.x,p.y,p.sneak?CFG.hearMetalSneak:CFG.hearMetal,'pasos');
      else if(!p.sneak) this.emitNoise(p.x,p.y,CFG.hearWalk,'pasos');
      this.events.push({type:'step',metal:tile==='M',sneak:p.sneak});
    }
    // recoger
    for(const k of this.pickups) if(!k.taken && dist(k,p)<TILE*0.6){ k.taken=true; p.emp++; this.events.push({type:'pickup'}); }
    // hackear
    p.hacking=null;
    for(const t of this.terminals) if(!t.done && dist(t,p)<TILE*0.95){
      if(inp.hack){ t.progress+=dt; p.hacking=t; if(t.progress>=CFG.hackTime){ t.done=true; this.events.push({type:'hacked',terminal:t}); if(this.terminals.every(x=>x.done)) this.events.push({type:'exitOpen'}); } }
    }
    // EMP
    if(inp.emp && p.emp>0){
      p.emp--; this.stats.emp++; this.fx.push({type:'ring',x:p.x,y:p.y,r:CFG.empRadius,t:0,dur:0.45,color:'#7de3ff',thick:true}); this.events.push({type:'emp'});
      for(const g of this.guards) if(dist(g,p)<=CFG.empRadius) g.empHit=true;
      for(const d of this.drones) if(dist(d,p)<=CFG.empRadius){ d.battery=0; }
    }
    // distractor
    p.distractCd=Math.max(0,p.distractCd-dt);
    if(inp.throw && p.distractCd<=0){
      let tx=inp.tx, ty=inp.ty;
      if(tx===undefined){ tx=p.x+Math.cos(p.dir)*5*TILE; ty=p.y+Math.sin(p.dir)*5*TILE; }
      let ang=Math.atan2(ty-p.y,tx-p.x), want=Math.min(Math.hypot(tx-p.x,ty-p.y),7*TILE);
      const len=Math.max(0,Math.min(want,this.rayLen(p.x,p.y,ang,want)-8));
      const ex=p.x+Math.cos(ang)*len, ey=p.y+Math.sin(ang)*len;
      this.projectiles.push({sx:p.x,sy:p.y,tx:ex,ty:ey,t:0,dur:0.25+len/600,done:false});
      p.distractCd=CFG.distractCd; this.stats.distract++; this.events.push({type:'throw'});
    }
  }
  followPath(e,dt,speed){
    if(!e.target) return;
    const now=this.time;
    if(!e.path || (e.m.actual==='PER' && now-e.pathT>0.35)){ e.path=this.astar(e,e.target)||[]; e.pathT=now; if(e.path.length) e.path.shift(); }
    let step=speed*dt;
    while(step>0){
      if(!e.path.length){ // destino final
        const d=dist(e,e.target);
        if(d<3){ e.reached=true; return; }
        const ang=Math.atan2(e.target.y-e.y,e.target.x-e.x); e.dir=turn(e.dir,ang,dt*8);
        const s=Math.min(step,d); this.moveCircle(e,Math.cos(ang)*s,Math.sin(ang)*s,CFG.guardR*0.8);
        if(dist(e,e.target)<3) e.reached=true; return;
      }
      const n=e.path[0], d=dist(e,n);
      if(d<=step){ e.x=n.x; e.y=n.y; e.path.shift(); step-=d; continue; }
      const ang=Math.atan2(n.y-e.y,n.x-e.x); e.dir=turn(e.dir,ang,dt*8);
      e.x+=Math.cos(ang)*step; e.y+=Math.sin(ang)*step; step=0;
    }
  }
  updateGuard(e,dt){
    const q=e.m.actual;
    e.markT=Math.max(0,e.markT-dt); e.attackFlash=Math.max(0,e.attackFlash-dt);
    // temporizadores
    if(['INV','BUS','ATU','ATA'].includes(q)){ e.timer-=dt; if(e.timer<=0){ e.timerFired=true; e.timer=99; } }
    // comportamiento del estado actual
    switch(q){
      case 'PAT': this.followPath(e,dt,CFG.guardPatrol); break;
      case 'INV': if(e.target) this.followPath(e,dt,CFG.guardInvestigate); break;
      case 'PER': if(e.lastSeen){ e.target=e.lastSeen; } this.followPath(e,dt,CFG.guardChase); e.reached=false; break;
      case 'ATA': e.dir=turn(e.dir,Math.atan2(this.player.y-e.y,this.player.x-e.x),dt*10); break;
      case 'BUS': e.dir=e.scanBase+Math.sin((CFG.tBUS-e.timer)*2.4)*1.4; break;
      case 'REG': this.followPath(e,dt,CFG.guardReturn); break;
      case 'ATU': break;
    }
    if(q!=='PAT'&&q!=='INV'&&q!=='REG') e.reached=false;
    const cand=this.sensorsGuard(e);
    const s=_Core.seleccionarSimbolo(cand);
    if(s) e.m.procesar(s,this.time);
  }
  updateCamera(e,dt){
    const q=e.m.actual;
    if(q==='BAR'){ e.phase+=dt*0.7; e.dir=e.base+Math.sin(e.phase)*e.arco; }
    else { const a=Math.atan2(this.player.y-e.y,this.player.x-e.x); if(Math.abs(angDiff(a,e.base))<e.arco+0.4) e.dir=turn(e.dir,a,dt*3); }
    if(q!=='BAR'){ e.timer-=dt; }
    const vis=this.canSee(e,CFG.camFov,CFG.camRange);
    const cand=[];
    if(e.prevVis!==vis){ if(vis) cand.push('v'); else if(e.prevVis!==null||q==='DET') cand.push('p'); }
    e.prevVis=vis;
    if(q!=='BAR' && e.timer<=0){ cand.push('t'); e.timer=99; }
    const s=_Core.seleccionarSimbolo(cand); if(s) e.m.procesar(s,this.time);
  }
  updateDrone(e,dt){
    const q=e.m.actual, p=this.player;
    if(q==='ORB'){ e.ang+=dt*0.9; const tx=e.cx+Math.cos(e.ang)*e.radio, ty=e.cy+Math.sin(e.ang)*e.radio; moveTo(e,tx,ty,CFG.droneSpeed*dt); e.battery-=CFG.droneDrainIdle*dt; }
    else if(q==='RAS'||q==='MAR'){ const a=Math.atan2(p.y-e.y,p.x-e.x), d=dist(e,p); if(d>TILE*1.6) moveTo(e,p.x-Math.cos(a)*TILE*1.4,p.y-Math.sin(a)*TILE*1.4,CFG.droneSpeed*dt); e.dir=a; e.battery-=CFG.droneDrain*dt; e.timer-=dt; }
    else if(q==='REC'){ moveTo(e,e.cx,e.cy,CFG.droneSpeed*1.3*dt); if(dist(e,{x:e.cx,y:e.cy})<4) e.battery=Math.min(100,e.battery+CFG.droneCharge*dt); }
    if(q==='ORB') e.dir=e.ang+Math.PI/2;
    e.battery=Math.max(0,e.battery);
    const vis=q!=='REC' && dist(e,p)<=CFG.droneVision*this.playerVisibility() && this.los(e,p);
    const cand=[];
    if(e.prevVis!==vis){ if(vis) cand.push('v'); else if(e.prevVis!==null||q==='RAS'||q==='MAR') cand.push('p'); }
    e.prevVis=vis;
    if((q==='RAS'||q==='MAR') && e.timer<=0){ cand.push('t'); e.timer=99; }
    if(e.battery<20 && !e.sentLow && q!=='REC'){ cand.push('b'); e.sentLow=true; }
    if(q==='REC' && e.battery>=100 && !e.sentFull){ cand.push('k'); e.sentFull=true; }
    const s=_Core.seleccionarSimbolo(cand); if(s) e.m.procesar(s,this.time);
  }
  updateFx(dt){ for(const f of this.fx) f.t+=dt; this.fx=this.fx.filter(f=>f.t<f.dur); }
}
function turn(a,target,maxStep){ const d=angDiff(target,a); return a+Math.max(-maxStep,Math.min(maxStep,d)); }
function moveTo(e,tx,ty,step){ const d=Math.hypot(tx-e.x,ty-e.y); if(d<=step){e.x=tx;e.y=ty;return;} e.x+=(tx-e.x)/d*step; e.y+=(ty-e.y)/d*step; }
/* Desafío del autómata */
function makeChallenge(rng=Math.random){
  const def=_Core.DEFS.centinela, Q=def.estados.map(e=>e.id), S=def.alfabeto;
  const q0=Q[Math.floor(rng()*Q.length)];
  let w=''; for(let i=0;i<4;i++) w+=S[Math.floor(rng()*S.length)];
  const r=_Core.deltaEstrella(def,q0,w);
  const opts=new Set([r.final]); while(opts.size<4) opts.add(Q[Math.floor(rng()*Q.length)]);
  const options=[...opts].sort(()=>rng()-0.5);
  return {q0,w,answer:r.final,options,pasos:r.pasos};
}
const Game={TILE,COLS,ROWS,CFG,World,makeChallenge,angDiff,dist};
if(typeof module!=='undefined') module.exports=Game;
