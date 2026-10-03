// v0.9.2 – visual shell + isolated battle test hook.
import {installBattleTest} from './battle.js?v=092';

const groups085 = {
  hero: {
    label: 'Герой',
    tabs: [
      ['needs','Потреби'],
      ['sleep','Сон'],
      ['states','Стани'],
      ['stats','Характеристики']
    ]
  },
  things: {
    label: 'Речі',
    tabs: [
      ['inventory','Інвентар'],
      ['clothes','Шмотки']
    ]
  },
  people: {
    label: 'Персонажі',
    tabs: [
      ['companions','Компаньйони'],
      ['relations','Стосунки']
    ]
  },
  world: {
    label: 'Світ',
    tabs: [
      ['map','Карта'],
      ['shop','Крамничка']
    ]
  }
};

const tabToGroup085 = Object.fromEntries(
  Object.entries(groups085).flatMap(([group,data]) => data.tabs.map(([tab]) => [tab,group]))
);
const lastTab085 = Object.fromEntries(
  Object.entries(groups085).map(([group,data]) => [group,data.tabs[0][0]])
);

function q085(sel){ return document.querySelector(sel); }

function activateOriginalTab085(tab){
  const btn = q085(`#menuTabs [data-tab="${tab}"]`);
  if(btn) btn.click();
}

function activeOriginalTab085(){
  return q085('#menuTabs [data-tab].active')?.dataset.tab || 'inventory';
}

function buildStart085(){
  const card=q085('.start-card');
  const actions=q085('#startActions');
  const continueBtn=q085('#continueBtn');
  const runPicker=q085('#runPicker');
  if(!card||!actions||!runPicker)return;

  if(continueBtn) actions.prepend(continueBtn);

  if(!q085('.start-tagline')){
    const p=document.createElement('p');
    p.className='start-tagline';
    p.textContent='Він вже тут. Значить, добром це не закінчиться.';
    actions.insertAdjacentElement('afterend',p);
  }

  const syncRunMode=()=>card.classList.toggle('run-mode',!runPicker.classList.contains('hidden'));
  syncRunMode();
  new MutationObserver(syncRunMode).observe(runPicker,{attributes:true,attributeFilter:['class']});
}

function buildGroupedMenu085(){
  const sheet=q085('.menu-sheet');
  const head=q085('.menu-head');
  const oldTabs=q085('#menuTabs');
  const close=q085('#closeMenuBtn');
  if(!sheet||!head||!oldTabs||!close||q085('#menuPrimary085'))return;

  const actions=document.createElement('div');
  actions.className='menu-head-actions';

  const settings=document.createElement('button');
  settings.type='button';
  settings.className='icon-btn ui-settings';
  settings.textContent='⚙️';
  settings.setAttribute('aria-label','Налаштування');
  settings.title='Налаштування';
  settings.addEventListener('click',()=>activateOriginalTab085('settings'));

  const exit=document.createElement('button');
  exit.type='button';
  exit.className='icon-btn ghost ui-exit';
  exit.textContent='Вийти';
  exit.setAttribute('aria-label','Вийти в головне меню');
  exit.addEventListener('click',()=>{
    close.click();
    setTimeout(()=>q085('#exitBtn')?.click(),0);
  });

  actions.append(settings,exit,close);
  head.append(actions);

  const primary=document.createElement('nav');
  primary.id='menuPrimary085';
  primary.className='menu-primary';
  primary.setAttribute('aria-label','Розділи меню');
  for(const [group,data] of Object.entries(groups085)){
    const b=document.createElement('button');
    b.type='button';
    b.dataset.group=group;
    b.textContent=data.label;
    b.addEventListener('click',()=>activateOriginalTab085(lastTab085[group]||data.tabs[0][0]));
    primary.append(b);
  }

  const secondary=document.createElement('nav');
  secondary.id='menuSecondary085';
  secondary.className='menu-secondary';
  secondary.setAttribute('aria-label','Підрозділи меню');

  oldTabs.before(primary,secondary);

  const sync=()=>{
    const active=activeOriginalTab085();
    const group=tabToGroup085[active];
    settings.classList.toggle('active',active==='settings');

    primary.querySelectorAll('[data-group]').forEach(b=>{
      b.classList.toggle('active',Boolean(group&&b.dataset.group===group));
    });

    if(active==='settings'||!group){
      secondary.classList.add('settings-mode');
      secondary.replaceChildren();
      return;
    }

    lastTab085[group]=active;
    secondary.classList.remove('settings-mode');
    secondary.replaceChildren();
    for(const [tab,label] of groups085[group].tabs){
      const b=document.createElement('button');
      b.type='button';
      b.dataset.subtab=tab;
      b.textContent=label;
      b.classList.toggle('active',tab===active);
      b.addEventListener('click',()=>activateOriginalTab085(tab));
      secondary.append(b);
    }
  };

  oldTabs.querySelectorAll('[data-tab]').forEach(b=>{
    new MutationObserver(sync).observe(b,{attributes:true,attributeFilter:['class']});
  });
  new MutationObserver(sync).observe(q085('#menuOverlay'),{attributes:true,attributeFilter:['class']});
  sync();
}

function stampVersion092(){
  document.querySelectorAll('.version,.howto-version,.game-name span').forEach(el=>el.textContent='v0.9.2');
}

function boot085(){
  document.body.classList.add('ui-v085');
  stampVersion092();
  buildStart085();
  buildGroupedMenu085();
  installBattleTest();
}

boot085();
