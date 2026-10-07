// v0.9.8 TEST – stabilization wrapper.
// Keeps v0.9.7 mechanics, fixes test inventory drift and relationship migration.
export * from './engine-v096.js?v=098';
import * as prev from './engine-v096.js?v=098';
import {ITEM_DEFS,STATUS_DEFS} from './data.js?v=096b';

const ALLOWED_STATUSES=new Set([
  'hangover','pigeonHumiliated','suspicious','scared','angry',
  'yebatorium','tipsy','skunk','tired','blessed','cowLicked'
]);

function testConfig(){
  try{return JSON.parse(localStorage.getItem('dnt-test-v096')||'{}')||{}}catch{return{}}
}
function ensureArray(obj,key){if(!Array.isArray(obj[key]))obj[key]=[];return obj[key]}
function ensureTestItem(s,id,qty){
  if(!ITEM_DEFS[id])return;
  s.inventory=Array.isArray(s.inventory)?s.inventory:[];
  const cur=s.inventory.find(x=>x?.id===id);
  if(cur)cur.qty=Math.max(Number(cur.qty||0),qty);
  else s.inventory.push({id,qty});
}
function syncTestState(s){
  if(!s?.flags?.testMode)return s;
  const cfg=testConfig();
  if(cfg.all097){
    const discovered=ensureArray(s,'discoveredStatuses');
    for(const id of ALLOWED_STATUSES)if(STATUS_DEFS[id]&&!discovered.includes(id))discovered.push(id);
    for(const [id,def] of Object.entries(ITEM_DEFS)){
      const stack=Math.max(1,Number(def?.stack||1));
      ensureTestItem(s,id,Math.min(stack,3));
    }
    s.unlocks=s.unlocks||{};
    s.flags=s.flags||{};
    s.unlocks.yebatorium=true;
    s.unlocks.sunsetContempt=true;
    s.unlocks.prayer=true;
    s.flags.prayerUnlocked=true;
  }
  return s;
}
function ensureRelationship(s,id,name,values={}){
  s.relationships=s.relationships||{};
  const old=s.relationships[id]||{};
  s.relationships[id]={
    name:old.name||name,
    known:Boolean(old.known),
    values:{...values,...(old.values||{})},
    discoveredParams:Array.isArray(old.discoveredParams)?old.discoveredParams:[]
  };
  return s.relationships[id];
}
function syncRelationships(s){
  if(!s)return s;
  const entered=new Set(s.story?.entered||[]);
  const evp=ensureRelationship(s,'evpapiy','Євпапій',{trust:2,offense:4,greed:8,bullshit:6});
  const gal=ensureRelationship(s,'galina','Баба Галя',{trust:5,offense:0});
  const hood=ensureRelationship(s,'hood','Постать',{trust:0,offense:0});
  const cat=ensureRelationship(s,'cat','Риже гамно',{trust:0,offense:0});
  const creature=ensureRelationship(s,'creature','ТРУПОСМЕРД',{attitude:0});
  const semen=ensureRelationship(s,'semen','Семен',{trust:0,offense:0});
  if(s.flags?.metPigeon||entered.has('poop'))evp.known=true;
  if(gal.known||[...entered].some(x=>/^galina/i.test(String(x))))gal.known=true;
  if(entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x))))hood.known=true;
  if(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')))cat.known=true;
  if(entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x))))creature.known=true;
  if(s.flags?.semenIntroduced098||s.flags?.semenIntroduced||entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_')))semen.known=true;
  return s;
}
function post(s){return syncRelationships(syncTestState(s))}

export function normalizeState(raw){return post(prev.normalizeState(raw))}

export function executeAction(state,action){
  const r=prev.executeAction(state,action);
  return{...r,state:post(r.state)};
}

export function useItem(state,id){
  const r=prev.useItem(state,id);
  return r?.state?{...r,state:post(r.state)}:r;
}
