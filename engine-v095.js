export * from './engine.js?core=093';
import {permanentStat} from './engine.js?core=093';
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
  return Math.max(0,permanentStat(state,key)+Number(statModifiers(state)[key]||0));
}
