// v0.9.8 TEST – technical stabilization only. No new story content.
import {audioManager} from './audio.js?v=096b';
import {STATUS_DEFS} from './data.js?v=096b';

const VERSION098='v0.9.8 TEST';
const STATUS_IDS098=[
  'hangover','pigeonHumiliated','suspicious','scared','angry',
  'yebatorium','tipsy','skunk','tired','blessed','cowLicked'
];

function stamp098(){
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent=VERSION098);
}

// Sound was removed from the plan. Keep the old audio files untouched for compatibility,
// but never enable/play them and hide the obsolete controls.
function disableSound098(){
  try{audioManager.setEnabled?.(false)}catch{}
  try{audioManager.setVolume?.('master',0)}catch{}
  try{audioManager.setVolume?.('ambient',0)}catch{}
  try{audioManager.setVolume?.('effects',0)}catch{}
}
function hideSoundSettings098(){
  const root=document.querySelector('#menuContent');
  if(!root)return;
  const title=root.querySelector('.section-title h2')?.textContent?.trim();
  if(title!=='Налаштування')return;
  root.querySelector('.settings-block')?.remove();
}

function relationUnknowns098(){
  const root=document.querySelector('#menuContent');
  if(!root)return;
  const title=root.querySelector('.section-title h2')?.textContent?.trim();
  if(title!=='Стосунки')return;
  root.querySelectorAll('.relation-card').forEach(card=>{
    if(card.querySelector('.relation-unknown098'))return;
    const line=document.createElement('small');
    line.className='relation-unknown098';
    line.innerHTML='<b>СТАВЛЕННЯ:</b> ???';
    card.appendChild(line);
  });
}

function ensureTestUI098(){
  const panel=document.querySelector('.test-mode-panel');
  if(!panel)return;
  const opts=panel.querySelector('.test-options');
  if(!opts)return;

  // Old checkbox is incomplete on its own. Leave it checked for compatibility but hide it.
  const oldAll=document.querySelector('#testAllItems');
  if(oldAll){oldAll.checked=true;oldAll.closest('label')?.classList.add('legacy-test098')}

  let all=document.querySelector('#testAll097');
  if(!all){
    const label=document.createElement('label');
    label.innerHTML='<input type="checkbox" id="testAll097" checked> Відкрити всі стани й дати всі тестові предмети';
    opts.prepend(label);all=label.querySelector('input');
  }
  all.checked=true;

  for(const id of STATUS_IDS098){
    if(id==='scared'||!STATUS_DEFS[id])continue;
    if(opts.querySelector(`[data-test-status096="${id}"]`))continue;
    const label=document.createElement('label');
    label.innerHTML=`<input type="checkbox" data-test-status096="${id}"> Дати ${STATUS_DEFS[id].name}`;
    opts.appendChild(label);
  }
}

// v0.9.7 had a scene-ID blacklist in shopSafe097. Bypass only that exact regex
// during a shop click. All real safety checks (low threat, location, fog/forest,
// active hero, unlock) still run unchanged.
const nativeRegexTest098=RegExp.prototype.test;
const SHOP_BLACKLIST_SOURCE098='^(ch2_(bang|bang3|after_bang|side|garlic|salo|pigeon_scared|figure|end)|ch3_(intro|obey|turn|call_pigeon|tell_off|creature|vodka|garlic|garlic_hit|ask_pigeon|run|pray)|ch4_)';
let shopBypassUntil098=0;
RegExp.prototype.test=function(value){
  if(Date.now()<shopBypassUntil098&&this?.source===SHOP_BLACKLIST_SOURCE098)return false;
  return nativeRegexTest098.call(this,value);
};
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#menuTabs [data-tab="shop"]'))shopBypassUntil098=Date.now()+2500;
},true);

function slotActors098(){
  const stage=document.querySelector('#stageImage');
  if(!stage)return;
  const actors=[...stage.querySelectorAll('img.actor')];
  for(const a of actors)a.classList.remove('slot-left098','slot-center098','slot-right098','actor-small098');
  if(!actors.length)return;
  const isCh4=actors.some(a=>/ch4-/.test(a.className));
  if(!isCh4)return;

  const small=a=>/pigeon|cat/i.test(a.className);
  for(const a of actors)if(small(a))a.classList.add('actor-small098');

  if(actors.length===1){actors[0].classList.add('slot-center098');return}
  if(actors.length===2){
    const hero=actors.find(a=>/hero/.test(a.className));
    if(hero){hero.classList.add('slot-left098');actors.find(a=>a!==hero)?.classList.add('slot-right098')}
    else{actors[0].classList.add('slot-left098');actors[1].classList.add('slot-right098')}
    return;
  }

  const hero=actors.find(a=>/hero/.test(a.className));
  const little=actors.find(a=>small(a));
  const rest=actors.filter(a=>a!==hero&&a!==little);
  if(hero)hero.classList.add('slot-left098');
  if(little)little.classList.add('slot-center098');
  if(rest[0])rest[0].classList.add('slot-right098');
  const unplaced=actors.filter(a=>![...a.classList].some(c=>c.startsWith('slot-')));
  const slots=['slot-left098','slot-center098','slot-right098'];
  for(const a of unplaced){const free=slots.find(c=>!actors.some(x=>x!==a&&x.classList.contains(c)));if(free)a.classList.add(free)}
}

function preload098(){
  const srcs=[
    './hero_shrug_096.png','./hero_angry_096.png','./hero_worry_096.png','./hero_shocked_096.png','./hero_injured_096.png',
    './pigeon_base_095b.webp','./pigeon_suspicious.png','./pigeon_attack_095.webp',
    './cat_base_095m.png','./cat_sideeye_095m.png','./galina_base.png','./creature_normal_095f.webp',
    './ch4_semen_base.png','./ch4_semen_talk.png','./ch4_semen_sideeye.png','./ch4_semen_silenced.png',
    './ch4_stepan_son.png','./ch4_stepan_missing.png','./ch4_night.jpg','./ch4_fog_light.jpg','./ch4_fog_dark.jpg'
  ];
  window.__dntPreload098=[];
  for(const src of [...new Set(srcs)]){const im=new Image();im.decoding='async';im.src=src;window.__dntPreload098.push(im)}
}

function addCss098(){
  if(document.querySelector('#patch098css'))return;
  const st=document.createElement('style');st.id='patch098css';st.textContent=`
    .legacy-test098{display:none!important}
    .relation-unknown098{display:block;margin-top:8px;opacity:.85}
    .stage-image .actor.slot-left098{left:2%!important;right:auto!important;bottom:0!important;transform:none!important;max-width:31%!important;max-height:91%!important;object-fit:contain!important}
    .stage-image .actor.slot-center098{left:50%!important;right:auto!important;bottom:0!important;transform:translateX(-50%)!important;max-width:31%!important;max-height:91%!important;object-fit:contain!important}
    .stage-image .actor.slot-right098{left:auto!important;right:2%!important;bottom:0!important;transform:none!important;max-width:31%!important;max-height:91%!important;object-fit:contain!important}
    .stage-image .actor.actor-small098{max-width:18%!important;max-height:43%!important;z-index:7!important}
    @media(max-width:620px){
      .stage-image .actor.slot-left098,.stage-image .actor.slot-right098{max-width:34%!important}
      .stage-image .actor.slot-center098{max-width:30%!important}
      .stage-image .actor.actor-small098{max-width:20%!important;max-height:38%!important}
    }
  `;document.head.appendChild(st);
}

function installObservers098(){
  const menu=document.querySelector('#menuContent');
  if(menu){new MutationObserver(()=>{hideSoundSettings098();relationUnknowns098()}).observe(menu,{childList:true,subtree:true})}
  const stage=document.querySelector('#stageImage');
  if(stage){new MutationObserver(slotActors098).observe(stage,{childList:true,subtree:true,attributes:true,attributeFilter:['class','src']})}
}

function installTestHooks098(){
  document.querySelector('#testModeBtn')?.addEventListener('click',()=>{
    for(const ms of [0,80,220,500,900])setTimeout(ensureTestUI098,ms);
  },true);
}

function apply098(){
  addCss098();disableSound098();installObservers098();installTestHooks098();
  stamp098();slotActors098();hideSoundSettings098();relationUnknowns098();
  const warm=()=>preload098();
  if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,150);
  for(const ms of [0,250,900,1800])setTimeout(()=>{stamp098();disableSound098()},ms);
}
queueMicrotask(apply098);
