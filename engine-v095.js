export * from './engine.js?core=093';
import * as core from './engine.js?core=093';
import {STAT_KEYS} from './config.js?v=093';
import {STATUS_DEFS,CLOTHES} from './data.js?v=093';

function scaledStatusMods(state){
  const out=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  const level=Math.max(1,Number(state?.heroProgression?.level||1));
  // Бафи ростуть повільно: +1 до кожного позитивного модифікатора на 4, 7 і 10 рівнях.
  // Дебафи ніколи не масштабуються.
  const bonus=Math.floor((level-1)/3);
  for(const id of state?.activeStatuses||[]){
    const d=STATUS_DEFS[id];
    for(const [k,raw] of Object.entries(d?.mods||{})){
      if(!(k in out))continue;
      const v=Number(raw||0);
      out[k]+=v>0?v+bonus:v;
    }
  }
  const shield=(state?.activeStatuses||[]).reduce((n,id)=>Math.max(n,Number(STATUS_DEFS[id]?.negativeModShield||0)),0);
  if(shield>0)for(const k of STAT_KEYS)if(out[k]<0)out[k]=Math.min(0,out[k]+shield);
  return out;
}

export function statModifiers(state){
  const out=scaledStatusMods(state);
  for(const id of Object.values(state?.equipment||{})){
    const d=CLOTHES[id];
    for(const [k,v] of Object.entries(d?.statMods||{}))if(k in out)out[k]+=Number(v||0);
  }
  return out;
}

export function effectiveStat(state,key){
  return Math.max(0,core.permanentStat(state,key)+Number(statModifiers(state)[key]||0));
}

// v0.9.5q: old saves could contain СОБАКА-ПОДОЗРЄВАКА without a timer,
// because the status originally had no duration. Give it a timer once on load.
export function normalizeState(raw){
  const s=core.normalizeState(raw);
  if((s.activeStatuses||[]).includes('suspicious')&&!Number.isFinite(Number(s.statusTimers?.suspicious))){
    s.statusTimers={...(s.statusTimers||{}),suspicious:Number(s.clock?.totalMinutes||0)+30};
  }
  return s;
}

const HIGH_STORY_DANGER=new Set([
  'ch2_bang','ch2_bang3','ch2_after_bang','ch2_side','ch2_garlic','ch2_salo','ch2_pigeon_scared','ch2_figure','ch2_end',
  'ch3_intro','ch3_obey','ch3_turn','ch3_call_pigeon','ch3_tell_off','ch3_creature','ch3_vodka','ch3_garlic','ch3_garlic_hit','ch3_ask_pigeon','ch3_run','ch3_pray',
  'ch3_pray095_2','ch3_pray095_3','ch3_pray095_4'
]);
export function threatInfo(state){
  const scene=String(state?.story?.sceneId||state?.scene||'');
  const base=core.threatInfo(state);
  // Critical physical condition still wins over story danger.
  if(base.key==='critical')return base;
  if(HIGH_STORY_DANGER.has(scene))return{key:'high',label:'ВИСОКА',reason:'поруч пряма сюжетна небезпека'};
  return base;
}
