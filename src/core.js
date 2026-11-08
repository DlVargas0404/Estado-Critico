/* ===== Núcleo de autómatas (independiente del juego) ===== */
'use strict';
const SYM_INFO = {
  s:{nombre:'EMP',desc:'Golpeado por pulso EMP',prioridad:1},
  c:{nombre:'Cerca',desc:'Jugador en rango de ataque',prioridad:2},
  v:{nombre:'Visto',desc:'Jugador en el cono de visión',prioridad:3},
  p:{nombre:'Perdido',desc:'El jugador deja de ser visible',prioridad:4},
  l:{nombre:'Lejos',desc:'Sale del rango de ataque',prioridad:5},
  g:{nombre:'Alerta',desc:'Alarma global',prioridad:6},
  r:{nombre:'Ruido',desc:'Ruido dentro del radio de oído',prioridad:7},
  d:{nombre:'Destino',desc:'Llegó al punto objetivo',prioridad:8},
  t:{nombre:'Tiempo',desc:'Temporizador agotado',prioridad:9},
  b:{nombre:'Batería',desc:'Batería baja',prioridad:3},
  k:{nombre:'Carga',desc:'Carga completa',prioridad:9}
};
function mkTransitions(table, alfabeto, salidaDe){
  const tr=[];
  for(const q of Object.keys(table)) for(const s of alfabeto){
    const h=(table[q][s]!==undefined)?table[q][s]:q;
    tr.push({desde:q,simbolo:s,hacia:h,accion:salidaDe(q,s,h)});
  }
  return tr;
}
const CENT_TABLE={
  PAT:{v:'PER',r:'INV',c:'PER',g:'INV',s:'ATU'},
  INV:{v:'PER',c:'PER',t:'REG',d:'BUS',s:'ATU'},
  PER:{c:'ATA',p:'BUS',s:'ATU'},
  ATA:{l:'PER',p:'BUS',s:'ATU'},
  BUS:{v:'PER',c:'PER',r:'INV',t:'REG',s:'ATU'},
  REG:{v:'PER',c:'PER',r:'INV',g:'INV',d:'PAT',s:'ATU'},
  ATU:{t:'BUS'}
};
const CENT_ENTRY={PAT:'seguir_ruta',INV:'ir_a_ruido',PER:'perseguir',ATA:'atacar',BUS:'barrer_zona',REG:'volver_a_ruta',ATU:'quedar_inmovil'};
const CENT_SPECIAL={'PAT|d':'siguiente_punto','INV|r':'actualizar_objetivo','INV|g':'actualizar_objetivo','ATA|t':'repetir_ataque','PER|v':'actualizar_objetivo'};
const DEFS={
  centinela:{
    id:'centinela',nombre:'Centinela',tipo:'mealy',
    alfabeto:['v','r','c','l','p','t','d','g','s'],inicial:'PAT',
    estados:[
      {id:'PAT',nombre:'Patrullar',color:'#5fbf73',salida:'seguir_ruta'},
      {id:'INV',nombre:'Investigar',color:'#f2c94c',salida:'ir_a_ruido'},
      {id:'PER',nombre:'Perseguir',color:'#f2994a',salida:'perseguir'},
      {id:'ATA',nombre:'Atacar',color:'#eb5757',salida:'atacar'},
      {id:'BUS',nombre:'Buscar',color:'#b48ee6',salida:'barrer_zona'},
      {id:'REG',nombre:'Regresar',color:'#5aa7e6',salida:'volver_a_ruta'},
      {id:'ATU',nombre:'Aturdido',color:'#9aa5b1',salida:'quedar_inmovil'}],
    transiciones:mkTransitions(CENT_TABLE,['v','r','c','l','p','t','d','g','s'],(q,s,h)=>h!==q?CENT_ENTRY[h]:(CENT_SPECIAL[q+'|'+s]||'mantener')),
    layout:{PAT:[0.02,0.3],INV:[0.38,0.06],REG:[0.98,0.06],PER:[0.36,0.62],BUS:[0.8,0.5],ATA:[0.66,0.98],ATU:[0.06,0.95]}
  },
  camara:{
    id:'camara',nombre:'Cámara',tipo:'moore',alfabeto:['v','p','t'],inicial:'BAR',
    estados:[
      {id:'BAR',nombre:'Barrido',color:'#5fbf73',salida:'luz_verde'},
      {id:'DET',nombre:'Detectando',color:'#f2c94c',salida:'luz_amarilla'},
      {id:'ALA',nombre:'Alarma',color:'#eb5757',salida:'luz_roja_emitir_g'}],
    transiciones:mkTransitions({BAR:{v:'DET'},DET:{p:'BAR',t:'ALA'},ALA:{t:'BAR'}},['v','p','t'],(q,s,h)=>({BAR:'luz_verde',DET:'luz_amarilla',ALA:'luz_roja_emitir_g'})[h]),
    layout:{BAR:[0.15,0.5],DET:[0.5,0.2],ALA:[0.85,0.5]}
  },
  dron:{
    id:'dron',nombre:'Dron rastreador',tipo:'mealy',alfabeto:['v','p','t','b','k'],inicial:'ORB',
    estados:[
      {id:'ORB',nombre:'Orbitar',color:'#5fbf73',salida:'orbitar'},
      {id:'RAS',nombre:'Rastrear',color:'#f2994a',salida:'seguir'},
      {id:'MAR',nombre:'Marcar',color:'#eb5757',salida:'emitir_g'},
      {id:'REC',nombre:'Recargar',color:'#9aa5b1',salida:'ir_a_base'}],
    transiciones:mkTransitions({ORB:{v:'RAS',b:'REC'},RAS:{t:'MAR',p:'ORB',b:'REC'},MAR:{t:'RAS',p:'ORB',b:'REC'},REC:{k:'ORB'}},['v','p','t','b','k'],
      (q,s,h)=>h===q?'mantener':({ORB:'volver',RAS:'seguir',MAR:'emitir_g',REC:'ir_a_base'})[h]+(q==='REC'&&h==='ORB'?'':'')).map(t=>t.desde==='REC'&&t.hacia==='ORB'?{...t,accion:'despegar'}:t),
    layout:{ORB:[0.15,0.5],RAS:[0.45,0.18],MAR:[0.82,0.4],REC:[0.55,0.85]}
  }
};
/* Ejemplo defectuoso para el Laboratorio: no determinista, incompleto, con estado inalcanzable */
DEFS.defectuoso={id:'defectuoso',nombre:'Guardia defectuoso (ejemplo)',tipo:'mealy',alfabeto:['v','p','t'],inicial:'A',
  estados:[{id:'A',nombre:'Patrullar',color:'#5fbf73'},{id:'B',nombre:'Perseguir',color:'#f2994a'},{id:'C',nombre:'Fantasma',color:'#9aa5b1'}],
  transiciones:[{desde:'A',simbolo:'v',hacia:'B',accion:'perseguir'},{desde:'A',simbolo:'v',hacia:'A',accion:'mantener'},{desde:'A',simbolo:'p',hacia:'A',accion:'mantener'},
    {desde:'B',simbolo:'p',hacia:'A',accion:'volver'},{desde:'B',simbolo:'v',hacia:'B',accion:'mantener'},{desde:'B',simbolo:'t',hacia:'B',accion:'mantener'},{desde:'C',simbolo:'v',hacia:'A',accion:'x'}],
  layout:{A:[0.2,0.5],B:[0.6,0.3],C:[0.75,0.8]}};
/* Ejemplo redundante: tiene estados equivalentes para la minimización */
DEFS.redundante={id:'redundante',nombre:'Guardia redundante (ejemplo)',tipo:'mealy',alfabeto:['v','p'],inicial:'P1',
  estados:[{id:'P1',nombre:'Patrulla 1',color:'#5fbf73'},{id:'P2',nombre:'Patrulla 2',color:'#5fbf73'},{id:'X',nombre:'Perseguir',color:'#f2994a'}],
  transiciones:[{desde:'P1',simbolo:'v',hacia:'X',accion:'perseguir'},{desde:'P1',simbolo:'p',hacia:'P2',accion:'mantener'},
    {desde:'P2',simbolo:'v',hacia:'X',accion:'perseguir'},{desde:'P2',simbolo:'p',hacia:'P1',accion:'mantener'},
    {desde:'X',simbolo:'v',hacia:'X',accion:'mantener'},{desde:'X',simbolo:'p',hacia:'P1',accion:'volver'}],
  layout:{P1:[0.2,0.3],P2:[0.2,0.75],X:[0.75,0.5]}};

class MaquinaEstados{
  constructor(def){
    const v=validar(def);
    if(!v.valido) { const e=new Error('Definición inválida: '+v.errores.join('; ')); e.validacion=v; throw e; }
    this.def=def; this.delta={}; this.lambda={};
    for(const t of def.transiciones){ this.delta[t.desde+'|'+t.simbolo]=t.hacia; this.lambda[t.desde+'|'+t.simbolo]=t.accion; }
    this.estados={}; for(const e of def.estados) this.estados[e.id]=e;
    this.reiniciar(); this.oyentes=[];
  }
  reiniciar(){ this.actual=this.def.inicial; this.traza=[]; this.ultima=null; }
  alSuceder(fn){ this.oyentes.push(fn); }
  procesar(simbolo, tiempo){
    const clave=this.actual+'|'+simbolo;
    if(!(clave in this.delta)) throw new Error('Símbolo fuera del alfabeto: '+simbolo);
    const desde=this.actual, hacia=this.delta[clave], salida=this.def.tipo==='moore'?this.estados[hacia].salida:this.lambda[clave];
    this.actual=hacia;
    const reg={desde,simbolo,hacia,salida,tiempo:tiempo||0,cambio:desde!==hacia};
    this.ultima=reg; this.traza.push(reg); if(this.traza.length>500) this.traza.shift();
    for(const f of this.oyentes) f(reg);
    return reg;
  }
  cadena(n){ return this.traza.slice(-(n||this.traza.length)).map(r=>r.simbolo).join(''); }
}
function deltaEstrella(def,q,w){
  const m={}; for(const t of def.transiciones) if(!(t.desde+'|'+t.simbolo in m)) m[t.desde+'|'+t.simbolo]=t;
  const pasos=[]; let cur=q;
  for(const s of w){ const t=m[cur+'|'+s]; if(!t) return {final:null,pasos,error:`δ(${cur}, ${s}) no está definida`}; pasos.push({desde:cur,simbolo:s,hacia:t.hacia,salida:t.accion}); cur=t.hacia; }
  return {final:cur,pasos};
}
function validar(def){
  const errores=[], avisos=[], res={determinista:true,completo:true,duplicados:[],faltantes:[],inalcanzables:[],simbolosInvalidos:[],estadosInvalidos:[]};
  if(!def||!Array.isArray(def.estados)||!Array.isArray(def.alfabeto)||!Array.isArray(def.transiciones)) return {...res,valido:false,errores:['Estructura incompleta: se requieren estados, alfabeto y transiciones'],avisos};
  const Q=new Set(def.estados.map(e=>e.id)), S=new Set(def.alfabeto);
  if(Q.size!==def.estados.length) errores.push('Hay identificadores de estado repetidos');
  if(!Q.has(def.inicial)) { errores.push(`El estado inicial "${def.inicial}" no existe`); res.estadosInvalidos.push(def.inicial); }
  const vistos={};
  for(const t of def.transiciones){
    if(!Q.has(t.desde)) res.estadosInvalidos.push(t.desde);
    if(!Q.has(t.hacia)) res.estadosInvalidos.push(t.hacia);
    if(!S.has(t.simbolo)) res.simbolosInvalidos.push(t.simbolo);
    const k=t.desde+'|'+t.simbolo;
    if(k in vistos && vistos[k]!==t.hacia+'|'+t.accion){ res.determinista=false; res.duplicados.push([t.desde,t.simbolo]); }
    else if(k in vistos){ avisos.push(`Transición repetida idéntica en (${t.desde}, ${t.simbolo})`); }
    vistos[k]=t.hacia+'|'+t.accion;
  }
  for(const q of Q) for(const s of S) if(!(q+'|'+s in vistos)){ res.completo=false; res.faltantes.push([q,s]); }
  // alcanzabilidad: BFS desde q0
  if(Q.has(def.inicial)){
    const adj={}; for(const t of def.transiciones){ (adj[t.desde]=adj[t.desde]||[]).push(t.hacia); }
    const seen=new Set([def.inicial]), cola=[def.inicial];
    while(cola.length){ const q=cola.shift(); for(const h of adj[q]||[]) if(!seen.has(h)){seen.add(h);cola.push(h);} }
    for(const q of Q) if(!seen.has(q)) res.inalcanzables.push(q);
  }
  res.estadosInvalidos=[...new Set(res.estadosInvalidos)]; res.simbolosInvalidos=[...new Set(res.simbolosInvalidos)];
  if(res.estadosInvalidos.length) errores.push('Estados no declarados: '+res.estadosInvalidos.join(', '));
  if(res.simbolosInvalidos.length) errores.push('Símbolos fuera del alfabeto: '+res.simbolosInvalidos.join(', '));
  if(!res.determinista) errores.push('No determinista en: '+res.duplicados.map(d=>`(${d[0]}, ${d[1]})`).join(', '));
  if(!res.completo) errores.push('Incompleto, faltan: '+res.faltantes.map(d=>`(${d[0]}, ${d[1]})`).join(', '));
  if(res.inalcanzables.length) avisos.push('Estados inalcanzables desde '+def.inicial+': '+res.inalcanzables.join(', '));
  return {...res,valido:errores.length===0,errores,avisos};
}
/* Minimización por refinamiento de particiones (Moore/Hopcroft) sobre estados alcanzables.
   Para Mealy la partición inicial agrupa por vector de salidas; para Moore por salida del estado. */
function minimizar(def){
  const v=validar(def); if(!v.valido) return {error:'Solo se pueden minimizar autómatas válidos (deterministas y completos).',validacion:v};
  const alc=def.estados.map(e=>e.id).filter(q=>!v.inalcanzables.includes(q));
  const d={}, o={}; for(const t of def.transiciones){ d[t.desde+'|'+t.simbolo]=t.hacia; o[t.desde+'|'+t.simbolo]=t.accion; }
  const est={}; for(const e of def.estados) est[e.id]=e;
  const firma0=q=>def.tipo==='moore'?String(est[q].salida):def.alfabeto.map(s=>o[q+'|'+s]).join(',');
  let clase={}; const ids={}; for(const q of alc){ const f=firma0(q); if(!(f in ids)) ids[f]=Object.keys(ids).length; clase[q]=ids[f]; }
  let iter=0;
  while(true){
    iter++;
    const nids={}, nclase={};
    for(const q of alc){ const f=clase[q]+'#'+def.alfabeto.map(s=>clase[d[q+'|'+s]]).join(','); if(!(f in nids)) nids[f]=Object.keys(nids).length; nclase[q]=nids[f]; }
    const n1=new Set(Object.values(clase)).size, n2=new Set(Object.values(nclase)).size;
    clase=nclase; if(n1===n2||iter>100) break;
  }
  const grupos={}; for(const q of alc) (grupos[clase[q]]=grupos[clase[q]]||[]).push(q);
  const bloques=Object.values(grupos);
  return {bloques,eliminadosInalcanzables:v.inalcanzables,original:def.estados.length,minimo:bloques.length,esMinimo:bloques.length===def.estados.length&&v.inalcanzables.length===0,iteraciones:iter};
}
function prioridad(s){ return (SYM_INFO[s]||{prioridad:99}).prioridad; }
function seleccionarSimbolo(candidatos){ let best=null; for(const s of candidatos) if(best===null||prioridad(s)<prioridad(best)) best=s; return best; }
const Core={SYM_INFO,DEFS,MaquinaEstados,deltaEstrella,validar,minimizar,seleccionarSimbolo,prioridad};
if(typeof module!=='undefined') module.exports=Core;
