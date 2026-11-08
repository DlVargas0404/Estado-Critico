/* Bot de juego: comprueba que cada nivel se puede completar con una estrategia simple (sigilo + EMP) */
const Game=require('../src/game.js'), LEVELS=require('../src/levels.js'); const T=Game.TILE;
function attempt(L,wait,order,useEmp=true,careful=false){
  const w=new Game.World(L); let tIdx=0; const goals=[...order.map(i=>w.terminals[i]),w.exit];
  let path=null, gi=0, waitT=wait;
  for(let f=0;f<60*240;f++){
    if(w.state!=='playing') break;
    const inp={sneak:true};
    if(waitT>0){ waitT-=1/60; w.update(1/60,inp); continue; }
    const goal=goals[gi];
    if(!path){ path=w.astar(w.player,goal)||[]; }
    const near=Math.hypot(w.player.x-goal.x,w.player.y-goal.y);
    if(goal!==w.exit && near<T*0.7){ inp.hack=true; if(goal.done){ gi++; path=null; } }
    else { while(path.length && Math.hypot(path[0].x-w.player.x,path[0].y-w.player.y)<4) path.shift(); const n=path[0]||goal; const dx=n.x-w.player.x, dy=n.y-w.player.y, l=Math.hypot(dx,dy)||1; inp.mx=dx/l; inp.my=dy/l; }
    if(careful && inp.mx!==undefined){ const ox=w.player.x, oy=w.player.y; w.player.x+=inp.mx*14; w.player.y+=inp.my*14; const danger=w.guards.some(g=>g.m.actual!=='ATU'&&w.canSee(g,Game.CFG.fov,Game.CFG.visionRange*1.15))||w.cameras.some(c=>w.canSee(c,Game.CFG.camFov,Game.CFG.camRange)); w.player.x=ox; w.player.y=oy; if(danger){ inp.mx=0; inp.my=0; } }
    if(useEmp && w.guards.some(g=>['PER','ATA'].includes(g.m.actual)&&Math.hypot(g.x-w.player.x,g.y-w.player.y)<Game.CFG.empRadius*0.9)) inp.emp=true;
    w.update(1/60,inp);
  }
  return {state:w.state,time:w.time,alarms:w.stats.alarms,spotted:w.stats.spotted};
}
function perms(a){ if(a.length<=1) return [a]; return a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[x,...p])); }
const out={};
for(const L of LEVELS){
  const n=(L.mapa.join('').match(/T/g)||[]).length; 
  for(const careful of [false,true]){ let wins=0, tries=0, best=null, clean=0;
  for(const order of perms([...Array(n).keys()])) for(let wait=0;wait<=20;wait+=2){ tries++; const r=attempt(L,wait,order,true,careful); if(r.state==='won'){ wins++; if(r.alarms===0&&r.spotted===0) clean++; if(!best||r.time<best.time) best=r; } }
  out[L.nombre+(careful?' (bot prudente)':' (bot directo)')]={intentos:tries,victorias:wins,sinSerVisto:clean,tasa:+(wins/tries*100).toFixed(1),mejorTiempo:best?+best.time.toFixed(1):null}; }

}
console.log(JSON.stringify(out,null,1)); require('fs').writeFileSync(__dirname+'/bot.json',JSON.stringify(out,null,1));
