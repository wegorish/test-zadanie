// Catalogue search in the buyer's words: codes and barcodes, price-list abbreviations, word forms,
// one-letter typos, the wrong keyboard layout, any word order.
// No DOM here: js/search-ui.js uses it in the browser, tools/search.test.js runs it on its own.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OSSearch=factory();})(this,function(){
'use strict';

// ---- text
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');
const compact=s=>norm(s).replace(/[^a-zа-я0-9]/g,'');
// Words and numbers; "1233.1" and "0,5" stay one number.
const tokenize=s=>(norm(s).match(/\d+(?:[.,]\d+)*|[a-zа-я]+/g)||[]).map(t=>t.replace(',','.'));
const isNum=t=>/^\d/.test(t);
// Light Russian stemmer: drops one inflection ending, keeps at least 3 letters ("обложки", "обложка" -> "обложк").
const ENDINGS=['иями','ями','ами','ого','его','ому','ему','ыми','ими','иях','ией','ием','ах','ях','ов','ев','ей','ой','ий','ый','ая','яя','ое','ее','ые','ие','ую','юю','ом','ем','ам','ям','ми','а','я','о','е','ы','и','у','ю','ь','й'];
function stem(t){
  if(isNum(t)||!/[а-я]/.test(t))return t;
  for(const e of ENDINGS)if(t.length-e.length>=3&&t.endsWith(e))return t.slice(0,-e.length);
  return t;
}
// Typed with the other keyboard layout: "gjlcnfdrf" -> "подставка", "рфеиук" -> "hatber".
const EN='`qwertyuiop[]asdfghjkl;\'zxcvbnm,.',RU='ёйцукенгшщзхъфывапролджэячсмитьбю';
const TO_RU={},TO_EN={};for(let i=0;i<EN.length;i++){TO_RU[EN[i]]=RU[i];TO_EN[RU[i]]=EN[i];}
function switchLayout(q){
  const s=norm(q),lat=(s.match(/[a-z]/g)||[]).length,cyr=(s.match(/[а-я]/g)||[]).length;
  if(!lat&&!cyr)return null;
  const map=lat>=cyr?TO_RU:TO_EN;
  return [...s].map(c=>map[c]||c).join('');
}
// At most one insertion, deletion, substitution or swap of neighbours.
function oneEdit(a,b){
  if(a===b)return true;
  const la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;
  let i=0;while(i<la&&i<lb&&a[i]===b[i])i++;
  if(la===lb)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  return la>lb?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
function distance(a,b){                                              // Levenshtein, for «Возможно, вы искали…»
  const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}
// Small words a query may carry without the product name having them.
const STOP=new Set(['и','в','во','на','с','со','по','из','к','от','до','без','под','над','или','а']);

// Match quality: an exact word beats an abbreviation, a word form, a beginning of a word, a typo.
const SCORE={code:40,barcode:40,codePart:15,exact:10,form:9,abbr:8,prefix:6,abbrOf:6,typo:4,layout:-1};
// Searched fields. The section name is left out on purpose: «Тетради, офсетная обложка» must not make
// every notebook of that section a «обложка».
const FIELDS=[['name',1],['brand',1],['sku',1]];

function create(items,dict){
  const abbr=(dict&&dict.abbr)||dict||{};
  const docs=items.map(it=>({it,codes:{
    full:compact(it.code),num:compact(it.codeNum),wh:compact(it.whCode),barcode:compact(it.barcode),sku:compact(it.sku)}}));
  const vocab=new Map();                // stem -> Map(doc index -> weight)
  const shortened=new Set();            // stems written as "прозр." / "д/" in names: an abbreviation of a longer word
  const spelled=new Map();              // stem -> a whole word, for «Возможно, вы искали…»
  const put=(term,i,w)=>{let m=vocab.get(term);if(!m)vocab.set(term,m=new Map());if((m.get(i)||0)<w)m.set(i,w);};
  docs.forEach((d,i)=>{
    for(const [field,w] of FIELDS){
      const text=norm(d.it[field]);
      for(const m of text.matchAll(/\d+(?:[.,]\d+)*|[a-zа-я]+/g)){
        const t=m[0].replace(',','.'),s=stem(t),first=field==='name'&&m.index<2;
        put(s,i,w*(first?1.2:1));             // the first word names the product: "Обложка …" is about covers
        if(!isNum(t)){
          if(/[./]/.test(text[m.index+t.length]||''))shortened.add(s);
          else if(t.length>3&&!spelled.has(s))spelled.set(s,t);
          for(const full of abbr[t]||[])for(const x of tokenize(full))put(stem(x),i,w*.9);
        }
      }
    }
  });
  const terms=[...vocab.keys()];

  // doc index -> best score of one query word
  function matchToken(t){
    const hits=new Map(),hit=(i,score)=>{if((hits.get(i)||0)<score)hits.set(i,score);};
    const from=(term,score)=>{const m=vocab.get(term);if(m)for(const [i,w] of m)hit(i,score*w);};
    if(isNum(t)){
      from(t,SCORE.exact);
      const c=compact(t);
      docs.forEach((d,i)=>{
        const k=d.codes;
        if(c===k.full||c===k.num||c===k.wh||c===k.sku)hit(i,SCORE.code);
        else if(c===k.barcode)hit(i,SCORE.barcode);
        else if(c.length>=4&&(k.full.includes(c)||k.wh.includes(c)||k.barcode.includes(c)||k.sku.includes(c)))hit(i,SCORE.codePart);
      });
      return hits;
    }
    const s=stem(t);
    from(s,s===t?SCORE.exact:SCORE.form);
    for(const full of abbr[t]||[])for(const x of tokenize(full))from(stem(x),SCORE.abbr);
    for(const term of terms){
      if(term===s||isNum(term))continue;
      if(term.startsWith(s)&&s.length>=2)from(term,SCORE.prefix*Math.min(1,s.length/term.length+.4));
      else if(s.startsWith(term)&&term.length>=3&&shortened.has(term))from(term,SCORE.abbrOf);
      else if(s.length>=4&&oneEdit(s,term))from(term,SCORE.typo);
    }
    const c=compact(t);
    if(c.length>=2)docs.forEach((d,i)=>{if(c===d.codes.sku)hit(i,SCORE.code);});
    return hits;
  }

  function run(q){
    const tokens=tokenize(q);
    const words=tokens.filter(t=>!STOP.has(t)||tokens.every(x=>STOP.has(x)));
    const per=tokens.map(t=>({t,need:words.includes(t),hits:matchToken(t)}));
    const need=per.filter(x=>x.need);
    const score=new Map(),found=new Map();
    for(const x of per)for(const [i,v] of x.hits){score.set(i,(score.get(i)||0)+v);if(x.need)found.set(i,(found.get(i)||0)+1);}
    const order=(a,b)=>score.get(b)-score.get(a)||docs[a].it.pop-docs[b].it.pop;
    const all=need.length?[...found].filter(([,n])=>n===need.length).map(([i])=>i).sort(order):[];
    // Nothing has every word: the products that have most of them.
    const most=Math.max(0,...found.values());
    const partial=all.length||need.length<2||most<1?[]:[...found].filter(([,n])=>n===most).map(([i])=>i).sort(order);
    const missing=need.filter(x=>!x.hits.size).map(x=>x.t);
    return {tokens,all,partial,missing};
  }

  // The closest whole word of the catalogue for a word that found nothing.
  function closest(t){
    if(isNum(t)||t.length<3)return null;
    const s=stem(t);let best=null,bestD=3;
    for(const [term,word] of spelled){const dd=distance(s,term);if(dd<bestD){bestD=dd;best=word;}}
    return best;
  }

  /** search(q, {limit, section}) -> {query, layout, items, total, exact, partial, sections, didYouMean} */
  function search(q,opts={}){
    const query=String(q||'').trim();
    const out={query,layout:null,items:[],total:0,exact:null,partial:[],sections:[],didYouMean:null};
    if(!query)return out;
    // A full product code or a barcode of one product: that product.
    const c=compact(query);
    if(c.length>=6){
      const one=docs.filter(d=>c===d.codes.full||c===d.codes.barcode);
      if(one.length===1)out.exact=one[0].it;
    }
    let r=run(query);
    // "00-00179195" is one code to the buyer, two numbers to the tokenizer.
    if(!r.all.length&&c.length>=3){
      const k=d=>d.codes,same=docs.map((d,i)=>[k(d),i]).filter(([x])=>[x.full,x.num,x.wh,x.barcode,x.sku].includes(c)).map(([,i])=>i);
      if(same.length)r={...r,all:same,partial:[],missing:[]};
    }
    if(!r.all.length){
      const other=switchLayout(query);
      if(other&&other!==norm(query)){const r2=run(other);if(r2.all.length){r=r2;out.layout=other;}}
    }
    let ids=r.all;
    const counts=new Map();
    for(const i of ids){const it=docs[i].it,s=counts.get(it.section)||{id:it.section,name:it.sectionName,count:0};s.count++;counts.set(it.section,s);}
    out.sections=[...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ru'));
    if(opts.section)ids=ids.filter(i=>docs[i].it.section===opts.section);
    out.total=ids.length;
    out.items=(opts.limit?ids.slice(0,opts.limit):ids).map(i=>docs[i].it);
    out.partial=r.partial.slice(0,opts.limit||12).map(i=>docs[i].it);
    if(!r.all.length&&r.missing.length){
      const fixed=r.tokens.map(t=>r.missing.includes(t)?closest(t)||t:t);
      if(fixed.join(' ')!==r.tokens.join(' ')&&run(fixed.join(' ')).all.length)out.didYouMean=fixed.join(' ');
    }
    return out;
  }
  return {search,size:docs.length};
}

return {create,tokenize,stem,switchLayout,compact};
});
