// «Заказ списком» on the cart page: codes, barcodes, warehouse codes or articles with quantities — pasted
// ("00-00179195;48", "4602078013195 24") or read from a CSV / XLSX file — checked against the catalogue,
// what is found goes into the cart, what is not is shown as not found. Quantities are pieces.
(()=>{
'use strict';
const OS=window.OS,cart=document.querySelector('#demo-cart');if(!OS||!cart)return;
const {B,esc,money}=OS;
const $=(s,r=document)=>r.querySelector(s);
const compact=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]/g,'');

// code (any of the product's codes, compacted) -> ids of the products that carry it
let codes=null;
const load=()=>codes||(codes=fetch(B+'search-index.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('index');return r.json();}).then(items=>{
  const map=new Map(),put=(k,id)=>{if(!k)return;const s=map.get(k)||new Set();s.add(id);map.set(k,s);};
  for(const it of items)for(const k of [it.code,it.codeNum,it.whCode,it.barcode,it.sku])put(compact(k),it.id);
  return map;
}));

// One line: "код;кол-во", "код кол-во", "код\tкол-во" or a code alone (1 piece).
function parse(line){
  const t=line.trim();if(!t)return null;
  const cells=t.split(/\s*[;\t]\s*|\s*,\s+|,(?=\d+$)/).filter(Boolean);
  if(cells.length>=2&&/^\d{1,5}$/.test(cells[cells.length-1])){const qty=+cells.pop();return {raw:t,code:cells.join(' '),qty};}
  const m=t.match(/^(.*\S)\s+(\d{1,5})$/);
  return m?{raw:t,code:m[1],qty:+m[2]}:{raw:t,code:t,qty:1};
}
// The whole code first, then its words one by one ("ДПС 1233.1" is found by "1233.1").
function find(map,code){
  const whole=map.get(compact(code));if(whole)return [...whole];
  const ids=new Set();for(const w of code.split(/\s+/))for(const id of map.get(compact(w))||[])ids.add(id);
  return [...ids];
}
const HEADER=/^(код|артикул|штрих|наимен|товар|кол)/i;

async function check(text){
  const map=await load(),rows=[],qty=new Map();
  text.split(/\r?\n/).forEach((line,i)=>{
    const r=parse(line);if(!r)return;
    if(i===0&&HEADER.test(r.code.replace(/^\ufeff/,''))&&!/\d/.test(r.raw))return;   // a header row
    const ids=find(map,r.code);
    r.status=!r.qty?'qty':!ids.length?'none':ids.length>1?'many':'ok';
    r.id=ids[0];r.ids=ids;rows.push(r);
    if(r.status==='ok')qty.set(r.id,Math.min(9999,(qty.get(r.id)||0)+r.qty));
  });
  return {rows,add:[...qty]};
}

const box=document.createElement('section');box.className='os-orderlist';
box.innerHTML='<details><summary><b>Заказ списком</b> — вставьте коды или штрихкоды с количеством, или загрузите файл</summary>'
 +'<div class="os-ol-body"><label for="os-ol-text">Одна строка — один товар: код, штрихкод, код склада или артикул и количество в штуках, через «;», пробел или табуляцию.</label>'
 +'<textarea id="os-ol-text" rows="6" spellcheck="false" placeholder="00-00179195;48&#10;4602078013195 24&#10;277504;10"></textarea>'
 +'<div class="os-ol-actions"><button type="button" class="demo-button" data-ol-check>Проверить список</button>'
 +'<label class="demo-button demo-button-light os-ol-file">Загрузить CSV или XLSX<input type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-ol-file hidden></label></div>'
 +'<p class="demo-muted">В файле первая колонка — код, вторая — количество. Строка с заголовками пропускается.</p>'
 +'<div class="os-ol-result" aria-live="polite"></div></div></details>';
cart.before(box);
const details=$('details',box),area=$('#os-ol-text',box),result=$('.os-ol-result',box);
// Open when the cart is empty: then the list is the quickest way to fill it.
const empty=()=>!document.querySelector('#demo-cart-lines tr');
setTimeout(()=>{if(empty())details.open=true;},0);

let pending=[];
const STATUS={ok:'',none:'не найден',many:'несколько товаров с таким кодом — уточните',qty:'не указано количество'};
async function run(source='text'){
  result.innerHTML='<p>Проверяем…</p>';
  let r;try{r=await check(area.value);}catch(e){result.innerHTML='<p class="os-ol-bad">Не удалось загрузить каталог. Обновите страницу.</p>';return;}
  pending=r.add;
  window.OSM?.goal('order_list_upload',{source,lines:r.rows.length,found:r.rows.filter(x=>x.status==='ok').length,notFound:r.rows.filter(x=>x.status!=='ok').length});
  if(!r.rows.length){result.innerHTML='<p>Список пуст.</p>';return;}
  const ok=r.rows.filter(x=>x.status==='ok').length,bad=r.rows.length-ok;
  result.innerHTML='<p>Строк: <b>'+r.rows.length+'</b> · найдено: <b>'+ok+'</b>'+(bad?' · <span class="os-ol-bad">не найдено: <b>'+bad+'</b></span>':'')+'</p>'
   +'<div class="demo-table-wrap"><table class="demo-cart-table os-ol-table"><thead><tr><th>Строка</th><th>Товар</th><th>Кол-во</th><th>Сумма</th></tr></thead><tbody>'
   +r.rows.map(x=>{const p=x.status==='ok'&&OS.product(x.id);
     return '<tr class="'+(p?'':'os-ol-miss')+'"><td data-label="Строка"><code>'+esc(x.raw)+'</code></td>'
      +'<td data-label="Товар">'+(p?'<a href="'+esc(p.path)+'">'+esc(p.name)+'</a> '+OS.stockLabel(p):'<span class="os-ol-bad">'+STATUS[x.status]+'</span>')+'</td>'
      +'<td data-label="Кол-во">'+(p?x.qty:'')+'</td><td data-label="Сумма">'+(p?money(p.price*x.qty):'')+'</td></tr>';}).join('')
   +'</tbody></table></div>'
   +(pending.length?'<button type="button" class="demo-button" data-ol-add>Добавить в корзину: '+pending.length+' '+(pending.length%10===1&&pending.length%100!==11?'товар':pending.length%10>=2&&pending.length%10<=4&&(pending.length%100<10||pending.length%100>=20)?'товара':'товаров')+'</button>':'');
}

// XLSX: the first sheet, read here (ZIP central directory + DecompressionStream), no libraries.
async function xlsxRows(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf),dec=new TextDecoder();
  let e=u8.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('Файл не похож на XLSX.');
  const files={};let off=dv.getUint32(e+16,true);
  for(let i=dv.getUint16(e+10,true);i>0;i--){
    const n=dv.getUint16(off+28,true);
    files[dec.decode(u8.subarray(off+46,off+46+n))]={method:dv.getUint16(off+10,true),size:dv.getUint32(off+20,true),at:dv.getUint32(off+42,true)};
    off+=46+n+dv.getUint16(off+30,true)+dv.getUint16(off+32,true);
  }
  const read=async name=>{
    const f=files[name];if(!f)return '';
    const start=f.at+30+dv.getUint16(f.at+26,true)+dv.getUint16(f.at+28,true),data=u8.subarray(start,start+f.size);
    return f.method?new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text():dec.decode(data);
  };
  const xml=s=>new DOMParser().parseFromString(s,'application/xml');
  const shared=[...xml((await read('xl/sharedStrings.xml'))||'<sst/>').getElementsByTagName('si')].map(x=>x.textContent);
  const sheet=files['xl/worksheets/sheet1.xml']?'xl/worksheets/sheet1.xml':Object.keys(files).find(n=>/^xl\/worksheets\/[^/]+\.xml$/.test(n));
  if(!sheet)throw new Error('В файле нет листа.');
  const col=r=>{let n=0;for(const ch of (r||'A').replace(/\d+/g,''))n=n*26+ch.charCodeAt(0)-64;return n-1;};
  return [...xml(await read(sheet)).getElementsByTagName('row')].map(row=>{
    const out=[];
    for(const c of row.getElementsByTagName('c')){
      const t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent??'';
      out[col(c.getAttribute('r'))]=t==='s'?shared[+v]??'':t==='inlineStr'?c.textContent:/e/i.test(v)?Number(v).toFixed(0):v;
    }
    return out;
  });
}
async function fromFile(file){
  let rows;
  if(/\.xlsx$/i.test(file.name))rows=await xlsxRows(await file.arrayBuffer());
  else rows=(await file.text()).split(/\r?\n/).map(l=>l.split(/[;\t]|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.replace(/^"|"$/g,'').trim()));
  // first column — the code, the first whole number after it — the quantity
  return rows.filter((r,i)=>r&&r.length&&String(r[0]??'').trim()&&!(i===0&&HEADER.test(String(r[0]).replace(/^\ufeff/,'').trim()))).map(r=>{const q=r.slice(1).find(c=>/^\d{1,5}$/.test(String(c??'').trim()));return String(r[0]).trim()+(q?';'+String(q).trim():'');}).join('\n');
}

box.addEventListener('click',async e=>{
  if(e.target.closest('[data-ol-check]')){run();return;}
  if(e.target.closest('[data-ol-add]')){
    const b=e.target.closest('[data-ol-add]');b.disabled=true;
    await OS.addAll(pending);
    result.insertAdjacentHTML('afterbegin','<p class="os-note" role="status">Добавлено в корзину: '+pending.length+'. Количество можно поправить в таблице ниже.</p>');
    b.remove();pending=[];
    document.querySelector('#demo-cart')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
});
box.addEventListener('change',async e=>{
  const input=e.target.closest('[data-ol-file]');if(!input||!input.files[0])return;
  try{area.value=await fromFile(input.files[0]);details.open=true;run(/\.xlsx$/i.test(input.files[0].name)?'xlsx':'csv');}
  catch(error){result.innerHTML='<p class="os-ol-bad">'+esc(error.message||'Не удалось прочитать файл.')+'</p>';}
  input.value='';
});
})();
