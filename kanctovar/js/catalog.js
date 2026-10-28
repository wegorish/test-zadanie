// Section pages and search results for a wholesale buyer: tile or list view (remembered), stock on every
// product, «Только в наличии», quantity and «В корзину» always in sight.
// The list is the same markup laid out in a row: demo.css, body.os-view-list.
(()=>{
'use strict';
const OS=window.OS;if(!OS)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY='officesklad-demo:view';
const ICON={
  tile:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z"/></svg>',
  list:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M1 2h3v3H1zm5 0h9v3H6zM1 7h3v3H1zm5 0h9v3H6zm-5 5h3v3H1zm5 0h9v3H6z"/></svg>'
};
const view=()=>{try{return localStorage.getItem(KEY)==='list'?'list':'tile';}catch(e){return 'tile';}};
function setView(v){
  document.body.classList.toggle('os-view-list',v==='list');
  try{localStorage.setItem(KEY,v);}catch(e){}
  $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
}
const inStockOnly=()=>new URLSearchParams(location.search).get('instock')==='1';
// The view switch and the stock filter: the same on a section page and on the results page (js/search-ui.js).
function tools(){
  const v=view();
  return '<div class="os-tools"><div class="os-view" role="group" aria-label="Вид каталога">'
   +'<button type="button" data-view="tile" aria-pressed="'+(v==='tile')+'">'+ICON.tile+'Плитка</button>'
   +'<button type="button" data-view="list" aria-pressed="'+(v==='list')+'">'+ICON.list+'Список</button></div>'
   +'<label class="os-instock"><input type="checkbox" data-instock'+(inStockOnly()?' checked':'')+'> Только в наличии</label></div>';
}
OS.catalogTools=tools;OS.inStockOnly=inStockOnly;

// Tiles of the source template: stock, the «Мин.цена» note, a quantity of 1 to start with.
function dressTile(tile){
  const p=OS.product(tile.dataset.product);if(!p||tile.dataset.dressed)return;
  tile.dataset.dressed='1';
  const code=$('.requisites_code',tile);if(code)code.insertAdjacentHTML('afterend',OS.stockLabel(p));
  const min=$('.min_price_property',tile);if(min)min.insertAdjacentHTML('beforeend',' '+OS.minPriceTip());
  const qty=$('input.quantity',tile);if(qty){qty.value=qty.value||1;qty.inputMode='numeric';qty.maxLength=4;qty.setAttribute('aria-label','Количество: '+p.name);}
}
$$('.productList .product[data-product]').forEach(dressTile);

// The source switch (tile / line / table, not working) gives way to ours, a row of its own under sorting.
const line=$('#catalogLine .viewList');
if(line){line.closest('.column').hidden=true;$('#catalogLine').insertAdjacentHTML('afterend',tools());}
setView(view());

document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
document.addEventListener('change',e=>{
  if(!e.target.matches('[data-instock]'))return;
  const u=new URLSearchParams(location.search);
  if(e.target.checked)u.set('instock','1');else u.delete('instock');
  u.delete('PAGEN_1');location.search=u.toString();
});
})();
