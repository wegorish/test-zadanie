// Search autotest: the queries of the brief (ТЗ, P1) against the real index of kanctovar/.
//   node tools/search.test.js
// Without Node, macOS JavaScriptCore runs it too (from the repository root):
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/search.test.js
'use strict';
const NODE=typeof require==='function';
const ROOT=NODE?require('path').join(__dirname,'..','kanctovar'):'kanctovar';
const readText=p=>NODE?require('fs').readFileSync(ROOT+'/'+p,'utf8'):read(ROOT+'/'+p);
const log=NODE?console.log:print;
const OSSearch=NODE?require(ROOT+'/js/search.js'):(load(ROOT+'/js/search.js'),globalThis.OSSearch);

const items=JSON.parse(readText('search-index.json'));
const engine=OSSearch.create(items,JSON.parse(readText('search-abbr.json')));
const byCode=code=>items.find(p=>p.code===code);
const STAND=byCode('00-00179195');                                  // Подставка для книг ГЛОБУС ПКМ
const COVER_SECTION=items.filter(p=>p.section==='c26').map(p=>p.id);

const has=(r,id)=>r.items.some(p=>p.id===id);
const CASES=[
  // query, what must be true, what the brief asks
  ['00-00179195',r=>r.total===1&&r.exact&&r.exact.id===STAND.id,'1, сразу карточка'],
  ['179195',r=>r.total===1&&r.exact&&r.exact.id===STAND.id,'1, сразу карточка (короткий код)'],
  ['4602078013195',r=>r.total===1&&r.exact&&r.exact.id===STAND.id,'1 (штрихкод), сразу карточка'],
  ['277504',r=>r.total===1&&r.exact&&r.exact.id===STAND.id,'1 (КодСклад), сразу карточка'],
  ['подставка для книг',r=>r.total>=1&&r.items[0].id===STAND.id,'≥ 1'],
  ['глобус подставка',r=>r.total>=1&&r.items[0].id===STAND.id,'≥ 1'],
  ['подстовка для книг',r=>r.total>=1&&r.items[0].id===STAND.id,'≥ 1 (опечатка)'],
  ['gjlcnfdrf',r=>r.total>=1&&has(r,STAND.id)&&r.layout==='подставка','≥ 1 (раскладка)'],
  ['подст. д/книг глобус',r=>r.total>=1&&r.items[0].id===STAND.id,'≥ 1 (сокращения)'],
  ['обложки',r=>COVER_SECTION.every(id=>r.items.slice(0,COVER_SECTION.length).some(p=>p.id===id)),'все обложки раздела (25) первыми'],
  ['ДПС 1233.1',r=>r.total===1&&r.items[0].code===byCode('00-00029433').code,'1'],
  // beyond the table: the rules behind it
  ['книг подставка глобус',r=>r.items[0].id===STAND.id,'любой порядок слов'],
  ['ПКМ',r=>has(r,STAND.id),'артикул производителя'],
  ['1791',r=>has(r,STAND.id)&&!r.exact,'часть кода: выдача, не переход'],
  ['обложка д/тетр',r=>r.total>=1&&COVER_SECTION.includes(r.items[0].id),'сокращения «д/», «тетр.»'],
  ['тетради хатбер',r=>r.total>=1&&r.items.every(p=>/хат|hatber|хатбер/i.test(p.name+' '+p.brand)),'«хат.» = Hatber'],
  ['zzzqqq',r=>r.total===0&&!r.exact&&!r.partial.length&&engine.top(6).length===6,'пустая выдача: популярные товары'],
  ['подставка для кник',r=>r.total>=1,'опечатка в последней букве'],
];

let failed=0;
for(const [q,ok,want] of CASES){
  const r=engine.search(q);
  const pass=!!ok(r);if(!pass)failed++;
  log((pass?'ok   ':'FAIL ')+JSON.stringify(q).padEnd(26)+' найдено '+String(r.total).padStart(3)+(r.exact?', сразу карточка':'')+(r.layout?', раскладка → '+r.layout:'')+'   (нужно: '+want+')');
  if(!pass)log('      первые: '+r.items.slice(0,3).map(p=>p.code+' '+p.name).join(' | '));
}
log((failed?failed+' из '+CASES.length+' не прошли':'все '+CASES.length+' проверок прошли')+'; товаров в индексе: '+items.length);
if(failed){if(NODE)process.exitCode=1;else quit(1);}
