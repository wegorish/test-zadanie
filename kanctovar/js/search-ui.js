// Search on the page: suggestions under the header field, the results page, «Уточнить раздел» from what was found.
// The engine is js/search.js; cards, prices and the manager block come from demo.js (window.OS).
(()=>{
'use strict';
const OS=window.OS,E=window.OSSearch;if(!OS||!E)return;
const {B,esc,money}=OS;
const $=(s,r=document)=>r.querySelector(s);

let engine=null;
const json=url=>fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(url);return r.json();});
const load=()=>engine||(engine=Promise.all([json(B+'search-index.json'),json(B+'search-abbr.json')]).then(([items,abbr])=>E.create(items,abbr)));
const searchUrl=(q,s)=>B+'search/?q='+encodeURIComponent(q)+(s?'&s='+encodeURIComponent(s):'');
const units=n=>Number(n).toLocaleString('ru-RU');
const stock=it=>it.stock>0?'в наличии '+units(it.stock)+' '+esc(it.unit||'шт.'):it.expected?'ожидается '+esc(it.expected):'нет в наличии';

// ---- Suggestions: from 2 letters, up to 8 products; ↑/↓ choose, Enter opens the chosen one or all results.
const input=$('#searchQuery'),form=$('#topSearchForm');
if(input&&form){
  const box=document.createElement('div');
  box.id='os-suggest';box.className='os-suggest';box.setAttribute('role','listbox');box.setAttribute('aria-label','Подсказки поиска');box.hidden=true;
  (form.parentElement||form).append(box);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','os-suggest');input.setAttribute('aria-expanded','false');
  let timer=0,active=-1,last='';
  const options=()=>[...box.querySelectorAll('[role=option]')];
  const close=()=>{box.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  const mark=i=>{const o=options();active=o.length?(i+o.length)%o.length:-1;o.forEach((x,k)=>x.setAttribute('aria-selected',String(k===active)));
    if(active>=0){input.setAttribute('aria-activedescendant',o[active].id);o[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
  async function suggest(){
    const q=input.value.trim();
    if(q.length<2){close();return;}
    let r;try{r=(await load()).search(q,{limit:8});}catch(e){close();return;}
    if(input.value.trim()!==q)return;                                   // the buyer typed on meanwhile
    last=q;active=-1;
    const note=r.layout?'<div class="os-sg-note">Раскладка исправлена: «'+esc(r.layout)+'»</div>':'';
    const items=r.items.map((it,i)=>'<a class="os-sg-item'+(r.exact&&r.exact.id===it.id?' os-sg-exact':'')+'" role="option" aria-selected="false" id="os-sg-'+i+'" href="'+esc(it.url)+'" tabindex="-1">'
      +'<img src="'+esc(it.image)+'" alt="" loading="lazy"><span class="os-sg-text"><span class="os-sg-name">'+esc(it.name)+'</span>'
      +'<span class="os-sg-meta">Код '+esc(it.code)+(it.sku?' · Арт. '+esc(it.sku):'')+(r.exact&&r.exact.id===it.id?' · <b>точное совпадение</b>':'')+'</span></span>'
      +'<span class="os-sg-side"><b>'+money(it.price)+'</b><small>'+stock(it)+'</small></span></a>').join('');
    const empty=r.items.length?'':'<div class="os-sg-empty">Ничего не нашлось'+(r.didYouMean?'. Возможно, вы искали <a href="'+esc(searchUrl(r.didYouMean))+'">'+esc(r.didYouMean)+'</a>':'')+'</div>';
    box.innerHTML=note+items+empty+(r.total?'<button type="submit" form="topSearchForm" class="os-sg-all">Все результаты: '+r.total+' <span aria-hidden="true">→</span></button>':'');
    box.hidden=false;input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(suggest,120);});
  input.addEventListener('focus',()=>{load().catch(()=>{});if(input.value.trim().length>=2&&box.hidden)suggest();});
  input.addEventListener('keydown',e=>{
    if(box.hidden)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();mark(active+(e.key==='ArrowDown'?1:-1));}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();suggestClick(options()[active]);location.href=options()[active].href;}
    else if(e.key==='Escape'){close();}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('#os-suggest,#searchQuery'))close();});
  const suggestClick=o=>window.OSM?.goal('search_suggest_click',{query:last,position:options().indexOf(o)+1,exact:o.classList.contains('os-sg-exact')});
  box.addEventListener('click',e=>{const o=e.target.closest('[role=option]');if(o)suggestClick(o);});
  box.addEventListener('mousedown',e=>e.preventDefault());                // keep the focus in the field while clicking
}

// ---- Results page
const el=$('#demo-results');
if(el){
  const params=new URLSearchParams(location.search),q=(params.get('q')||'').trim(),section=params.get('s')||'';
  if(input)input.value=q;
  const nav=$('#nextSection'),grid=list=>'<div class="demo-grid">'+list.map(it=>OS.product(it.id)).filter(Boolean).map(OS.card).join('')+'</div>';
  // «Уточнить раздел»: the sections of the products found, not a fixed list of notebooks.
  const sections=r=>{
    if(!nav)return;
    if(!r.sections.length){nav.hidden=true;return;}
    const line=(href,name,count,on)=>'<li><span class="sectionLine"><span class="sectionColumn"><a class="'+(on?'selected':'')+'"'+(on?' aria-current="page"':'')+' href="'+esc(href)+'">'+esc(name)+'</a></span><span class="sectionColumn last"><a class="cnt" href="'+esc(href)+'">'+count+'</a></span></span></li>';
    const all=r.sections.reduce((n,s)=>n+s.count,0);
    $('ul',nav).innerHTML=(r.sections.length>1||section?line(searchUrl(q),'Все разделы',all,!section):'')+r.sections.map(s=>line(searchUrl(q,s.id),s.name,s.count,s.id===section)).join('');
    nav.hidden=false;
  };
  if(!q){el.innerHTML='<p>Введите в поиск название товара, код, штрихкод или артикул — можно как в прайсе: «подст. д/книг».</p>';if(nav)nav.hidden=true;}
  else{
    el.innerHTML='<p class="os-loading">Ищем…</p>';
    load().then(engine=>{
      const r=engine.search(q,{section});
      const M=window.OSM;
      if(!section)M?.goal('search_submit',{query:q,results:r.total,exact:!!r.exact,layout:!!r.layout});
      if(!r.total&&!section)M?.goal('search_empty',{query:q,didYouMean:r.didYouMean||'',partial:r.partial.length});
      if(r.exact&&!section){setTimeout(()=>location.replace(r.exact.url),150);return;}   // a code or a barcode: straight to the product
      sections(r);
      const found=r.total;
      if(OS.inStockOnly&&OS.inStockOnly()){r.items=r.items.filter(it=>it.stock>0);r.total=r.items.length;}
      const chosen=section&&r.sections.find(s=>s.id===section);
      let html='<p class="os-found">По запросу <b>'+esc(q)+'</b> '+(r.total?'найдено товаров: <b>'+r.total+'</b>':'ничего не найдено')+(chosen?' в разделе «'+esc(chosen.name)+'» · <a href="'+esc(searchUrl(q))+'">во всех разделах</a>':'')+'</p>';
      if(r.layout)html+='<p class="os-note">Похоже, запрос набран в другой раскладке — показываем результаты по запросу «<b>'+esc(r.layout)+'</b>».</p>';
      if(found&&OS.catalogTools)html+=OS.catalogTools();
      if(r.total)html+=grid(r.items);
      else if(found)html+='<p>Все найденные товары сейчас не в наличии. <a href="'+esc(searchUrl(q,section))+'">Показать их</a></p>';
      if(!found){
        if(r.didYouMean)html+='<p class="os-dym">Возможно, вы искали: <a href="'+esc(searchUrl(r.didYouMean))+'">'+esc(r.didYouMean)+'</a></p>';
        if(r.partial.length)html+='<h2>Похожие товары</h2><p class="demo-muted">В них есть не все слова запроса.</p>'+grid(r.partial.slice(0,6));
        else html+='<h2>Популярные товары</h2><p class="demo-muted">Похожего в каталоге нет — вот что чаще всего заказывают.</p>'+grid(engine.top(6));
        html+=OS.managerBlock();
      }
      el.innerHTML=html;
    }).catch(()=>{el.innerHTML='<p>Поиск сейчас недоступен. Обновите страницу или позвоните нам.</p>'+OS.managerBlock();});
  }
}
})();
