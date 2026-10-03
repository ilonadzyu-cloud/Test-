// v0.8.7 – isolated combat test. It reads the current run, but never saves battle results.
import {createInitialState,normalizeState,effectiveStat,equipmentTotals} from './engine.js?v=086';
import {STATUS_DEFS} from './data.js?v=086';
import {loadRun} from './storage.js?v=083';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

let sourceState=null;
let battle=null;
let overlay=null;
let settingsObserver=null;

function ensureBattleCss(){
  if(document.querySelector('link[data-battle-css="087"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./battle.css?v=087';
  link.dataset.battleCss='087';
  document.head.appendChild(link);
}

function currentRunId(){
  const meta=document.querySelector('#menuMeta')?.textContent||'';
  const m=meta.match(/Проходження\s+(\d+)/i);
  return Math.max(1,Number(m?.[1]||1));
}

async function readCurrentState(runId){
  try{
    const raw=await loadRun(runId);
    return normalizeState(raw||createInitialState(runId));
  }catch{
    return normalizeState(createInitialState(runId));
  }
}

function statusSet(){return new Set(sourceState?.activeStatuses||[])}
function hasStatus(id){return statusSet().has(id)}
function heroStat(key){return effectiveStat(sourceState,key)}
function armor(){return Number(equipmentTotals(sourceState).armor||0)}

function energyCost(base){
  let extra=0;
  if(hasStatus('tired'))extra+=2;
  if(hasStatus('overheated'))extra+=2;
  if(hasStatus('thirsty'))extra+=1;
  return Math.max(0,base+extra);
}

function freshBattle(){
  const hp=clamp(Math.round(Number(sourceState?.health||100)),1,100);
  const energy=clamp(Math.round(Number(sourceState?.needs?.energy||65)),0,100);
  return {
    heroMax:100,heroHp:hp,heroEnergy:energy,
    enemyMax:100,enemyHp:100,
    turn:1,result:null,mode:'actions',
    firstDamageAction:true,dodging:false,blindTurns:0,angryOnionTurns:0,stunTurns:0,
    pigeonThrown:false,pigeonUsed:false,sunsetUsed:false,
    items:{onion:2,onionAngry:1,onionSmelly:1},
    log:['ПОЧИНАЄТЬСЯ БІЙ']
  };
}

function addLog(text){
  if(!text)return;
  battle.log.push(text);
  battle.log=battle.log.slice(-3);
}

function spend(cost){
  if(battle.heroEnergy<cost){addLog('Не вистачає бадьорості.');return false}
  battle.heroEnergy=clamp(battle.heroEnergy-cost,0,100);
  return true;
}

function physicalDamage(base){
  let damage=base+Math.floor(heroStat('strength')*.45);
  if(hasStatus('hungry'))damage=Math.max(1,Math.round(damage*.85));
  if(hasStatus('hangover')&&battle.firstDamageAction)damage=Math.max(1,Math.round(damage*.75));
  battle.firstDamageAction=false;
  return damage;
}

function hurtEnemy(amount,label){
  const n=Math.max(0,Math.round(amount));
  battle.enemyHp=clamp(battle.enemyHp-n,0,battle.enemyMax);
  addLog(`${label} -${n}`);
}

function checkEnd(){
  if(battle.enemyHp<=0){battle.result='win';battle.mode='result';return true}
  if(battle.heroHp<=0){battle.result='lose';battle.mode='result';return true}
  return false;
}

function enemyPhase(){
  if(checkEnd())return;

  if(battle.angryOnionTurns>0){
    battle.enemyHp=clamp(battle.enemyHp-4,0,battle.enemyMax);
    battle.angryOnionTurns-=1;
    addLog('Зла цибуля: -4');
    if(checkEnd())return;
  }

  if(hasStatus('skunk')){
    battle.enemyHp=clamp(battle.enemyHp-3,0,battle.enemyMax);
    addLog('ДИКИЙ СКУНС: -3');
    if(checkEnd())return;
    if(Math.random()<.2){
      addLog('Ворог пропускає хід.');
      battle.dodging=false;
      battle.heroEnergy=clamp(battle.heroEnergy+4,0,100);
      return;
    }
  }

  if(battle.stunTurns>0){
    battle.stunTurns-=1;
    addLog('Ворог оглушений.');
    battle.dodging=false;
    battle.heroEnergy=clamp(battle.heroEnergy+4,0,100);
    return;
  }

  let hitChance=.82;
  if(battle.blindTurns>0){hitChance*=.48;battle.blindTurns-=1}
  if(battle.dodging){
    const dodgeChance=clamp(.45+heroStat('agility')*.035,0.45,.9);
    hitChance*=1-dodgeChance;
  }

  if(Math.random()<hitChance){
    const raw=13+Math.floor(Math.random()*5);
    const damage=Math.max(1,raw-armor());
    battle.heroHp=clamp(battle.heroHp-damage,0,battle.heroMax);
    addLog(`Вам прилетіло. -${damage}`);
  }else{
    addLog('Ворог промазав.');
  }

  battle.dodging=false;
  battle.heroEnergy=clamp(battle.heroEnergy+4,0,100);
  checkEnd();
}

function finishHeroAction(){
  if(checkEnd()){renderBattle();return}
  enemyPhase();
  if(!battle.result)battle.turn+=1;
  battle.mode=battle.result?'result':'actions';
  renderBattle();
}

function actKnife(){
  const cost=energyCost(7);
  if(!spend(cost)){renderBattle();return}
  hurtEnemy(physicalDamage(14),'Ніж');
  finishHeroAction();
}

function actDodge(){
  const cost=energyCost(hasStatus('hangover')?10:8);
  if(!spend(cost)){renderBattle();return}
  battle.dodging=true;
  addLog('Ви відскочили.');
  finishHeroAction();
}

function actPigeon(){
  const cost=energyCost(10);
  if(!spend(cost)){renderBattle();return}
  battle.pigeonThrown=true;
  battle.pigeonUsed=true;
  hurtEnemy(physicalDamage(8),'Євпапій');
  finishHeroAction();
}

function actSunset(){
  const cost=energyCost(6);
  if(!spend(cost)){renderBattle();return}
  battle.sunsetUsed=true;
  battle.pigeonUsed=true;
  const damage=Math.max(1,Math.ceil(battle.enemyHp/2));
  hurtEnemy(damage,'ЗАКАТ ПРЄЗРЄНІЯ');
  finishHeroAction();
}

function actItem(id){
  const cost=energyCost(4);
  if(!spend(cost)){renderBattle();return}

  if(id==='onion'&&battle.items.onion>0){
    battle.items.onion-=1;
    battle.enemyHp=clamp(battle.enemyHp-5,0,battle.enemyMax);
    battle.blindTurns=1;
    addLog('Звичайна цибуля: -5');
  }else if(id==='onionAngry'&&battle.items.onionAngry>0){
    battle.items.onionAngry-=1;
    battle.enemyHp=clamp(battle.enemyHp-7,0,battle.enemyMax);
    battle.angryOnionTurns=3;
    addLog('Зла цибуля вчепилась у шию. -7');
  }else if(id==='onionSmelly'&&battle.items.onionSmelly>0){
    battle.items.onionSmelly-=1;
    battle.stunTurns=2;
    addLog('Вонюча цибуля. Ворог вирубився.');
  }

  finishHeroAction();
}

function statusChips(){
  const ids=(sourceState?.activeStatuses||[]).filter(id=>STATUS_DEFS[id]);
  if(!ids.length)return'<span class="battle-no-state">СТАНІВ НЕМА</span>';
  return ids.map(id=>`<span>${esc(STATUS_DEFS[id].name)}</span>`).join('');
}

function actionButton(label,action,{disabled=false,extra=''}={}){
  return `<button type="button" class="battle-action ${extra}" data-battle-action="${action}" ${disabled?'disabled':''}>${esc(label)}</button>`;
}

function renderActionArea(){
  if(battle.mode==='items'){
    const c=energyCost(4),noEnergy=battle.heroEnergy<c;
    return `<div class="battle-actions battle-items">
      ${actionButton(`ЗВИЧАЙНА ЦИБУЛЯ ×${battle.items.onion}`,'item-onion',{disabled:noEnergy||battle.items.onion<=0})}
      ${actionButton(`ЗЛА ЦИБУЛЯ ×${battle.items.onionAngry}`,'item-angry',{disabled:noEnergy||battle.items.onionAngry<=0})}
      ${actionButton(`ВОНЮЧА ЦИБУЛЯ ×${battle.items.onionSmelly}`,'item-smelly',{disabled:noEnergy||battle.items.onionSmelly<=0})}
      ${actionButton('НАЗАД','items-back',{extra:'ghost'})}
    </div>`;
  }

  const knifeCost=energyCost(7),dodgeCost=energyCost(hasStatus('hangover')?10:8),pigeonCost=energyCost(10),sunsetCost=energyCost(6);
  return `<div class="battle-actions">
    ${actionButton('ВʼЄБАТИ НОЖЕМ','knife',{disabled:battle.heroEnergy<knifeCost})}
    ${actionButton('ВІДСКОЧИТИ','dodge',{disabled:battle.heroEnergy<dodgeCost})}
    ${actionButton('КИНУТИ ПРЕДМЕТ','items',{disabled:!Object.values(battle.items).some(Boolean)||battle.heroEnergy<energyCost(4)})}
    ${!battle.pigeonThrown?actionButton('КИНУТИ ЄВПАПІЄМ','pigeon',{disabled:battle.heroEnergy<pigeonCost}):''}
    ${!battle.sunsetUsed?actionButton('ЗАКАТ ПРЄЗРЄНІЯ','sunset',{disabled:battle.heroEnergy<sunsetCost,extra:'special'}):''}
  </div>`;
}

function resultHtml(){
  const title=battle.result==='win'?'ПЕРЕМОГА':'ВИ ЗДОХЛИ';
  const pigeon=battle.pigeonUsed?'<p>– Ще раз так зробиш – наступний полетиш ти.</p>':'';
  return `<div class="battle-result"><b>${title}</b>${pigeon}<small>Це тест. Сейв не змінено.</small><div>${actionButton('ЩЕ РАЗ','restart')}${actionButton('ЗАКРИТИ','close',{extra:'ghost'})}</div></div>`;
}

function renderBattle(){
  if(!overlay||!battle)return;
  const enemyPct=clamp(battle.enemyHp/battle.enemyMax*100,0,100);
  const heroPct=clamp(battle.heroHp/battle.heroMax*100,0,100);
  const energyPct=clamp(battle.heroEnergy,0,100);
  overlay.querySelector('[data-enemy-hp]').textContent=`${battle.enemyHp}/${battle.enemyMax}`;
  overlay.querySelector('[data-enemy-bar]').style.width=`${enemyPct}%`;
  overlay.querySelector('[data-hero-hp]').textContent=`${battle.heroHp}/${battle.heroMax}`;
  overlay.querySelector('[data-hero-bar]').style.width=`${heroPct}%`;
  overlay.querySelector('[data-energy]').textContent=`${battle.heroEnergy}%`;
  overlay.querySelector('[data-energy-bar]').style.width=`${energyPct}%`;
  overlay.querySelector('[data-battle-turn]').textContent=`ХІД ${battle.turn}`;
  overlay.querySelector('[data-battle-states]').innerHTML=statusChips();
  overlay.querySelector('[data-battle-log]').innerHTML=battle.log.map(x=>`<div>${esc(x)}</div>`).join('');
  overlay.querySelector('[data-battle-controls]').innerHTML=battle.result?resultHtml():renderActionArea();

  overlay.querySelectorAll('[data-battle-action]').forEach(btn=>btn.onclick=()=>handleAction(btn.dataset.battleAction));
}

function handleAction(action){
  if(!battle)return;
  if(action==='knife')return actKnife();
  if(action==='dodge')return actDodge();
  if(action==='pigeon')return actPigeon();
  if(action==='sunset')return actSunset();
  if(action==='items'){battle.mode='items';return renderBattle()}
  if(action==='items-back'){battle.mode='actions';return renderBattle()}
  if(action==='item-onion')return actItem('onion');
  if(action==='item-angry')return actItem('onionAngry');
  if(action==='item-smelly')return actItem('onionSmelly');
  if(action==='restart'){battle=freshBattle();return renderBattle()}
  if(action==='close')return closeBattleTest();
}

function makeOverlay(){
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='battleTestOverlay';
  overlay.className='battle-overlay hidden';
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML=`<section class="battle-shell" role="dialog" aria-modal="true" aria-label="Тест бою">
    <header class="battle-head"><div><span>ТЕСТ БОЮ</span><b data-battle-turn>ХІД 1</b></div><button type="button" class="battle-close" data-battle-close aria-label="Закрити">✕</button></header>
    <div class="battle-arena">
      <div class="battle-enemy-card">
        <div class="battle-name"><b>ТЕСТОВА ХУЙНЯ</b><span data-enemy-hp>100/100</span></div>
        <div class="battle-bar enemy"><i data-enemy-bar></i></div>
      </div>
      <div class="battle-figure" aria-hidden="true"><span>?</span></div>
      <div class="battle-hero-card">
        <div class="battle-mini-row"><b>ВИ</b><span data-hero-hp>100/100</span></div>
        <div class="battle-bar hero"><i data-hero-bar></i></div>
        <div class="battle-mini-row energy"><b>БАДЬОРІСТЬ</b><span data-energy>100%</span></div>
        <div class="battle-bar energy"><i data-energy-bar></i></div>
      </div>
    </div>
    <div class="battle-statuses" data-battle-states></div>
    <div class="battle-log" data-battle-log></div>
    <div data-battle-controls></div>
  </section>`;
  overlay.querySelector('[data-battle-close]').onclick=closeBattleTest;
  document.body.appendChild(overlay);
  return overlay;
}

async function openBattleTest(runId=currentRunId()){
  sourceState=await readCurrentState(runId);
  battle=freshBattle();
  makeOverlay();
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden','false');
  document.body.classList.add('battle-open');
  renderBattle();
}

function closeBattleTest(){
  if(!overlay)return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('battle-open');
}

function addSettingsEntry(){
  const root=document.querySelector('#menuContent');
  if(!root||root.querySelector('#battleTestEntry')||!root.querySelector('#soundEnabled'))return;
  const section=document.createElement('div');
  section.id='battleTestEntry';
  section.className='battle-test-entry';
  section.innerHTML=`<div class="section-title"><h2>Бойовий тест</h2></div><div class="settings-block"><button id="battleTestBtn" type="button">Відкрити тест бою</button><small>Тест не змінює сейв.</small></div>`;
  root.appendChild(section);
  section.querySelector('#battleTestBtn').onclick=async()=>{
    const runId=currentRunId();
    document.querySelector('#closeMenuBtn')?.click();
    await openBattleTest(runId);
  };
}

export function installBattleTest(){
  ensureBattleCss();
  makeOverlay();
  const root=document.querySelector('#menuContent');
  if(root&&!settingsObserver){
    settingsObserver=new MutationObserver(()=>queueMicrotask(addSettingsEntry));
    settingsObserver.observe(root,{childList:true,subtree:true});
  }
  addSettingsEntry();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay&&!overlay.classList.contains('hidden'))closeBattleTest()});
}
