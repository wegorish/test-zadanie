// Product page for a wholesale buyer: order in pieces or packs («шт / кор (24 шт)») with the pieces and the sum
// recounted, and what «Мин.цена» means. demo.js multiplies the quantity by the input's data-mult.
(()=>{
'use strict';
const OS=window.OS;if(!OS)return;
const m=/^product:(\d+)$/.exec(document.body.dataset.page||'');if(!m)return;
const p=OS.product(m[1]);if(!p)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const base=OS.unit(p).replace(/\.$/,'');
const units=[{unit:base,size:1},...(p.packs||[])];
const n=v=>Number(v).toLocaleString('ru-RU');

// On a phone the buying block (#smallElementTools, hidden on a desktop) follows the photo, not the specifications.
const photo=$('#browse > .col'),small=$('#smallElementTools');
if(photo&&small)photo.after(small);

$$('.mainToolContainer .min_price_property').forEach(x=>x.insertAdjacentHTML('beforeend',' '+OS.minPriceTip()));

$$('.mainToolContainer').forEach((box,k)=>{
  const input=$('input.qty',box),cart=$('.addCartContainer',box);if(!input||!cart)return;
  input.value=Math.max(1,parseInt(input.value)||1);input.dataset.mult='1';
  const name='os-unit-'+k;
  if(units.length>1)cart.insertAdjacentHTML('beforebegin','<fieldset class="os-units"><legend>Заказать</legend>'
    +units.map((u,i)=>'<label><input type="radio" name="'+name+'" value="'+u.size+'"'+(i?'':' checked')+'> '+OS.esc(u.unit)+(u.size>1?' ('+n(u.size)+' '+OS.esc(base)+')':'')+'</label>').join('')+'</fieldset>');
  cart.insertAdjacentHTML('afterend','<p class="os-sum" aria-live="polite"></p>');
  const sum=$('.os-sum',box);
  const update=()=>{
    const q=Math.max(1,parseInt(input.value)||1),size=Number(input.dataset.mult)||1,u=units.find(x=>x.size===size)||units[0],pieces=q*size;
    sum.innerHTML=(size>1?n(q)+' '+OS.esc(u.unit)+' × '+n(size)+' = <b>'+n(pieces)+' '+OS.esc(base)+'</b> · ':'Сумма: ')+'<b>'+OS.money(p.price*pieces)+'</b>';
  };
  box.addEventListener('change',e=>{if(e.target.name===name){input.dataset.mult=e.target.value;input.value=1;}update();});
  box.addEventListener('input',update);
  box.addEventListener('click',e=>{if(e.target.closest('.plus,.minus'))setTimeout(update);});   // demo.js changes the value on the same click
  update();
});
})();
