// «Фильтр по параметрам» of a section page: the source template's panel, made to work without its server.
// Price and property checkboxes filter the products of the page (any value inside a property, every property
// checked); «Показать (N)» counts in advance. On a phone the «Фильтр» button opens the panel over the page.
// Product property values come from tools/build_site.py (products.json "props"), spelt as the filter spells them.
(()=>{
'use strict';
const OS=window.OS,panel=document.querySelector('#smartFilter'),form=document.querySelector('#smartFilterForm');
if(!OS||!panel||!form)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const key=v=>String(v).trim().toLowerCase().replace(/ё/g,'е');
const num=v=>parseFloat(String(v||'').replace(/\s/g,'').replace(',','.'));
const ids=$$('#catalogSection .product[data-product]').map(c=>c.dataset.product);
const lo=$('#arrFilter_P1_MIN'),hi=$('#arrFilter_P1_MAX'),start=[lo&&lo.value,hi&&hi.value];

// {"Цвет": Set("черный", "синий"), …}: what is checked, per property
function chosen(){
  const out={};
  for(const box of $$('.paramsBox',form)){
    const name=$('.paramsBoxTitle span',box)?.textContent.trim();
    const on=$$('input[type=checkbox]:checked',box).map(i=>key($('label[for="'+i.id+'"]',form)?.textContent||''));
    if(name&&on.length)out[name]=new Set(on);
  }
  return out;
}
function predicate(){
  const props=chosen(),names=Object.keys(props);
  const priced=lo&&hi&&(lo.value!==start[0]||hi.value!==start[1]);
  if(!priced&&!names.length)return null;
  const min=priced?num(lo.value)||0:0,max=priced?num(hi.value)||Infinity:Infinity;
  return p=>p.price>=min&&p.price<=max&&names.every(n=>p.props&&p.props[n]!==undefined&&props[n].has(key(p.props[n])));
}
const count=fn=>ids.filter(id=>{const p=OS.product(id);return p&&(!fn||fn(p));}).length;
function preview(){const n=$('#set_filter_num');if(n)n.textContent='('+count(predicate())+')';}

// Nothing fits: say so, with a way back.
const list=$('#catalogSection .productList');
list?.insertAdjacentHTML('beforebegin','<div class="os-filter-empty" hidden><p>Под выбранные параметры товаров нет.</p><button type="button" class="demo-button demo-button-light" data-filter-reset>Сбросить фильтр</button></div>');
function apply(){
  const fn=predicate();
  OS.filterList(fn);
  const none=!!fn&&!count(fn);
  $('.os-filter-empty').hidden=!none;
  // «Фильтр · 2» on the phone button: how many conditions are on
  const on=Object.keys(chosen()).length+(lo&&hi&&(lo.value!==start[0]||hi.value!==start[1])?1:0),label=$('.oSmartFilter');
  if(label){label.lastChild.textContent=on?'Фильтр · '+on:'Фильтр';label.classList.toggle('os-filter-on',!!on);}
  preview();close();
}
function reset(){
  $$('input[type=checkbox]',form).forEach(i=>{i.checked=false;});
  if(lo)lo.value=start[0];if(hi)hi.value=start[1];
  apply();
}

// Properties open and close; «Показать ещё N» shows the rest of the values.
$$('.paramsBoxTitle',form).forEach(t=>{
  const params=t.parentElement.querySelector('.params');if(!params)return;
  t.setAttribute('role','button');t.tabIndex=0;t.setAttribute('aria-expanded',String(!params.classList.contains('collapsed')));
});
function toggleBox(box){
  const params=$('.params',box),exp=$('.propExpander',box),t=$('.paramsBoxTitle',box);if(!params)return;
  const open=params.classList.toggle('collapsed')===false;
  exp?.classList.toggle('expanded',open);t?.setAttribute('aria-expanded',String(open));
}
form.addEventListener('click',e=>{
  const head=e.target.closest('.paramsBoxTitle,.propExpander');
  if(head){e.preventDefault();toggleBox(head.closest('.paramsBox'));return;}
  const more=e.target.closest('.showALL');
  if(more){e.preventDefault();const ul=more.closest('ul'),all=ul.classList.toggle('os-all');
    more.dataset.text=more.dataset.text||more.textContent;more.textContent=all?'Свернуть':more.dataset.text;return;}
  if(e.target.closest('#set_filter,.modef_send_link')){e.preventDefault();apply();return;}
  if(e.target.closest('#del_filter')){e.preventDefault();reset();}
});
form.addEventListener('keydown',e=>{const t=e.target.closest('.paramsBoxTitle');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggleBox(t.closest('.paramsBox'));}});
form.addEventListener('change',preview);
form.addEventListener('input',preview);
form.addEventListener('submit',e=>{e.preventDefault();apply();});       // Enter in a price field
document.addEventListener('click',e=>{if(e.target.closest('[data-filter-reset]'))reset();});

// Phone: «Фильтр» opens the panel over the page; ×, Esc or a tap beside it closes it.
panel.insertAdjacentHTML('afterbegin','<div class="os-filter-head"><b>Фильтр</b><button type="button" class="os-filter-close" aria-label="Закрыть фильтр">×</button></div>');
const shade=document.createElement('div');shade.className='os-filter-shade';shade.hidden=true;document.body.append(shade);
const button=$('.oSmartFilter');
button?.setAttribute('aria-controls','smartFilter');button?.setAttribute('aria-expanded','false');
function open(){panel.classList.add('opened');shade.hidden=false;document.body.classList.add('os-filter-open');button?.setAttribute('aria-expanded','true');$('.os-filter-close',panel).focus();}
function close(){if(!panel.classList.contains('opened'))return;panel.classList.remove('opened');shade.hidden=true;document.body.classList.remove('os-filter-open');button?.setAttribute('aria-expanded','false');}
button?.addEventListener('click',e=>{e.preventDefault();panel.classList.contains('opened')?close():open();});
panel.addEventListener('click',e=>{if(e.target.closest('.os-filter-close'))close();});
shade.addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
preview();
})();
