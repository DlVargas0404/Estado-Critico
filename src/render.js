/* ===== Dibujo del mundo en canvas ===== */
'use strict';
const PAL={floor:'#16232b',grid:'#1c2c35',wallTop:'#d6c8a6',wallFace:'#8c7c5f',wallEdge:'#efe3c4',shadow:'#0b141a',metal:'#253641',metalLine:'#3a5261',
  term:'#5ce1e6',termDone:'#4d6b70',exitOff:'#5b4a4a',exitOn:'#6fe39a',player:'#8fe6ff',guard:'#e4572e',cone:'255,196,92',coneHot:'255,92,72',text:'#e8efe9'};
const STATE_COLOR={}; for(const k of ['centinela','camara','dron']) for(const e of Core.DEFS[k].estados) STATE_COLOR[e.id]=e.color;
class Renderer{
  constructor(canvas){ this.c=canvas; this.ctx=canvas.getContext('2d'); this.W=Game.COLS*Game.TILE; this.H=Game.ROWS*Game.TILE; this.bg=null; this.shake=0; this.selected=null; }
  resize(cssW,cssH){
    const dpr=Math.min(window.devicePixelRatio||1,2); const s=Math.min(cssW/this.W,cssH/this.H);
    this.scale=s; this.c.style.width=Math.floor(this.W*s)+'px'; this.c.style.height=Math.floor(this.H*s)+'px';
    this.c.width=Math.floor(this.W*s*dpr); this.c.height=Math.floor(this.H*s*dpr); this.dpr=dpr;
  }
  buildBackground(world){
    const T=Game.TILE, cv=document.createElement('canvas'); cv.width=this.W; cv.height=this.H; const g=cv.getContext('2d');
    g.fillStyle=PAL.floor; g.fillRect(0,0,this.W,this.H);
    for(let y=0;y<Game.ROWS;y++) for(let x=0;x<Game.COLS;x++){
      const t=world.grid[y][x], px=x*T, py=y*T;
      if(t==='.'){ g.strokeStyle=PAL.grid; g.lineWidth=1; g.strokeRect(px+0.5,py+0.5,T-1,T-1); }
      if(t==='H'){ g.fillStyle=PAL.shadow; g.fillRect(px,py,T,T); g.strokeStyle='rgba(120,160,180,0.07)'; g.lineWidth=2; for(let k=-T;k<T;k+=8){ g.beginPath(); g.moveTo(px+k,py+T); g.lineTo(px+k+T,py); g.stroke(); } }
      if(t==='M'){ g.fillStyle=PAL.metal; g.fillRect(px,py,T,T); g.strokeStyle=PAL.metalLine; g.lineWidth=1; for(let k=4;k<T;k+=6){ g.beginPath(); g.moveTo(px+k,py+2); g.lineTo(px+k,py+T-2); g.stroke(); } g.strokeRect(px+1.5,py+1.5,T-3,T-3); }
    }
    // muros con cara frontal para efecto 2.5D
    for(let y=0;y<Game.ROWS;y++) for(let x=0;x<Game.COLS;x++){
      if(world.grid[y][x]!=='#') continue; const px=x*T, py=y*T;
      const below=y+1<Game.ROWS && world.grid[y+1][x]!=='#';
      g.fillStyle=PAL.wallTop; g.fillRect(px,py,T,below?T-9:T);
      if(below){ g.fillStyle=PAL.wallFace; g.fillRect(px,py+T-9,T,9); g.fillStyle='rgba(0,0,0,0.35)'; g.fillRect(px,py+T,T,5); }
      g.fillStyle=PAL.wallEdge;
      if(y>0&&world.grid[y-1][x]!=='#') g.fillRect(px,py,T,2);
      g.fillStyle='rgba(60,50,30,0.25)'; if(x>0&&world.grid[y][x-1]!=='#') g.fillRect(px,py,2,T); if(x<Game.COLS-1&&world.grid[y][x+1]!=='#') g.fillRect(px+T-2,py,2,T);
    }
    this.bg=cv;
  }
  cone(g,x,y,dir,fov,range,world,hot,alpha){
    const n=28; g.beginPath(); g.moveTo(x,y);
    for(let i=0;i<=n;i++){ const a=dir-fov/2+fov*i/n; const r=world.rayLen(x,y,a,range); g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r); }
    g.closePath(); const gr=g.createRadialGradient(x,y,4,x,y,range);
    const c=hot?PAL.coneHot:PAL.cone; gr.addColorStop(0,`rgba(${c},${alpha*1.6})`); gr.addColorStop(1,`rgba(${c},0.02)`);
    g.fillStyle=gr; g.fill();
  }
  draw(world,opts={}){
    const g=this.ctx, T=Game.TILE, t=world.time;
    g.setTransform(this.dpr*this.scale,0,0,this.dpr*this.scale,0,0);
    if(this.shake>0){ g.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake); this.shake*=0.9; if(this.shake<0.3) this.shake=0; }
    g.drawImage(this.bg,0,0);
    // terminales, salida, recogibles
    for(const k of world.pickups) if(!k.taken){ g.save(); g.translate(k.x,k.y); g.rotate(t*1.5); g.strokeStyle='#7de3ff'; g.lineWidth=2; g.beginPath(); for(let i=0;i<6;i++){const a=i*Math.PI/3; g.lineTo(Math.cos(a)*8,Math.sin(a)*8);} g.closePath(); g.stroke(); g.restore(); g.fillStyle='#7de3ff'; g.font='bold 9px "Chakra Petch",sans-serif'; g.textAlign='center'; g.fillText('EMP',k.x,k.y+3); }
    const allDone=world.terminals.every(x=>x.done);
    if(world.exit){ const e=world.exit; g.fillStyle=allDone?PAL.exitOn:PAL.exitOff; g.globalAlpha=allDone?0.35+0.25*Math.sin(t*4):0.6; g.fillRect(e.x-T/2+3,e.y-T/2+3,T-6,T-6); g.globalAlpha=1; g.strokeStyle=allDone?PAL.exitOn:'#8a6a6a'; g.lineWidth=2; g.strokeRect(e.x-T/2+3,e.y-T/2+3,T-6,T-6); g.fillStyle=allDone?'#0d2a1a':'#c9a9a9'; g.font='bold 10px "Chakra Petch",sans-serif'; g.textAlign='center'; g.fillText(allDone?'SALIDA':'CERRADO',e.x,e.y+4); }
    for(const tm of world.terminals){
      g.fillStyle=tm.done?PAL.termDone:'#0e3d42'; g.fillRect(tm.x-11,tm.y-9,22,16); g.strokeStyle=tm.done?'#6c8c90':PAL.term; g.lineWidth=2; g.strokeRect(tm.x-11,tm.y-9,22,16);
      if(!tm.done){ g.globalAlpha=0.5+0.5*Math.sin(t*5); g.fillStyle=PAL.term; g.fillRect(tm.x-7,tm.y-5,14,2); g.fillRect(tm.x-7,tm.y-1,9,2); g.globalAlpha=1; }
      else { g.fillStyle='#bfe9c9'; g.font='bold 11px sans-serif'; g.textAlign='center'; g.fillText('✓',tm.x,tm.y+3); }
      if(tm.progress>0&&!tm.done){ g.strokeStyle=PAL.term; g.lineWidth=3; g.beginPath(); g.arc(tm.x,tm.y,17,-Math.PI/2,-Math.PI/2+2*Math.PI*tm.progress/Game.CFG.hackTime); g.stroke(); }
    }
    // conos de visión
    for(const e of world.guards){ const q=e.m.actual; if(q==='ATU') continue; this.cone(g,e.x,e.y,e.dir,Game.CFG.fov,Game.CFG.visionRange,world,q==='PER'||q==='ATA',0.16); }
    for(const c of world.cameras){ this.cone(g,c.x,c.y,c.dir,Game.CFG.camFov,Game.CFG.camRange,world,c.m.actual!=='BAR',c.m.actual==='ALA'?0.22:0.14); }
    for(const d of world.drones){ if(d.m.actual==='REC') continue; g.beginPath(); g.arc(d.x,d.y,Game.CFG.droneVision,0,Math.PI*2); g.fillStyle=d.m.actual==='ORB'?'rgba(255,196,92,0.06)':'rgba(255,92,72,0.10)'; g.fill(); g.setLineDash([4,6]); g.strokeStyle='rgba(255,196,92,0.35)'; g.lineWidth=1; g.stroke(); g.setLineDash([]); }
    // rutas (modo autómata)
    if(opts.automataMode){ for(const e of world.guards){ g.setLineDash([3,5]); g.strokeStyle=e===this.selected?'rgba(95,191,115,0.8)':'rgba(95,191,115,0.25)'; g.lineWidth=1.5; g.beginPath(); e.ruta.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath(); g.stroke(); g.setLineDash([]); if(e.path&&e.path.length&&e===this.selected){ g.strokeStyle='rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(e.x,e.y); e.path.forEach(p=>g.lineTo(p.x,p.y)); g.stroke(); } } }
    // proyectiles
    for(const pr of world.projectiles){ const k=Math.min(1,pr.t/pr.dur); const x=pr.sx+(pr.tx-pr.sx)*k, y=pr.sy+(pr.ty-pr.sy)*k-Math.sin(k*Math.PI)*22; g.fillStyle='#f2c94c'; g.beginPath(); g.arc(x,y,4,0,7); g.fill(); }
    // jugador
    const p=world.player;
    g.save(); g.translate(p.x,p.y); g.rotate(p.dir);
    g.globalAlpha=p.inShadow?0.55:1;
    g.fillStyle='rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(2,3,11,9,0,0,7); g.fill();
    g.fillStyle=PAL.player; g.beginPath(); g.arc(0,0,10,0,7); g.fill(); g.fillStyle='#163846'; g.beginPath(); g.arc(4,0,4.5,0,7); g.fill();
    g.strokeStyle=p.sneak?'#c9f3ff':'#ffffff'; g.lineWidth=2; if(p.sneak) g.setLineDash([3,3]); g.beginPath(); g.arc(0,0,13,0,7); g.stroke(); g.setLineDash([]);
    g.restore(); g.globalAlpha=1;
    // guardias
    for(const e of world.guards) this.drawGuard(g,e,t);
    for(const c of world.cameras) this.drawCamera(g,c,t);
    for(const d of world.drones) this.drawDrone(g,d,t);
    // efectos
    for(const f of world.fx){ const k=f.t/f.dur; g.strokeStyle=f.color; g.globalAlpha=(1-k)*0.8; g.lineWidth=f.thick?4:1.5; g.beginPath(); g.arc(f.x,f.y,f.r*(f.thick?k:0.3+0.7*k),0,7); g.stroke(); g.globalAlpha=1; }
    // alarma
    if(world.alarmT>0){ const a=0.12+0.1*Math.sin(t*12); const gr=g.createRadialGradient(this.W/2,this.H/2,this.H*0.3,this.W/2,this.H/2,this.W*0.7); gr.addColorStop(0,'rgba(235,87,87,0)'); gr.addColorStop(1,`rgba(235,87,87,${a*2})`); g.fillStyle=gr; g.fillRect(0,0,this.W,this.H); }
  }
  label(g,x,y,txt,col){ g.font='bold 10px "Chakra Petch",sans-serif'; const w=g.measureText(txt).width+10; g.fillStyle='rgba(10,18,22,0.85)'; g.fillRect(x-w/2,y-8,w,14); g.strokeStyle=col; g.lineWidth=1; g.strokeRect(x-w/2+0.5,y-7.5,w-1,13); g.fillStyle=col; g.textAlign='center'; g.fillText(txt,x,y+3); }
  drawGuard(g,e,t){
    const q=e.m.actual, col=STATE_COLOR[q];
    g.save(); g.translate(e.x,e.y);
    if(e===this.selected){ g.strokeStyle='#ffffff'; g.lineWidth=1.5; g.setLineDash([4,4]); g.beginPath(); g.arc(0,0,19,t*2,t*2+Math.PI*2); g.stroke(); g.setLineDash([]); }
    g.fillStyle='rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(2,3,12,10,0,0,7); g.fill();
    g.strokeStyle=col; g.lineWidth=3; g.beginPath(); g.arc(0,0,14,0,7); g.stroke();
    g.rotate(e.dir); g.fillStyle=q==='ATU'?'#7d6a63':PAL.guard; g.beginPath(); g.arc(0,0,11,0,7); g.fill();
    g.fillStyle='#2b1510'; g.fillRect(3,-6,6,12); g.fillStyle='#ffd7a8'; g.fillRect(7,-3,3,6);
    if(e.attackFlash>0){ g.strokeStyle='rgba(255,90,70,0.9)'; g.lineWidth=4; g.beginPath(); g.arc(0,0,Game.CFG.attackRange,-0.6,0.6); g.stroke(); }
    g.restore();
    if(q==='ATA'){ g.strokeStyle='rgba(235,87,87,0.6)'; g.lineWidth=2; g.beginPath(); g.arc(e.x,e.y,22,-Math.PI/2,-Math.PI/2+2*Math.PI*(1-Math.max(0,e.timer)/Game.CFG.tATA)); g.stroke(); }
    if(e.mark&&e.markT>0){ g.font='bold 20px "Chakra Petch",sans-serif'; g.textAlign='center'; g.fillStyle=e.mark==='!'?'#ff6b4a':(e.mark==='z'?'#c8d3dc':'#f2c94c'); const bob=Math.sin(t*10)*2; g.fillText(e.mark==='z'?'z z':e.mark,e.x,e.y-24+bob); }
    else this.label(g,e.x,e.y-24,q,col);
  }
  drawCamera(g,c,t){
    const q=c.m.actual, col=STATE_COLOR[q];
    g.save(); g.translate(c.x,c.y); g.rotate(c.dir); g.fillStyle='#39474f'; g.fillRect(-8,-6,18,12); g.fillStyle='#1c252a'; g.fillRect(8,-4,5,8); g.restore();
    g.fillStyle=col; g.globalAlpha=q==='ALA'?(0.6+0.4*Math.sin(t*14)):1; g.beginPath(); g.arc(c.x,c.y,4,0,7); g.fill(); g.globalAlpha=1;
    if(c===this.selected){ g.strokeStyle='#fff'; g.setLineDash([4,4]); g.beginPath(); g.arc(c.x,c.y,16,0,7); g.stroke(); g.setLineDash([]); }
    this.label(g,c.x,c.y-18,q,col);
  }
  drawDrone(g,d,t){
    const q=d.m.actual, col=STATE_COLOR[q];
    g.save(); g.translate(d.x,d.y);
    g.fillStyle='rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(6,10,12,6,0,0,7); g.fill();
    g.strokeStyle='#c8d6de'; g.lineWidth=2; g.beginPath(); g.moveTo(-10,-10); g.lineTo(10,10); g.moveTo(10,-10); g.lineTo(-10,10); g.stroke();
    for(const [x,y] of [[-10,-10],[10,-10],[-10,10],[10,10]]){ g.save(); g.translate(x,y); g.rotate(t*30); g.fillStyle='rgba(200,214,222,0.5)'; g.fillRect(-6,-1,12,2); g.restore(); }
    g.fillStyle='#2a3940'; g.beginPath(); g.arc(0,0,7,0,7); g.fill(); g.fillStyle=col; g.beginPath(); g.arc(0,0,3.5,0,7); g.fill();
    g.restore();
    g.fillStyle='#0c1418'; g.fillRect(d.x-11,d.y+15,22,4); g.fillStyle=d.battery<20?'#eb5757':'#6fe39a'; g.fillRect(d.x-11,d.y+15,22*d.battery/100,4);
    if(d===this.selected){ g.strokeStyle='#fff'; g.setLineDash([4,4]); g.beginPath(); g.arc(d.x,d.y,19,0,7); g.stroke(); g.setLineDash([]); }
    this.label(g,d.x,d.y-24,q,col);
  }
}
/* Diagrama de un autómata (compartido por el Modo Autómata y el Laboratorio) */
function drawAutomaton(cv,def,cur,last,age){
  const dpr=Math.min(window.devicePixelRatio||1,2), W=cv.clientWidth||320, H=cv.clientHeight||220;
  if(cv.width!==Math.floor(W*dpr)){ cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const ids=def.estados.map(e=>e.id), pos={};
  const R=Math.max(14,Math.min(24,Math.min(W,H)/10));
  ids.forEach((id,i)=>{ const L=def.layout&&def.layout[id]; if(L) pos[id]=[R+12+L[0]*(W-2*R-24),R+12+L[1]*(H-2*R-24)]; else { const a=-Math.PI/2+i*2*Math.PI/ids.length; pos[id]=[W/2+Math.cos(a)*(W/2-R-14),H/2+Math.sin(a)*(H/2-R-14)]; } });
  const edges={}, global={};
  // símbolos que llevan al mismo estado desde todos los demás se dibujan una sola vez
  const bySym={}; for(const t of def.transiciones){ if(t.desde!==t.hacia){ const k=t.simbolo+'>'+t.hacia; (bySym[k]=bySym[k]||new Set()).add(t.desde); } }
  for(const k in bySym) if(ids.length>3 && bySym[k].size===ids.length-1){ const [s,h]=k.split('>'); (global[h]=global[h]||[]).push(s); }
  for(const t of def.transiciones){ if(!pos[t.desde]||!pos[t.hacia]) continue; if(t.desde===t.hacia) continue; if(global[t.hacia]&&global[t.hacia].includes(t.simbolo)) continue; const k=t.desde+'>'+t.hacia; (edges[k]=edges[k]||[]).push(t.simbolo); }
  const ink='#e8efe9', muted='#8aa2ad', hot='#ffb347';
  for(const k in edges){
    const [a,b]=k.split('>'); const [x1,y1]=pos[a], [x2,y2]=pos[b];
    const both=edges[b+'>'+a]!==undefined; const isLast=last&&last.cambio&&last.desde===a&&last.hacia===b;
    const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, off=both?18:0;
    const cx=(x1+x2)/2+nx*off, cy=(y1+y2)/2+ny*off;
    const sa=Math.atan2(cy-y1,cx-x1), ea=Math.atan2(y2-cy,x2-cx);
    const sx=x1+Math.cos(sa)*R, sy=y1+Math.sin(sa)*R, ex=x2-Math.cos(ea)*(R+2), ey=y2-Math.sin(ea)*(R+2);
    g.strokeStyle=isLast?hot:muted; g.lineWidth=isLast?3:1.2; g.globalAlpha=isLast?Math.max(0.5,1-age/2):0.85;
    g.beginPath(); g.moveTo(sx,sy); g.quadraticCurveTo(cx,cy,ex,ey); g.stroke();
    g.fillStyle=g.strokeStyle; g.beginPath(); g.moveTo(ex,ey); g.lineTo(ex-Math.cos(ea-0.4)*8,ey-Math.sin(ea-0.4)*8); g.lineTo(ex-Math.cos(ea+0.4)*8,ey-Math.sin(ea+0.4)*8); g.closePath(); g.fill();
    g.globalAlpha=1; const lx=(sx+2*cx+ex)/4, ly=(sy+2*cy+ey)/4;
    g.font=(isLast?'bold ':'')+'11px "JetBrains Mono",monospace'; const txt=edges[k].join(','); const tw=g.measureText(txt).width+6;
    g.fillStyle='rgba(12,22,27,0.9)'; g.fillRect(lx-tw/2,ly-7,tw,14); g.fillStyle=isLast?hot:ink; g.textAlign='center'; g.fillText(txt,lx,ly+4);
  }
  for(const h in global){ if(!pos[h]) continue; const [x,y]=pos[h]; const isLast=last&&last.cambio&&last.hacia===h&&global[h].includes(last.simbolo);
    g.font=(isLast?'bold ':'')+'11px "JetBrains Mono",monospace'; g.fillStyle=isLast?hot:muted; g.textAlign='center'; g.fillText(global[h].join(',')+' desde todos',x,y-R-8); }
  for(const e of def.estados){
    const [x,y]=pos[e.id], act=e.id===cur;
    if(act){ g.fillStyle=(e.color||'#888')+'55'; g.beginPath(); g.arc(x,y,R+8+Math.sin(performance.now()/180)*2,0,7); g.fill(); }
    g.fillStyle=e.color||'#556'; g.beginPath(); g.arc(x,y,R,0,7); g.fill();
    g.lineWidth=act?3.5:1.5; g.strokeStyle=act?'#ffffff':'rgba(0,0,0,0.5)'; g.stroke();
    if(e.id===def.inicial){ g.strokeStyle=muted; g.lineWidth=1.5; g.beginPath(); g.moveTo(x-R-16,y); g.lineTo(x-R-2,y); g.stroke(); g.beginPath(); g.moveTo(x-R-2,y); g.lineTo(x-R-8,y-4); g.lineTo(x-R-8,y+4); g.closePath(); g.fillStyle=muted; g.fill(); }
    g.fillStyle='#10181c'; g.font=`bold ${Math.round(R*0.55)}px "Chakra Petch",sans-serif`; g.textAlign='center'; g.fillText(e.id,x,y+R*0.2);
    if(def.tipo==='moore'&&e.salida){ g.font='10px "Atkinson Hyperlegible",sans-serif'; g.fillStyle=muted; g.fillText('/'+e.salida.split('_')[1],x,y+R+12); }
  }
}
