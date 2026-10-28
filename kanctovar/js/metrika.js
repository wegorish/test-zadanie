// Measurements for the next Метрика analysis (goals and e-commerce: kanctovar/METRIKA.md).
// The counter itself is not on the site: with OS_CONFIG.METRIKA_ID empty, goals are only kept in window.osEvents;
// the e-commerce data goes to window.dataLayer anyway, where a counter with ecommerce:"dataLayer" will read it.
// ?metrika_debug=1 in the address prints every event to the console.
(()=>{
'use strict';
const C=window.OS_CONFIG||{},id=String(C.METRIKA_ID||'').trim();
const debug=/[?&]metrika_debug=1\b/.test(location.search);
window.dataLayer=window.dataLayer||[];
const log=window.osEvents=window.osEvents||[];
const note=(kind,name,data)=>{log.push({kind,name,data,at:Date.now()});if(debug)console.info('[metrika]',kind,name,data||'');};

// A goal: ym(id, 'reachGoal', name, params), when there is a counter.
function goal(name,params){
  note('goal',name,params);
  if(id&&typeof window.ym==='function'){try{window.ym(id,'reachGoal',name,params);}catch(e){}}
}
// One product as Метрика's e-commerce wants it.
const item=(p,quantity)=>{
  const o={id:p.code||p.id,name:p.name,price:Math.round(p.price*100)/100};
  if(p.brand)o.brand=p.brand;if(p.group||p.sectionName)o.category=p.sectionName||p.group;
  if(quantity!==undefined)o.quantity=quantity;
  return o;
};
// detail | add | remove | purchase — {ecommerce: {currencyCode, <action>: {…}}} into dataLayer.
function ecommerce(action,body){
  const event={ecommerce:{currencyCode:'RUB',[action]:body}};
  window.dataLayer.push(event);note('ecommerce',action,body);
}
window.OSM={goal,ecommerce,item};

// Phone links anywhere on the page: the H6 check (were there 3 clicks in 91 days because the number was not a link?).
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="tel:"]');if(!a)return;
  const place=a.closest('#subHeader3')?'header':a.closest('#footer,#footerLine')?'footer':a.closest('.demo-manager')?'manager':'page';
  goal('phone_click',{place});
},true);
})();
