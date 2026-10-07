// v0.9.9 TEST – stabilization pass.
// Fixes scene consequences, chapter 4 pacing/knowledge, menu knowledge, shop gating,
// image loading and test-mode completeness without adding new game mechanics.
import {CHAPTER1_SCENES,resolveSceneValue} from './chapter1.js?v=096b';
import {CHAPTER2_SCENES} from './chapter2.js?v=096b';
import {CHAPTER3_SCENES} from './chapter3.js?v=096b';
import {STATUS_DEFS,ITEM_DEFS} from './data.js?v=096b';
import {normalizeState,executeAction,threatInfo} from './engine.js?v=096b';
import {loadRun,saveRun,listManual,listChapterCheckpoints,persistentWrite,saveKeys} from './storage.js?v=096b';
import {audioManager} from './audio.js?v=096b';

const VERSION099='v0.9.9 TEST';
const DEAD_STATUSES099=new Set(['headInjury','hungry','thirsty','wet','cold','overheated','bump']);
const POST_TYPES099=new Set(['statusAdd','health','damage','need','heroXp','evpXp','itemAdd','itemRemove','clothesAdd','equip']);
const BOOKS099=[CHAPTER1_SCENES,CHAPTER2_SCENES,CHAPTER3_SCENES];
const allScenes099=()=>BOOKS099.flatMap(b=>Object.values(b||{})).filter(Boolean);
const asArray099=x=>x==null?[]:Array.isArray(x)?x:[x];
const esc099=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const clone099=x=>JSON.parse(JSON.stringify(x));
const sceneById099=id=>CHAPTER3_SCENES[id]||CHAPTER2_SCENES[id]||CHAPTER1_SCENES[id]||null;
const resolve099=(value,state)=>typeof value==='function'?value(state):value;

function stamp099(){
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent=VERSION099);
  const t=document.querySelector('#testModeBtn');if(t)t.textContent='Тестовий режим';
}
function disableSound099(){
  try{audioManager.setEnabled?.(false)}catch{}
  try{audioManager.setVolume?.('master',0)}catch{}
  try{audioManager.setVolume?.('ambient',0)}catch{}
  try{audioManager.setVolume?.('effects',0)}catch{}
}
function hideSoundSettings099(){
  const root=document.querySelector('#menuContent');
  if(root?.querySelector('.section-title h2')?.textContent?.trim()==='Налаштування')root.querySelector('.settings-block')?.remove();
}

// ---- Immediate scene consequences -------------------------------------------------
// v0.9.6 moved HP/items/statuses from scene entry to the next button press.
// Recover exactly the effects that wrapper appended, then make the outgoing choices clean.
function effectSig099(e){try{return JSON.stringify(e)}catch{return String(e?.type||'')}}
function diffEffects099(more,base){
  const counts=new Map();
  for(const e of base||[]){const k=effectSig099(e);counts.set(k,(counts.get(k)||0)+1)}
  const out=[];
  for(const e of more||[]){const k=effectSig099(e),n=counts.get(k)||0;if(n)counts.set(k,n-1);else out.push(e)}
  return out;
}
function stateWithPost099(s,flag,value){return{...s,flags:{...(s?.flags||{}),[flag]:value}}}
function movedFromChoices099(oldChoices,state,flag){
  let delayed=[],clean=[];
  try{delayed=asArray099(resolve099(oldChoices,stateWithPost099(state,flag,false)))}catch{}
  try{clean=asArray099(resolve099(oldChoices,stateWithPost099(state,flag,true)))}catch{}
  const out=[];
  for(let i=0;i<delayed.length;i++){
    const a=delayed[i],b=clean.find(x=>x?.id&&x.id===a?.id)||clean[i]||{};
    for(const e of diffEffects099(asArray099(a?.effects),asArray099(b?.effects)))if(POST_TYPES099.has(e?.type))out.push(e);
  }
  const seen=new Set();
  return out.filter(e=>{const k=effectSig099(e);if(seen.has(k))return false;seen.add(k);return true});
}
function restoreImmediateConsequences099(){
  for(const scene of allScenes099()){
    if(!scene?.id||scene.__immediate099||typeof scene.choices!=='function')continue;
    const oldChoices=scene.choices,oldEnter=scene.onEnter,flag=`post096_${scene.id}`;
    const moved=s=>movedFromChoices099(oldChoices,s,flag).filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury'));
    scene.__movedEffects099=moved;
    scene.onEnter=s=>[
      ...asArray099(resolve099(oldEnter||[],s)).filter(e=>!(e?.type==='statusAdd'&&e.id==='headInjury')),
      ...moved(s)
    ];
    scene.choices=s=>asArray099(resolve099(oldChoices,stateWithPost099(s,flag,true))).map(c=>({
      ...c,
      hiddenEffects:asArray099(c?.hiddenEffects).filter(e=>!(e?.type==='flag'&&e.key===flag))
    }));
    scene.__immediate099=true;
  }
}

function cleanHeadInjuryRuntime099(){
  delete STATUS_DEFS.headInjury;
  for(const scene of allScenes099()){
    if(!scene?.onEnter||scene.__headClean099)continue;
    const old=scene.onEnter;
    scene.onEnter=s=>asArray099(resolve099(old,s)).filter(e=>!((e?.type==='statusAdd'||e?.type==='statusRemove')&&e.id==='headInjury'));
    scene.__headClean099=true;
  }
  const wake=CHAPTER3_SCENES.ch3_wakeup;
  if(wake){
    wake.actors=[
      {role:'hero',src:'./hero_injured_096.png',position:'hero'},
      {role:'pigeon',src:'./pigeon_base_095b.webp',position:'pigeon'}
    ];
  }
}

// ---- Save migration ---------------------------------------------------------------
function hasLegacyPost099(s){return Object.keys(s?.flags||{}).some(k=>k.startsWith('post096_'))}
function hasDeadHead099(s){return Boolean(s?.activeStatuses?.includes?.('headInjury')||s?.discoveredStatuses?.includes?.('headInjury')||s?.statusTimers?.headInjury!==undefined)}
function cleanPostFlags099(s){for(const k of Object.keys(s.flags||{}))if(k.startsWith('post096_'))delete s.flags[k]}
function removeHeadFromState099(s){
  s.activeStatuses=(s.activeStatuses||[]).filter(x=>x!=='headInjury');
  s.discoveredStatuses=(s.discoveredStatuses||[]).filter(x=>x!=='headInjury');
  s.statusTimers={...(s.statusTimers||{})};delete s.statusTimers.headInjury;
}
function migrateState099(raw){
  if(!raw)return{state:raw,changed:false};
  const original=clone099(raw),hadPost=hasLegacyPost099(original),hadHead=hasDeadHead099(original);
  const entered=new Set(original.story?.entered||[]),sceneId=String(original.story?.sceneId||original.scene||'');
  const oldCh4=entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_'))||sceneId.startsWith('ch4_');
  if(!hadPost&&!hadHead&&!oldCh4)return{state:raw,changed:false};

  let s=normalizeState(clone099(raw));s.flags=s.flags||{};
  if(hadPost&&sceneId&&entered.has(sceneId)){
    const marker=`post096_${sceneId}`;
    if(!original.flags?.[marker]){
      const sc=sceneById099(sceneId),moved=sc?.__movedEffects099?.(s)||[];
      if(moved.length)s=executeAction(s,{id:`migration099_${sceneId}`,effects:moved}).state;
    }
  }
  cleanPostFlags099(s);removeHeadFromState099(s);
  if(oldCh4){s.flags.semenEncountered099=true;s.flags.semenIntroduced099=true}
  s.flags.immediateMigration099=true;
  return{state:normalizeState(s),changed:true};
}
async function migrateAllSaves099(){
  for(const run of [1,2,3,99]){
    try{
      const raw=await loadRun(run),m=migrateState099(raw);
      if(m.changed)await saveRun({...m.state,runId:run});
      const manuals=await listManual(run);
      for(const item of manuals){
        if(!item.state)continue;
        const snap=clone099(item.state),embedded=snap.__chapterCheckpoint?clone099(snap.__chapterCheckpoint):null;delete snap.__chapterCheckpoint;
        const mm=migrateState099(snap),mc=migrateState099(embedded);
        if(mm.changed||mc.changed){const next=mm.state||snap;if(embedded)next.__chapterCheckpoint=mc.state||embedded;await persistentWrite(saveKeys.MANUAL(run,item.slot),JSON.stringify(next))}
      }
      const cps=await listChapterCheckpoints(run,20);
      for(const cp of cps){const mcp=migrateState099(cp.state);if(mcp.changed)await persistentWrite(saveKeys.CHAPTER(run,cp.chapter),JSON.stringify(mcp.state))}
    }catch(e){console.warn('v099 migration skipped',run,e)}
  }
}

// ---- Chapter 4: real introduction + smaller scene beats ---------------------------
const H099={base:'./hero_shrug_096.png',angry:'./hero_angry_096.png',worry:'./hero_worry_096.png'};
const S099={base:'./ch4_semen_base.png',talk:'./ch4_semen_talk.png',side:'./ch4_semen_sideeye.png'};
const P099={base:'./pigeon_base_095b.webp',serious:'./pigeon_suspicious.png'};
const hero099=(src=H099.base)=>({role:'hero ch4-hero097',src,position:'hero'});
const semen099=(src=S099.base)=>({role:'npc ch4-semen097',src,position:'npc'});
const pigeon099=(src=P099.base)=>({role:'pigeon ch4-pigeon097',src,position:'pigeon'});
const galina099=()=>({role:'npc ch4-galina097',src:'./galina_base.png',position:'npc'});
const cat099=()=>({role:'npc ch4-cat097',src:'./cat_base_095m.png',position:'npc'});
const yard099={background:'./ch4_night.jpg',atmosphere:'village',chapter:4,world:[{type:'world',key:'environment',value:'outdoors'},{type:'world',key:'location',value:'біля хати баби Галі'}]};

function anonymousRecognition099(s){
  const vodka=Boolean(s.flags?.creatureVodkaFriend),garlic=Boolean(s.flags?.creatureGarlicUsed||s.flags?.itemKnown095s_garlic),prayer=Boolean(s.flags?.creaturePrayerReactionKnown095w||s.flags?.creaturePrayerStalled095w),fight=Boolean(s.flags?.shedBattleKnockout);
  let tail='Ви його впізнаєте. Учора саме ця людина вилазила із сараю в такому вигляді, що нормальним знайомством це назвати важко.';
  if(vodka)tail='Ви його впізнаєте одразу. Учора ви ще поїли його горілкою біля сараю, а сьогодні він іде собі з відром, ніби так і треба.';
  else if(garlic)tail='Ви його впізнаєте одразу. Учора ви кидали в нього часником. Сьогодні він виглядає значно менш мертвим і значно більш здатним це пригадати.';
  else if(prayer)tail='Ви його впізнаєте одразу. Після вчорашньої молитви біля сараю ця зустріч мала б виглядати дивніше, але, походу, в цьому селі планка вже зламалась.';
  else if(fight)tail='Ви його впізнаєте одразу. Учора біля сараю ви вже встигли нормально так познайомитись кулаками.';
  return `Зранку біля хати баби Галі ви помічаєте чоловіка з відром. Він іде дорогою у ваш бік і теж придивляється до вас.\n\n${tail}\n\nЄвпапій поруч раптом робить дуже зайнятий вигляд.\n\n– О, мужик, – каже чоловік, коли підходить ближче. – Живий.\n\n– Сам бачу.`;
}
function namedReaction099(s){
  const vodka=Boolean(s.flags?.creatureVodkaFriend),garlic=Boolean(s.flags?.creatureGarlicUsed||s.flags?.itemKnown095s_garlic),prayer=Boolean(s.flags?.creaturePrayerReactionKnown095w||s.flags?.creaturePrayerStalled095w),fight=Boolean(s.flags?.shedBattleKnockout);
  let extra='Семен дивиться на вас так, ніби вчорашній сарай був звичайною побутовою незручністю.';
  if(vodka&&garlic)extra='– За горілку спасіба. За часник не спасіба.\n\n– Та вже як вийшло.\n\n– Отож.';
  else if(vodka)extra='– За горілку спасіба. Хороша була.\n\n– Ти після неї чуть мене не вʼєбав.\n\nСемен думає секунду.\n\n– Та? Ну, вибачай.';
  else if(garlic)extra='Семен дивиться на ваші руки.\n\n– Часнику нема?\n\n– Нє.\n\n– Добре.';
  else if(prayer)extra='– Тільки ти це… молитись зараз не начинай.\n\nЄвпапій дуже старанно відвертає голову.';
  else if(fight)extra='Кілька секунд ви обоє дивитесь один на одного.\n\n– Мир? – питає Семен.\n\n– До наступного сараю.\n\n– Йде.';
  return `Чоловік ставить відро на землю й простягає руку.\n\n– Семен.\n\n– Шо?\n\n– Мене Семен звати. Раз уже другий раз бачимся.\n\n– А. Степан.\n\nВи тиснете руки.\n\n${extra}`;
}
function rebuildChapter4099(){
  const T=CHAPTER3_SCENES,oldSon=T.ch4_son_question,oldChoices=oldSon?.choices||[];
  if(!T.ch4_intro||T.ch4_intro.__v099)return;
  T.ch4_intro={...yard099,id:'ch4_intro',caption:'після сараю',actors:[hero099(),pigeon099(P099.base),semen099(S099.base)],onEnter:[{type:'flag',key:'chapter4Started097',value:true},{type:'flag',key:'semenEncountered099',value:true}],text:anonymousRecognition099,choices:[{id:'ch4_name099',label:'Далі',next:'ch4_semen_name099'}],__v099:true};
  T.ch4_semen_name099={...yard099,id:'ch4_semen_name099',caption:'семен',actors:[hero099(),semen099(S099.talk),pigeon099(P099.base)],onEnter:[{type:'relationshipKnown',person:'semen',value:true},{type:'flag',key:'semenIntroduced099',value:true}],text:namedReaction099,choices:[{id:'ch4_name_next099',label:'Далі',next:'ch4_son_question'}]};
  T.ch4_son_question={...yard099,id:'ch4_son_question',caption:'одне питання',actors:[hero099(H099.worry),semen099(S099.talk),pigeon099(P099.serious)],text:`Семен уже відходить метрів на десять, але раптом зупиняється посеред дороги й повільно повертає голову.\n\n– Мужик.\n\n– Шо?\n\n– В тебе син є?\n\nВи завмираєте.\n\n– Шо ти сказав?\n\n– Питаю, син у тебе є?\n\n– Звідки ти знаєш?\n\nЄвпапій теж затихає.\n\nСемен дивиться на вас зовсім спокійно.\n\n– Та не заводься ти. Живий твій малий.\n\nВи різко робите крок до нього.\n\n– Ти його бачив?\n\n– Нє.\n\n– Тоді звідки ти знаєш, шо він живий?`,choices:[{id:'ch4_son_galina099',label:'Далі',next:'ch4_son_galina099'}]};
  T.ch4_son_galina099={...yard099,id:'ch4_son_galina099',caption:'баба галя',actors:[hero099(H099.angry),galina099(),semen099(S099.side)],text:`За вашою спиною скриплять двері. З хати виходить баба Галя, дивиться на вас, потім на Семена й одразу хмуриться.\n\n– До мене йди.\n\n– Баб Галь, він знає про мого сина.\n\n– Я чула. Іди сюди.\n\n– А я хочу знати, звідки він знає.\n\nСемен уже збирається щось відповісти, але баба Галя перебиває:\n\n– Семене. Не треба.\n\n– А шо я?\n\n– Ти поняв.\n\nВін дивиться на неї ще секунду й замовкає.\n\nВи переводите погляд на бабу Галю.\n\n– А ви тоже знаєте?\n\nВона не відповідає одразу.`,choices:[{id:'ch4_son_reaction099',label:'Далі',next:'ch4_son_reaction099'}]};
  T.ch4_son_reaction099={...yard099,id:'ch4_son_reaction099',caption:'всі шось знають',actors:[hero099(H099.worry),pigeon099(P099.serious),cat099()],text:`У дверях зʼявляється Риже гамно й сідає на порозі. Євпапій підлітає ближче, але цього разу не жартує.\n\n– Мужик, не лізь зараз.\n\nВи різко дивитесь на нього.\n\n– Ти тоже знаєш?\n\n– Нє.\n\n– Тоді не пизди.\n\nЄвпапій відкриває дзьоб, але передумує. Кіт дивиться в сторону дороги. Баба Галя й Семен лишились позаду, і чим довше всі мовчать, тим сильніше бісить відчуття, що єдиний, кому тут ніхуя не пояснили, – це ви.`,choices:oldChoices};
}

// ---- Menu knowledge ---------------------------------------------------------------
function activateTab099(tab){document.querySelectorAll('#menuTabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
function currentRunId099(){return Number((document.querySelector('#menuMeta')?.textContent||'').match(/Проходження\s+(\d+)/)?.[1]||0)}
async function currentState099(){const id=currentRunId099();if(!id)return null;const raw=await loadRun(id);return raw?normalizeState(raw):null}
function replaceTab099(tab,handler){
  const old=document.querySelector(`#menuTabs [data-tab="${tab}"]`);if(!old)return null;
  const neu=old.cloneNode(true);neu.onclick=null;old.replaceWith(neu);
  neu.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();handler(neu)},true);
  return neu;
}
function characterHtml099(c){return `<details class="character-card096"><summary><img src="${esc099(c.portrait)}" alt=""><b>${esc099(c.name)}</b></summary><div>${(c.facts?.length?c.facts:['???']).map(f=>`<p>${esc099(f)}</p>`).join('')}</div></details>`}
function knownCharacters099(s){
  const entered=new Set(s.story?.entered||[]),out=[];
  if(s.flags?.ch4StepanMissing)out.push({name:'Степан',portrait:'./ch4_stepan_missing.png',facts:['Місцезнаходження: ???','Стан: ???']});
  const evpSeen=Boolean(s.flags?.metPigeon||entered.has('poop'));
  if(evpSeen)out.push({name:s.flags?.knowsPigeonName?'Євпапій':'???',portrait:'./pigeon_base_095b.webp',facts:[s.flags?.knowsPigeonName?'Жирний голуб. Говорить. На жаль.':'Імʼя: ???']});
  const galSeen=Boolean(s.relationships?.galina?.known||[...entered].some(x=>/^galina/i.test(String(x))));
  if(galSeen)out.push({name:'Баба Галя',portrait:'./galina_base.png',facts:[s.flags?.localClothes?'Дала вам місцеві шмотки.':'???',s.flags?.galinaFedAfterShed?'Нагодувала після сараю.':'???']});
  const hoodSeen=entered.has('ch2_figure')||[...entered].some(x=>/^ch3_(intro|obey|turn|tell_off)/.test(String(x)));
  if(hoodSeen)out.push({name:'Постать',portrait:'./ch2_unknown_v2.png',facts:['Обличчя: ???','Хто це: ???']});
  const catSeen=Boolean(s.flags?.catMet||s.flags?.catFirstMeeting||[...entered].some(x=>String(x).startsWith('ch3_cat_')));
  if(catSeen)out.push({name:'Риже гамно',portrait:'./cat_base_095m.png',facts:['Живе в баби Галі.',s.flags?.catFirstMeeting==='insult'?'Ви вже встигли посратись.':'???']});
  const creatureSeen=entered.has('ch3_creature')||[...entered].some(x=>/^ch3_(vodka|garlic|run|ask_pigeon|pray)/.test(String(x)));
  if(creatureSeen)out.push({name:s.flags?.truposmerdNamed096?'ТРУПОСМЕРД':'???',portrait:'./creature_normal_095f.webp',facts:[s.flags?.truposmerdNamed096?'Виліз із сараю.':'???',s.flags?.creatureGarlicUsed?'Часник йому дуже не подобається.':'???',s.flags?.creatureVodkaFriend?'Горілку любить.':'???']});
  const semenSeen=Boolean(s.flags?.semenEncountered099||entered.has('ch4_intro')||[...entered].some(x=>String(x).startsWith('ch4_')));
  if(semenSeen)out.push({name:s.flags?.semenIntroduced099?'Семен':'???',portrait:'./ch4_semen_base.png',facts:[s.flags?.semenIntroduced099?'Учора біля сараю виглядав зовсім інакше.':'Імʼя: ???',s.flags?.ch4StepanMissing?'Знає про сина Степана більше, ніж сказав.':'???']});
  return out;
}
async function renderCharacters099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('characters');root.innerHTML='<div class="section-title"><h2>Персонажі</h2></div><div class="empty-state">Завантаження...</div>';
  const s=await currentState099(),chars=s?knownCharacters099(s):[];
  root.innerHTML=`<div class="section-title"><h2>Персонажі</h2></div>${chars.length?chars.map(characterHtml099).join(''):'<div class="empty-state">Поки ви ні з ким нормально не познайомились.</div>'}`;
}
async function renderRelations099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('relations');const s=await currentState099();
  const order=['evpapiy','galina','hood','cat','creature','semen'];
  const known=order.map(id=>[id,s?.relationships?.[id]]).filter(([,r])=>r?.known);
  root.innerHTML=`<div class="section-title"><h2>Стосунки</h2></div><div class="info-card">Люди й всяка інша живність памʼятають, шо ви витворяли. Наскільки ви їм подобаєтесь, гра цифрами не показує.</div>${known.length?known.map(([id,r])=>{let name=r.name||'???';if(id==='semen')name=s.flags?.semenIntroduced099?'Семен':'???';if(id==='creature')name=s.flags?.truposmerdNamed096?'ТРУПОСМЕРД':'???';if(id==='evpapiy')name=s.flags?.knowsPigeonName?'Євпапій':'???';return `<article class="relation-card"><b>${esc099(name)}</b><span><b>СТАВЛЕННЯ:</b> ???</span><small>Дивіться на його реакції й поведінку.</small></article>`}).join(''):'<div class="empty-state">Ше нема кого бісити.</div>'}`;
}
function mapState099(s){
  const entered=new Set(s?.story?.entered||[]),loc=String(s?.world?.location||'');
  const unlocked=Boolean(s?.flags?.mapUnlocked);
  const home=unlocked;
  const wake=Boolean(s?.flags?.chapter2Started||[...entered].some(x=>String(x).startsWith('ch2_')));
  const shed=Boolean(s?.flags?.heardShedConversation||s?.flags?.heardShedBang||s?.flags?.pigeonSawInsideShed||s?.flags?.ignoredShed||[...entered].some(x=>/^ch[23]_/.test(String(x))&&/shed|bang|creature|garlic|vodka|pray|wakeup/.test(String(x))));
  const fogScenes=new Set(['ch4_watch','ch4_cat_moves','ch4_evp_block','ch4_voice','ch4_fog_deep','ch4_fall','ch4_evp_after']);
  const fog=Boolean(/туман/i.test(loc)||[...entered].some(x=>fogScenes.has(String(x))));
  const currentFog=/туман/i.test(loc),currentShed=/сарай/i.test(loc),currentWake=/помин|стол|двір/i.test(loc)&&!currentShed&&!currentFog,currentHome=!currentWake&&!currentShed&&!currentFog&&/хат|криниц/i.test(loc);
  return{unlocked,home,wake,shed,fog,currentFog,currentShed,currentWake,currentHome};
}
async function renderMap099(){
  const root=document.querySelector('#menuContent');if(!root)return;activateTab099('map');const s=await currentState099();if(!s)return;
  const m=mapState099(s);
  const marker=(label,x,y,current=false,small=false)=>`<div class="map-marker known${small?' small':''}${current?' current':''}" style="left:${x}%;top:${y}%">${label}</div>`;
  const unknown=(x,y)=>`<div class="map-unknown" style="left:${x}%;top:${y}%"><span>?</span></div>`;
  const overlays=m.unlocked?[m.home?marker('Хатина з криницею',27,70,m.currentHome):unknown(27,70),m.wake?marker('Двір з поминками',64,39,m.currentWake):unknown(64,39),m.shed?marker('Сарай',83,47,m.currentShed,true):unknown(83,47),m.fog?marker('Дорога в тумані',21,18,m.currentFog,true):unknown(21,18),unknown(45,13),unknown(84,20)].join(''):'';
  root.innerHTML=`<div class="section-title"><h2>Карта</h2></div><div class="map-visual ${m.unlocked?'':'locked'}"><img src="./map_village.jpg?v=084" alt="Карта села">${m.unlocked?`<div class="map-overlays">${overlays}</div>`:'<div class="map-lock-copy"><b>ПОКИ ЗАКРИТО</b><span>Спочатку треба трохи розібратись, де ви взагалі опинились.</span></div>'}</div>${m.unlocked?'<div class="map-help">Підпис зʼявляється після того, як ви побували в цьому місці. Невідомі точки поки лишаються знаком питання.</div>':''}`;
}

function shopSafe099(s){
  if(!s?.flags?.shopUnlocked)return false;
  if(s.flags?.activeHero097==='evpapiy'||s.flags?.ch4StepanMissing)return false;
  if(threatInfo(s)?.key!=='low')return false;
  const loc=String(s.world?.location||'').toLocaleLowerCase('uk-UA'),env=String(s.world?.environment||'').toLocaleLowerCase('uk-UA');
  if(/туман|ліс|сарай|болот|хлів/.test(loc))return false;
  return env==='indoors'||/хат|двір|криниц|помин|село|дорог/.test(loc);
}
function shopBlocked099(){activateTab099('shop');const root=document.querySelector('#menuContent');if(root)root.innerHTML='<div class="section-title"><h2>Крамничка</h2></div><div class="empty-state"><b>Зараз не до того.</b><br><br>Крамничка доступна, коли Степан на місці, навколо спокійно й ви не лізете в туман, ліс або іншу підозрілу хєрню.</div>'}
function callNativeShop099(){
  const donor=[...document.querySelectorAll('#menuTabs [data-tab]')].find(b=>b.dataset.tab==='states'&&typeof b.onclick==='function');
  if(!donor)return false;
  const old=donor.dataset.tab;donor.dataset.tab='shop';
  try{donor.onclick.call(donor)}finally{donor.dataset.tab=old;donor.classList.remove('active')}
  activateTab099('shop');return true;
}
async function renderShopGate099(){const s=await currentState099();if(!shopSafe099(s)){shopBlocked099();return}if(!callNativeShop099())shopBlocked099()}
function installMenu099(){
  replaceTab099('characters',renderCharacters099);
  replaceTab099('relations',renderRelations099);
  replaceTab099('map',renderMap099);
  replaceTab099('shop',renderShopGate099);
  const settings=document.querySelector('#menuTabs [data-tab="settings"]');settings?.addEventListener('click',()=>setTimeout(hideSoundSettings099,0));
}

// ---- Test mode --------------------------------------------------------------------
function currentStatusIds099(){return Object.keys(STATUS_DEFS).filter(id=>!DEAD_STATUSES099.has(id))}
function ensureTestUI099(){
  const panel=document.querySelector('.test-mode-panel'),opts=panel?.querySelector('.test-options');if(!panel||!opts)return;
  const oldAll=document.querySelector('#testAllItems');if(oldAll){oldAll.checked=true;oldAll.closest('label')?.classList.add('legacy-test099')}
  let all=document.querySelector('#testAll097');if(!all){const l=document.createElement('label');l.innerHTML='<input type="checkbox" id="testAll097" checked> Дати всі актуальні предмети й відкрити всі стани';opts.prepend(l);all=l.querySelector('input')}all.checked=true;
  for(const id of currentStatusIds099()){
    if(id==='scared'&&document.querySelector('#testScared'))continue;
    if(opts.querySelector(`[data-test-status096="${id}"]`))continue;
    const def=STATUS_DEFS[id];if(!def)continue;const l=document.createElement('label');l.innerHTML=`<input type="checkbox" data-test-status096="${id}"> Дати ${esc099(def.name||id)}`;opts.appendChild(l);
  }
}
function installTest099(){
  const btn=document.querySelector('#testModeBtn');if(btn){btn.textContent='Тестовий режим';btn.addEventListener('click',()=>{for(const ms of [0,80,220,500])setTimeout(ensureTestUI099,ms)},true)}
}

// ---- Image preloading --------------------------------------------------------------
const imageCache099=new Map();
function warmImage099(src,decode=false){
  if(!src||typeof src!=='string')return Promise.resolve();
  if(imageCache099.has(src))return imageCache099.get(src);
  const p=new Promise(resolve=>{const im=new Image();im.decoding='async';im.onload=()=>resolve();im.onerror=()=>resolve();im.src=src;if(decode&&im.decode)im.decode().then(resolve).catch(()=>{});});
  imageCache099.set(src,p);return p;
}
function assetsForScene099(scene,state){
  const out=[];if(!scene)return out;
  const bg=resolve099(scene.background,state);if(typeof bg==='string')out.push(bg);
  let actors=[];try{actors=asArray099(resolve099(scene.actors||[],state))}catch{}
  for(const a of actors){let src='';try{src=resolve099(a?.src,state)}catch{}if(typeof src==='string')out.push(src)}
  return [...new Set(out)];
}
async function decodeScene099(scene,state){await Promise.allSettled(assetsForScene099(scene,state).map(src=>warmImage099(src,true)))}
function warmAllScenes099(){
  const staticAssets=[];
  for(const scene of allScenes099()){
    if(typeof scene.background==='string')staticAssets.push(scene.background);
    if(Array.isArray(scene.actors))for(const a of scene.actors)if(typeof a?.src==='string')staticAssets.push(a.src);
  }
  for(const src of [...new Set(staticAssets)])warmImage099(src,false);
  const critical=['./ch4_night.jpg','./ch4_fog_light.jpg','./ch4_fog_dark.jpg','./ch4_semen_base.png','./ch4_semen_talk.png','./ch4_semen_sideeye.png','./ch4_stepan_son.png','./ch4_stepan_missing.png','./pigeon_base_095b.webp','./pigeon_suspicious.png','./cat_base_095m.png','./galina_base.png','./hero_shrug_096.png','./hero_angry_096.png','./hero_worry_096.png','./hero_injured_096.png'];
  Promise.allSettled(critical.map(src=>warmImage099(src,true)));
}
let activeRun099=0;
function rememberRun099(target){
  const card=target?.closest?.('.run-card');if(card){const n=Number((card.textContent||'').match(/Проходження\s+(\d+)/)?.[1]||0);if(n)activeRun099=n}
  if(target?.closest?.('#continueTestBtn,[data-test-chapter],[data-test-ch4-097]'))activeRun099=99;
}
async function interceptStoryChoice099(e){
  const btn=e.target?.closest?.('.story-choice');if(!btn||btn.dataset.preload099==='done'||!activeRun099)return;
  const buttons=[...document.querySelectorAll('#storyChoices .story-choice')],index=buttons.indexOf(btn);if(index<0)return;
  const nativeClick=btn.onclick;
  e.preventDefault();e.stopImmediatePropagation();btn.disabled=true;
  try{
    const raw=await loadRun(activeRun099);
    const state=raw?normalizeState(raw):null,scene=state?sceneById099(String(state.story?.sceneId||state.scene||'')):null;
    let choices=[];if(scene)choices=asArray099(resolve099(scene.choices||[],state)).filter(c=>c&&(!c.showIf||c.showIf(state)));
    const next=choices[index]?.next;if(next)await decodeScene099(sceneById099(next),state);
  }catch(e){console.warn('v099 preload skipped',e)}
  btn.dataset.preload099='done';btn.disabled=false;
  if(typeof nativeClick==='function')await nativeClick.call(btn);
}
function installPreloadHooks099(){
  document.addEventListener('click',e=>rememberRun099(e.target),true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.story-choice'))interceptStoryChoice099(e)},true);
  if('requestIdleCallback'in window)requestIdleCallback(warmAllScenes099,{timeout:1000});else setTimeout(warmAllScenes099,100);
}

// ---- UI cleanup -------------------------------------------------------------------
function fixUiCopy099(){
  const about=document.querySelector('#aboutOverlay .about-copy');
  if(about){for(const p of about.querySelectorAll('p'))if(/^Сейви\./.test(p.textContent?.trim()||''))p.innerHTML='<b>Сейви.</b> Гра сама зберігає прогрес після важливих рішень і подій. Також є ручні сейви й повернення до початку глави.'}
}
function addCss099(){
  if(document.querySelector('#patch099css'))return;const st=document.createElement('style');st.id='patch099css';st.textContent=`
    .legacy-test099{display:none!important}
    .stage-image>.actor{bottom:0!important;object-fit:contain!important;transition:none!important}
    .stage-image:not(:has(>.actor.actor-1))>.actor.actor-0{left:50%!important;right:auto!important;transform:translateX(-50%)!important;max-width:46%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-0{left:3%!important;right:auto!important;transform:none!important;max-width:40%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-1{left:auto!important;right:3%!important;transform:none!important;max-width:40%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-0{left:2%!important;right:auto!important;transform:none!important;max-width:31%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-1{left:50%!important;right:auto!important;transform:translateX(-50%)!important;max-width:31%!important;max-height:92%!important}
    .stage-image:has(>.actor.actor-2)>.actor.actor-2{left:auto!important;right:2%!important;transform:none!important;max-width:31%!important;max-height:92%!important}
    .stage-image>.actor.pigeon,.stage-image>.actor.ch4-pigeon097{max-width:19%!important;max-height:40%!important;z-index:7!important}
    .stage-image>.actor.ch4-cat097{max-width:22%!important;max-height:45%!important;z-index:7!important}
    .relation-card small{display:block;margin-top:7px;opacity:.7}
    @media(max-width:620px){
      .stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-0,.stage-image:has(>.actor.actor-1):not(:has(>.actor.actor-2))>.actor.actor-1{max-width:43%!important}
      .stage-image:has(>.actor.actor-2)>.actor.actor-0,.stage-image:has(>.actor.actor-2)>.actor.actor-1,.stage-image:has(>.actor.actor-2)>.actor.actor-2{max-width:33%!important}
      .stage-image>.actor.pigeon,.stage-image>.actor.ch4-pigeon097{max-width:21%!important;max-height:36%!important}
      .stage-image>.actor.ch4-cat097{max-width:23%!important;max-height:40%!important}
    }
  `;document.head.appendChild(st);
}

export const __v099Test={shopSafe:shopSafe099,mapState:mapState099,knownCharacters:knownCharacters099,migrateState:migrateState099};

function apply099(){
  stamp099();disableSound099();
  restoreImmediateConsequences099();
  cleanHeadInjuryRuntime099();
  rebuildChapter4099();
  addCss099();installMenu099();installTest099();fixUiCopy099();installPreloadHooks099();
  window.__dntMigration099=migrateAllSaves099();
  for(const ms of [0,250,900])setTimeout(()=>{stamp099();disableSound099();fixUiCopy099()},ms);
}
queueMicrotask(apply099);
