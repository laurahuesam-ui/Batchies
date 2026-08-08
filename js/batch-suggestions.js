let currentBatchSuggestions=[];

const BATCH_THEMES=[
  {name:'Hair Essentials',min:4,max:6,reason:'Haarpflege und Haarschmuck ergänzen sich als klar verständliches Themen-Set.',match:p=>{
    const s=p.subcategory||''; if(p.category!=='Beauty')return 0;
    if(s==='Haarpflege & Styling'||s==='Haarpflege')return 10;
    if(s==='Haarschmuck')return 9;
    if(s==='Spiegel')return 5;
    if(s==='Kosmetiktaschen & Etuis')return 4;
    return 0;
  }},
  {name:'Beauty Essentials',min:5,max:8,reason:'Verschiedene Beauty-Unterkategorien ergeben ein vielseitiges, aber thematisch geschlossenes Set.',match:p=>{
    const s=p.subcategory||''; if(p.category!=='Beauty')return 0;
    if(['Kosmetiktaschen & Etuis','Spiegel','Lippenpflege','Hautpflege','Make-up Zubehör','Make-up Aufbewahrung','Parfüm & Duftzubehör'].includes(s))return 9;
    if(['Haarpflege & Styling','Haarschmuck'].includes(s))return 6;
    return 4;
  }},
  {name:'Travel Essentials',min:5,max:9,reason:'Kompakte Pflege-, Reise- und Alltagsprodukte decken typische Unterwegs-Situationen ab.',match:p=>{
    const s=p.subcategory||'';
    if(p.category==='Reise & Unterwegs')return 10;
    if(p.category==='Hygiene & Gesundheit'&&['Reisebehälter & Hygiene-Boxen','Desinfektion','Taschentücher','Pillenboxen & Medikamentenaufbewahrung','Mund- & Zahnpflege','Erste Hilfe'].includes(s))return 8;
    if(p.category==='Beauty'&&['Kosmetiktaschen & Etuis','Parfüm & Duftzubehör','Lippenpflege','Hautpflege','Spiegel'].includes(s))return 7;
    if(p.category==='Kleidung & Accessoires'&&s==='Brillenetuis')return 8;
    return 0;
  }},
  {name:'On-the-go Notfallset',min:4,max:7,reason:'Hygiene, kleine Erste-Hilfe-Artikel und praktische Unterwegs-Produkte erfüllen unterschiedliche Notfallrollen.',match:p=>{
    const s=p.subcategory||'';
    if(p.category==='Hygiene & Gesundheit'&&s==='Erste Hilfe')return 10;
    if(p.category==='Hygiene & Gesundheit'&&s==='Desinfektion')return 10;
    if(p.category==='Hygiene & Gesundheit'&&['Taschentücher','Pillenboxen & Medikamentenaufbewahrung'].includes(s))return 8;
    if(p.category==='Beauty'&&['Hautpflege','Lippenpflege'].includes(s))return 5;
    if(p.category==='Reise & Unterwegs')return 4;
    return 0;
  }},
  {name:'Office Starter Set',min:5,max:8,reason:'Schreibwaren, Organisation und Notizen bilden ein funktionales Büro-/Studium-Set.',match:p=>{
    if(p.category!=='Büro & Schule')return 0; const s=p.subcategory||'';
    if(['Stempel & Stempelkissen','Haftnotizen','Mäppchen & Etuis','Stifte','Notizbücher','Sticker','Schreibtischzubehör'].includes(s))return 10;
    if(['Planer','Kalender','Büroorganisation','Mappen & Ordner'].includes(s))return 8;
    if(s==='Lesezeichen'||s==='Lesezubehör')return 3;
    return 5;
  }},
  {name:'Reading Essentials',min:4,max:6,reason:'Lesezeichen, Leselicht und Seitenhalter erfüllen unterschiedliche Funktionen rund ums Lesen.',match:p=>{
    if(p.category!=='Büro & Schule')return 0; const s=p.subcategory||'';
    if(s==='Lesezeichen')return 10;
    if(s==='Lesezubehör')return 10;
    if(s==='Notizbücher')return 6;
    if(s==='Sticker'||s==='Haftnotizen')return 5;
    if(s==='Stifte')return 4;
    return 0;
  }},
  {name:'Little Everyday Essentials',min:5,max:8,reason:'Kleine nützliche Accessoires aus verschiedenen Bereichen ergeben ein breit einsetzbares Geschenk-/Alltagsset.',match:p=>{
    const s=p.subcategory||'';
    if(p.category==='Kleidung & Accessoires'&&['Schlüsselanhänger','Pins & Anstecker','Brillenetuis'].includes(s))return 8;
    if(p.category==='Beauty'&&['Lippenpflege','Hautpflege','Spiegel'].includes(s))return 7;
    if(p.category==='Hygiene & Gesundheit'&&['Taschentücher','Desinfektion','Erste Hilfe'].includes(s))return 6;
    if(p.category==='Büro & Schule'&&['Haftnotizen','Stifte','Lesezeichen'].includes(s))return 5;
    return 0;
  }}
];

function batchItemSet(items){return new Set((items||[]).map(i=>i.pid))}
function jaccard(a,b){const A=batchItemSet(a),B=batchItemSet(b);if(!A.size&&!B.size)return 1;let inter=0;A.forEach(x=>{if(B.has(x))inter++});return inter/(A.size+B.size-inter||1)}
function bestThemeProducts(theme){
  let ranked=state.products.map(p=>({p,score:theme.match(p)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.p.pid).localeCompare(String(b.p.pid)));
  if(ranked.length<theme.min)return [];
  const picked=[],subCounts={};
  for(const x of ranked){
    const sub=x.p.subcategory||'—',n=subCounts[sub]||0;
    // First pass: diversity. At most two products from the same subcategory.
    if(n>=2)continue;
    picked.push(x);subCounts[sub]=n+1;if(picked.length>=theme.max)break;
  }
  if(picked.length<theme.min){for(const x of ranked){if(!picked.some(y=>y.p.pid===x.p.pid)){picked.push(x);if(picked.length>=theme.min)break}}}
  return picked;
}
function buildBatchSuggestions(){
  const out=[];
  for(const theme of BATCH_THEMES){
    const picked=bestThemeProducts(theme);if(picked.length<theme.min)continue;
    const items=picked.map(x=>({pid:x.p.pid,qty:1}));
    const overlaps=state.batches.map(b=>({b,sim:jaccard(items,b.items)})).sort((a,b)=>b.sim-a.sim);
    const closest=overlaps[0];
    if(closest?.sim>=.92)continue;
    const cats=new Set(picked.map(x=>x.p.category)),subs=new Set(picked.map(x=>x.p.subcategory));
    const avg=picked.reduce((a,x)=>a+x.score,0)/picked.length;
    const diversity=Math.min(12,(subs.size-1)*2);
    const overlapPenalty=(closest?.sim||0)*18;
    const priced=picked.filter(x=>productPurchaseCost(x.p)>0).length;
    let score=Math.round(Math.max(55,Math.min(98,62+avg*2+diversity-overlapPenalty)));
    const draft={items,extraCost:0,targetMargin:30,salePrice:0,useOffsite:false,useCurrency:false,useSetup:false};
    const calc=batchCalc(draft);
    out.push({name:theme.name,items,score,reason:theme.reason,categoryCount:cats.size,subcategoryCount:subs.size,priced,calc,closest:closest?.sim>=.35?closest:null});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,7);
}
function renderBatchSuggestions(){
  const el=$('#batchSuggestions');if(!el)return;
  currentBatchSuggestions=buildBatchSuggestions();
  if(!currentBatchSuggestions.length){el.innerHTML='<div class="suggest-empty">Noch nicht genug unterschiedlich kategorisierte Produkte für neue sinnvolle Vorschläge. Sobald weitere Produkte vorhanden sind, entstehen hier automatisch neue Kombinationen.</div>';return}
  el.innerHTML='<div class="suggest-grid">'+currentBatchSuggestions.map((s,i)=>{
    const names=s.items.map(it=>state.products.find(p=>p.pid===it.pid)).filter(Boolean);
    const closest=s.closest?` Ähnlichster vorhandener Batch: ${esc(s.closest.b.name)} (${Math.round(s.closest.sim*100)} % Überschneidung); der Vorschlag bleibt bewusst ausreichend unterschiedlich.`:' Kein nahezu identischer bestehender Batch gefunden.';
    return `<div class="suggest-card"><div class="suggest-head"><div><div class="name">${esc(s.name)}</div><div class="reason">${esc(s.reason)}</div></div><span class="score">${s.score} % Match</span></div><div class="suggest-products">${names.map(p=>`<span class="product-chip" title="${esc(p.category+' → '+p.subcategory)}">${esc(p.pid)} · ${esc(p.name)}</span>`).join('')}</div><div class="suggest-meta"><span>${s.items.length} Produkte</span><span>${s.subcategoryCount} Unterkategorien</span><span>EK ${euro(s.calc.total)}</span><span>empf. VK ${euro(s.calc.recommended)}</span></div><div class="reason">${esc(closest)}</div><button class="btn primary" style="margin-top:10px" onclick="useBatchSuggestion(${i})">Als neuen Batch übernehmen</button></div>`
  }).join('')+'</div>';
}
function useBatchSuggestion(i){
  const s=currentBatchSuggestions[i];if(!s)return;
  openBatch();
  $('#batchName').value=s.name;
  renderBatchItemRows(s.items);
  $('#batchTargetMargin').value=30;
  liveBatchCalc();
}
window.useBatchSuggestion=useBatchSuggestion;
