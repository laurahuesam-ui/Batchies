let currentBatchSuggestions=[];

/*
  Batch-Assistent v2.2
  Kernidee: Produkte werden nicht nur nach Kategorie, sondern nach ihrer Funktion bewertet.
  Multifunktionsprodukte können mehrere Rollen gleichzeitig abdecken. Dadurch sind z. B.
  "Kamm mit Spiegel" und danach zusätzlich "Kamm" + "Spiegel" redundant.
*/
const BATCH_THEMES=[
  {name:'Hair Essentials',coreRoles:['grooming','hairFastener','storage'],optionalRoles:['mirror','hairClip'],complete:7,reason:'Haarpflege und Haarschmuck als klar verständliches Set.',match:p=>{const s=p.subcategory||'';if(p.category!=='Beauty')return 0;if(s==='Haarpflege & Styling'||s==='Haarpflege')return 10;if(s==='Haarschmuck')return 9;if(s==='Spiegel')return 6;if(s==='Kosmetiktaschen & Etuis')return 7;return 0;}},
  {name:'Beauty Essentials',coreRoles:['storage','mirror','beautyCare','makeupTool'],optionalRoles:['lipCare','skinCare','makeupStorage','fragrance','eyeCare','nailCare','beautyTool'],complete:8,reason:'Ein ausgewogenes Beauty-Set aus mehreren Funktionen.',match:p=>{const s=p.subcategory||'';if(p.category!=='Beauty'&&p.category!=='Wellness & Spa')return 0;if(['Kosmetiktaschen & Etuis','Spiegel','Lippenpflege','Hautpflege','Make-up Zubehör','Make-up Aufbewahrung','Parfüm & Duftzubehör','Augenpflege','Nagelpflege','Beauty Tools'].includes(s))return 9;if(p.category==='Wellness & Spa')return 5;if(['Haarpflege & Styling','Haarschmuck'].includes(s))return 4;return 1;}},
  {name:'Everyday Beauty Kit',coreRoles:['storage','grooming','hairFastener','beautyCare'],optionalRoles:['mirror','lipCare','skinCare','makeupTool','makeupStorage','fragrance','eyeCare','nailCare','beautyTool'],complete:10,reason:'Beauty und Hair für die tägliche Routine.',match:p=>{const s=p.subcategory||'';if(p.category!=='Beauty')return 0;if(['Kosmetiktaschen & Etuis','Haarpflege & Styling','Haarschmuck','Spiegel','Lippenpflege','Hautpflege','Augenpflege','Nagelpflege','Beauty Tools'].includes(s))return 10;if(['Make-up Zubehör','Make-up Aufbewahrung','Parfüm & Duftzubehör'].includes(s))return 7;return 2;}},
  {name:'Travel Essentials',coreRoles:['travelStorage','hygiene','personalCare','travelUtility'],optionalRoles:['oralCare','firstAid','sanitize','mirror','medication','eyewear','cooling','fragrance','hairFastener'],complete:9,reason:'Kompakte Pflege-, Reise- und Hygieneprodukte für unterwegs.',match:p=>{const s=p.subcategory||'';if(p.category==='Reise & Unterwegs')return 10;if(p.category==='Hygiene & Gesundheit')return 8;if(p.category==='Beauty'&&['Kosmetiktaschen & Etuis','Parfüm & Duftzubehör','Lippenpflege','Hautpflege','Spiegel','Haarschmuck'].includes(s))return 7;if(p.category==='Kleidung & Accessoires'&&['Brillenetuis','Taschen & Beutel'].includes(s))return 7;return 0;}},
  {name:'On-the-go Notfallset',coreRoles:['firstAid','sanitize','hygiene'],optionalRoles:['medication','lipCare','skinCare','cooling','personalCare'],complete:7,reason:'Kleine Hygiene- und Erste-Hilfe-Produkte für unterwegs.',match:p=>{const s=p.subcategory||'';if(p.category==='Hygiene & Gesundheit'&&['Erste Hilfe','Desinfektion'].includes(s))return 10;if(p.category==='Hygiene & Gesundheit')return 8;if(p.category==='Beauty'&&['Hautpflege','Lippenpflege'].includes(s))return 5;if(p.category==='Reise & Unterwegs')return 4;return 0;}},
  {name:'Office Starter Set',coreRoles:['writing','notes','planning','stationeryStorage'],optionalRoles:['correction','deskUtility','ruler','decoration','stamping'],complete:9,reason:'Die wichtigsten Schreib- und Organisationsprodukte für Büro oder Studium.',match:p=>{if(p.category!=='Büro & Schule'&&p.category!=='Basteln & DIY')return 0;const s=p.subcategory||'';if(['Stifte','Haftnotizen','Notizbücher','Planer','Mäppchen & Etuis','Korrekturmittel','Schreibtischzubehör','Schulzubehör'].includes(s))return 10;if(['Sticker','Stempel & Stempelkissen'].includes(s)||p.category==='Basteln & DIY')return 6;if(['Lesezeichen','Lesezubehör','Lese- & Buchtracker'].includes(s))return 3;return 4;}},
  {name:'Reading Essentials',coreRoles:['bookmark','readingAid','readingRecord'],optionalRoles:['readingLight','pageHolder','bookStorage','notes','writing','decoration','cozy'],complete:7,reason:'Kernprodukte für Lesen, Markieren und Lesefortschritt.',match:p=>{const s=p.subcategory||'';if(p.category==='Büro & Schule'){if(['Lesezeichen','Lesezubehör','Lese- & Buchtracker','Buchtaschen & Buchhüllen'].includes(s))return 10;if(['Notizbücher','Haftnotizen'].includes(s))return 7;if(['Sticker','Stifte'].includes(s))return 5;}if(p.category==='Kleidung & Accessoires'&&s==='Socken')return 4;if(p.category==='Wohnen & Deko'&&s==='Kerzen')return 4;return 0;}},
  {name:'Little Everyday Essentials',coreRoles:['smallCarry','personalCare','hygiene'],optionalRoles:['keyUtility','mirror','lipCare','skinCare','sanitize','firstAid','notes','writing'],complete:8,reason:'Kleine praktische Alltagshelfer aus mehreren Bereichen.',match:p=>{const s=p.subcategory||'';if(p.category==='Kleidung & Accessoires'&&['Schlüsselanhänger','Pins & Anstecker','Brillenetuis'].includes(s))return 8;if(p.category==='Beauty'&&['Lippenpflege','Hautpflege','Spiegel'].includes(s))return 7;if(p.category==='Hygiene & Gesundheit')return 6;if(p.category==='Büro & Schule'&&['Haftnotizen','Stifte'].includes(s))return 5;return 0;}}
];

function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function productRoles(p){
  const n=norm(p.name),s=norm(p.subcategory),c=norm(p.category),r=new Set();
  const has=(...x)=>x.some(v=>n.includes(norm(v))||s.includes(norm(v)));
  if(has('kosmetiktasche','mäppchen','mappchen','pinseletui'))r.add('storage');
  if(has('kosmetiktasche','reisebox','qtip box','zahnbürste box','zahnburste box','schmucketui','sonnenbrillenetui','beutel','strandtasche'))r.add('travelStorage');
  if(has('kamm','haarbürste','haarburste')){r.add('grooming');r.add('personalCare')}
  if(has('spiegel'))r.add('mirror');
  if(has('haargummi','scrunchie','bobby pins','haarklammer')){r.add('hairFastener');r.add('personalCare')}
  if(has('haarklammer','bobby pins'))r.add('hairClip');
  if(has('labello','lippenpflege')){r.add('lipCare');r.add('beautyCare');r.add('personalCare')}
  if(has('handcreme','hautpflege')){r.add('skinCare');r.add('beautyCare');r.add('personalCare')}
  if(has('makeup schwämmchen','make-up schwämmchen','make-up zubehör','makeup zubehör')){r.add('makeupTool');r.add('beautyCare')}
  if(has('makeup schwämmchen box','pinseletui','make-up aufbewahrung'))r.add('makeupStorage');
  if(has('parfüm','parfum','duftzubehör')){r.add('fragrance');r.add('beautyCare')}
  if(has('augenmaske','augenpflege')){r.add('eyeCare');r.add('beautyCare')}
  if(has('nagelfeile','nagelpflege')){r.add('nailCare');r.add('beautyCare')}
  if(has('pinzette','beauty tools')){r.add('beautyTool');r.add('beautyCare')}
  if(has('desinfektion')){r.add('sanitize');r.add('hygiene')}
  if(has('pflaster','erste hilfe'))r.add('firstAid');
  if(has('taschentücher','taschentucher','feuchttücher','feuchttucher','einmalhandtuch','seifenblätter','seifenblatter','abschminktücher','abschminktucher'))r.add('hygiene');
  if(has('pillenbox'))r.add('medication');
  if(has('zahnbürste','zahnburste','zahnstocher','mund- & zahnpflege'))r.add('oralCare');
  if(has('ventilator')){r.add('cooling');r.add('travelUtility')}
  if(has('sonnenbrillenetui','brillenetui')){r.add('eyewear');r.add('travelUtility')}
  if(has('schlüsselanhänger kleine tasche','schlusselanhanger kleine tasche')){r.add('smallCarry');r.add('keyUtility')}
  if(has('schlüsselanhänger','schlusselanhanger'))r.add('keyUtility');
  if(has('kugelschreiber','filzstift','bleistift','highlighter','stifte'))r.add('writing');
  if(has('postit','haftnotiz'))r.add('notes');
  if(has('journal','wochenplaner','ringplaner','planer'))r.add('planning');
  if(has('korrekturroller','korrekturmittel'))r.add('correction');
  if(has('mäppchen','mappchen'))r.add('stationeryStorage');
  if(has('büroklammer','buroklammer','foldback','tacker','heftklammer','paketöffner','paketoffner','schreibtischzubehör'))r.add('deskUtility');
  if(has('lineal','abstandslineal','schulzubehör'))r.add('ruler');
  if(has('washi','sticker'))r.add('decoration');
  if(has('stempel'))r.add('stamping');
  if(has('lesezeichen')){r.add('bookmark');r.add('readingAid')}
  if(has('seitenhalter')){r.add('pageHolder');r.add('readingAid')}
  if(has('buchlicht')){r.add('readingLight');r.add('readingAid')}
  if(has('book tracker','buchtracker','lese- & buchtracker')){r.add('readingRecord');r.add('readingAid')}
  if(has('buchtasche','buchhülle','buchhulle')){r.add('bookStorage');r.add('readingAid')}
  if(has('kuschelsocken','kerze'))r.add('cozy');
  if(has('stressball','badebombe','kerze'))r.add('relaxation');
  if(c==='hygiene & gesundheit')r.add('hygiene');
  if(c==='reise & unterwegs')r.add('travelUtility');
  if(c==='beauty')r.add('personalCare');
  if(['hygiene','personalCare','keyUtility','mirror'].some(x=>r.has(x)))r.add('smallCarry');
  return r;
}

function batchItemSet(items){return new Set((items||[]).map(i=>i.pid))}
function jaccard(a,b){const A=batchItemSet(a),B=batchItemSet(b);if(!A.size&&!B.size)return 1;let inter=0;A.forEach(x=>{if(B.has(x))inter++});return inter/(A.size+B.size-inter||1)}
function rankedThemeProducts(theme){return state.products.map(p=>({p,score:theme.match(p),roles:productRoles(p)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||parseIdNumber(a.p.pid,'PID')-parseIdNumber(b.p.pid,'PID'))}
function roleSetForProducts(products){const out=new Set();products.forEach(p=>productRoles(p).forEach(r=>out.add(r)));return out}
function roleGain(roles,wanted,covered){let gain=0;for(const r of wanted){if(!covered.has(r)&&roles.has(r))gain++}return gain}

/* Greedy Set-Cover: kleinste sinnvolle Teilmenge statt fixe Produktzahl. */
function minimalCoreSelection(theme,available){
  const wanted=new Set(theme.coreRoles||[]),covered=new Set(),pool=[...available],picked=[];
  while([...wanted].some(r=>!covered.has(r))){
    let best=null,bestGain=0,bestScore=-1;
    for(const x of pool){const gain=roleGain(x.roles,wanted,covered);if(gain>bestGain||(gain===bestGain&&gain>0&&x.score>bestScore)){best=x;bestGain=gain;bestScore=x.score}}
    if(!best||bestGain===0)break;
    picked.push(best);best.roles.forEach(r=>covered.add(r));pool.splice(pool.indexOf(best),1);
  }
  /* Wenn nur ein Multifunktionsprodukt übrig bliebe, ergänzen wir bei großen Themen einen zweiten starken Kernartikel. */
  if(picked.length<2&&available.length>1){const extra=available.find(x=>!picked.includes(x));if(extra)picked.push(extra)}
  return picked;
}
function completeThemeSelection(theme){
  const ranked=rankedThemeProducts(theme),picked=minimalCoreSelection(theme,ranked),covered=roleSetForProducts(picked.map(x=>x.p));
  const wanted=[...(theme.optionalRoles||[])];
  for(const role of wanted){if(picked.length>=theme.complete)break;if(covered.has(role))continue;const cand=ranked.find(x=>!picked.includes(x)&&x.roles.has(role));if(cand){picked.push(cand);cand.roles.forEach(r=>covered.add(r))}}
  for(const x of ranked){if(picked.length>=theme.complete)break;if(picked.includes(x))continue;const allCovered=[...x.roles].every(r=>covered.has(r));if(allCovered)continue;picked.push(x);x.roles.forEach(r=>covered.add(r))}
  return picked;
}
function closestExisting(items){return state.batches.map(b=>({b,sim:jaccard(items,b.items)})).sort((a,b)=>b.sim-a.sim)[0]||null}
function suggestionFrom(theme,variant){
  const picked=variant==='basic'?minimalCoreSelection(theme,rankedThemeProducts(theme)):completeThemeSelection(theme);
  if(picked.length<2)return null;
  const items=picked.map(x=>({pid:x.p.pid,qty:1})),closest=closestExisting(items);if(closest?.sim>=.92)return null;
  const subs=new Set(picked.map(x=>x.p.subcategory).filter(Boolean)),avg=picked.reduce((a,x)=>a+x.score,0)/picked.length;
  const draft={items,costs:[{name:'Verpackung / Sonstiges',amount:0}],extraCost:0,targetMargin:30,salePrice:0,useOffsite:false,useCurrency:false,useSetup:false};
  return{name:theme.name+(variant==='basic'?' – Basic':' – Complete'),themeName:theme.name,variant,items,score:Math.round(Math.min(98,58+avg*2+subs.size*2-(closest?.sim||0)*15)),reason:variant==='basic'?'Kleinste sinnvolle Kombination, die die Kernfunktionen dieses Sets abdeckt.':theme.reason,subcategoryCount:subs.size,calc:batchCalc(draft),closest:closest?.sim>=.35?closest:null};
}
function buildBatchSuggestions(){let candidates=[];for(const theme of BATCH_THEMES){const basic=suggestionFrom(theme,'basic'),complete=suggestionFrom(theme,'complete');if(basic)candidates.push(basic);if(complete&&(!basic||jaccard(basic.items,complete.items)<.82))candidates.push(complete)}candidates.sort((a,b)=>b.score-a.score);const kept=[];for(const s of candidates){const duplicate=kept.some(k=>k.themeName!==s.themeName&&jaccard(k.items,s.items)>=.66);if(!duplicate)kept.push(s);if(kept.length>=10)break}return kept}
function renderBatchSuggestions(){const el=$('#batchSuggestions');if(!el)return;currentBatchSuggestions=buildBatchSuggestions();if(!currentBatchSuggestions.length){el.innerHTML='<div class="suggest-empty">Aktuell gibt es keine ausreichend unterschiedlichen neuen Batch-Vorschläge.</div>';return}el.innerHTML='<div class="suggest-grid">'+currentBatchSuggestions.map((s,i)=>{const names=s.items.map(it=>state.products.find(p=>p.pid===it.pid)).filter(Boolean);const closest=s.closest?`Ähnlichster vorhandener Batch: ${esc(s.closest.b.name)} (${Math.round(s.closest.sim*100)} % Überschneidung).`:'Kein nahezu identischer vorhandener Batch.';return `<div class="suggest-card"><div class="suggest-head"><div><div class="name">${esc(s.themeName)} <span class="variant-chip">${s.variant==='basic'?'Basic':'Complete'}</span></div><div class="reason">${esc(s.reason)}</div></div><span class="score">${s.score} % Match</span></div><div class="suggest-products">${names.map(p=>`<span class="product-chip" title="${esc(p.category+' → '+p.subcategory)}">${esc(p.pid)} · ${esc(p.name)}</span>`).join('')}</div><div class="suggest-meta"><span>${s.items.length} Produkte</span><span>${s.subcategoryCount} Unterkategorien</span><span>EK ${euro(s.calc.total)}</span><span>empf. VK ${euro(s.calc.recommended)}</span></div><div class="reason">${esc(closest)}</div><button class="btn primary" style="margin-top:10px" onclick="useBatchSuggestion(${i})">Als neuen Batch übernehmen</button></div>`}).join('')+'</div>'}
function useBatchSuggestion(i){const s=currentBatchSuggestions[i];if(!s)return;openBatch();$('#batchName').value=s.name;renderBatchItemRows(s.items);$('#batchTargetMargin').value=30;liveBatchCalc()}

function themeFitForBatch(batch,theme){const products=(batch.items||[]).map(i=>state.products.find(p=>p.pid===i.pid)).filter(Boolean);if(!products.length)return 0;const positive=products.map(p=>theme.match(p)).filter(Boolean);if(!positive.length)return 0;const roles=roleSetForProducts(products),covered=(theme.coreRoles||[]).filter(r=>roles.has(r)).length,roleCoverage=covered/Math.max(1,(theme.coreRoles||[]).length);const relevance=positive.reduce((a,b)=>a+b,0)/(products.length*10);return Math.min(1,relevance*.45+roleCoverage*.55)}
function detectBatchTheme(batch){return BATCH_THEMES.map(t=>({theme:t,fit:themeFitForBatch(batch,t)})).sort((a,b)=>b.fit-a.fit)[0]||null}
function basicVersionForBatch(batch,theme){const current=new Set((batch.items||[]).map(i=>i.pid));const available=rankedThemeProducts(theme).filter(x=>current.has(x.p.pid));return sortBatchItemsByPid(minimalCoreSelection(theme,available).map(x=>({pid:x.p.pid,qty:(batch.items.find(i=>i.pid===x.p.pid)?.qty)||1})))}

function batchAssistantAnalysis(batch){
  const detected=detectBatchTheme(batch);if(!detected||detected.fit<.18)return{theme:null,completeness:0,suggestions:[],closest:null,basicItems:[]};
  const theme=detected.theme,current=batchItemSet(batch.items),currentProducts=(batch.items||[]).map(i=>state.products.find(p=>p.pid===i.pid)).filter(Boolean),coveredRoles=roleSetForProducts(currentProducts);
  const wanted=[...(theme.coreRoles||[]),...(theme.optionalRoles||[])];
  const candidates=rankedThemeProducts(theme).filter(x=>!current.has(x.p.pid)).map(x=>{
    const newRoles=[...x.roles].filter(r=>wanted.includes(r)&&!coveredRoles.has(r));
    const redundantRoles=[...x.roles].filter(r=>wanted.includes(r)&&coveredRoles.has(r));
    return {...x,newRoles,redundantRoles};
  }).filter(x=>x.newRoles.length>0).sort((a,b)=>b.newRoles.length-a.newRoles.length||b.score-a.score);
  const coreCovered=(theme.coreRoles||[]).filter(r=>coveredRoles.has(r)).length,optionalCovered=(theme.optionalRoles||[]).filter(r=>coveredRoles.has(r)).length;
  const completeness=Math.round(Math.min(100,(coreCovered/Math.max(1,theme.coreRoles.length))*.72+(optionalCovered/Math.max(1,theme.optionalRoles.length||1))*.28)*100);
  const suggestions=candidates.slice(0,5).map(x=>({p:x.p,score:x.score,priority:x.newRoles.some(r=>(theme.coreRoles||[]).includes(r))?'must':x.newRoles.length>=2?'strong':'optional',why:`Ergänzt ${x.newRoles.map(roleLabel).join(' + ')}${x.redundantRoles.length?' und ersetzt keine bereits abgedeckte Kernfunktion':''}`}));
  const closest=state.batches.filter(b=>b.key!==batch.key).map(b=>({b,sim:jaccard(batch.items,b.items)})).sort((a,b)=>b.sim-a.sim)[0]||null;
  return{theme,themeFit:Math.round(detected.fit*100),completeness,suggestions,closest:closest&&closest.sim>=.2?closest:null,basicItems:basicVersionForBatch(batch,theme)};
}
function roleLabel(r){const labels={grooming:'Kämmen/Styling',hairFastener:'Haare fixieren',hairClip:'Haarclip',storage:'Aufbewahrung',mirror:'Spiegel',beautyCare:'Beauty-Pflege',makeupTool:'Make-up Anwendung',lipCare:'Lippenpflege',skinCare:'Hautpflege',makeupStorage:'Make-up Aufbewahrung',fragrance:'Duft',eyeCare:'Augenpflege',nailCare:'Nagelpflege',beautyTool:'Beauty-Tool',travelStorage:'Reise-Aufbewahrung',hygiene:'Hygiene',personalCare:'Körperpflege',travelUtility:'Reise-Nutzen',oralCare:'Mundpflege',firstAid:'Erste Hilfe',sanitize:'Desinfektion',medication:'Medikamente',eyewear:'Brillen-Aufbewahrung',cooling:'Abkühlung',writing:'Schreiben',notes:'Notizen',planning:'Planung',stationeryStorage:'Stifte-Aufbewahrung',correction:'Korrigieren',deskUtility:'Schreibtischfunktion',ruler:'Messen',decoration:'Dekoration',stamping:'Stempeln',bookmark:'Leseposition merken',readingAid:'Lesekomfort',readingRecord:'Lesefortschritt',readingLight:'Leselicht',pageHolder:'Seiten halten',bookStorage:'Buchschutz',cozy:'Gemütlichkeit',smallCarry:'kleines Mitnahmeformat',keyUtility:'Schlüssel-Nutzen'};return labels[r]||r}

function renderBatchAssistant(batch){const wrap=$('#batchAssistant'),content=$('#batchAssistantContent');if(!wrap||!content)return;if(!batch?.key){wrap.classList.add('hidden');content.innerHTML='';return}const a=batchAssistantAnalysis(batch);wrap.classList.remove('hidden');$('#batchAssistantScore').textContent=a.theme?`${a.completeness} % vollständig`:'Noch kein Typ';if(!a.theme){content.innerHTML='<div class="assistant-empty">Aus den aktuell enthaltenen Produkten lässt sich noch kein klarer Batch-Typ ableiten.</div>';return}const basicProducts=a.basicItems.map(i=>state.products.find(p=>p.pid===i.pid)).filter(Boolean);const basic=`<div class="assistant-section"><strong>Kleine Version dieses Batches</strong><div class="basic-version"><div class="tiny">Intelligent reduziert: nur Produkte, die zusammen die Kernfunktionen des erkannten Typs abdecken. Multifunktionsprodukte können mehrere Einzelprodukte ersetzen.</div><div class="suggest-products" style="margin-top:7px">${basicProducts.map(p=>`<span class="product-chip">${esc(p.pid)} · ${esc(p.name)}</span>`).join('')}</div><button type="button" class="btn secondary" style="margin-top:8px" onclick="createBasicBatchFromCurrent()">Als neuen Basic-Batch anlegen</button></div></div>`;const sug=a.suggestions.length?`<div class="assistant-section"><strong>Was noch sinnvoll fehlt</strong><div class="assistant-list" style="margin-top:7px">${a.suggestions.map(x=>`<div class="assistant-item"><div><div class="name">${esc(x.p.pid)} · ${esc(x.p.name)}</div><div class="why">${esc(x.p.category+' → '+x.p.subcategory)} · ${esc(x.why)}</div></div><div class="inline"><span class="priority ${x.priority}">${x.priority==='must'?'Kernfunktion fehlt':x.priority==='strong'?'Sehr sinnvoll':'Optional'}</span><button type="button" class="btn secondary assistant-add" onclick="addAssistantProduct('${x.p.pid}')">+ hinzufügen</button></div></div>`).join('')}</div></div>`:`<div class="assistant-section"><strong>Was noch sinnvoll fehlt</strong><div class="assistant-compare" style="margin-top:7px">Keine funktional notwendige Ergänzung aus deinen Stammdaten gefunden. Bereits abgedeckte Alternativen werden bewusst nicht vorgeschlagen.</div></div>`;let compare='<div class="assistant-section"><strong>Vergleich</strong><div class="assistant-compare" style="margin-top:7px">Kein ausreichend ähnlicher bestehender Batch gefunden.</div></div>';if(a.closest){const A=batchItemSet(batch.items),B=batchItemSet(a.closest.b.items),onlyThere=[...B].filter(x=>!A.has(x));compare=`<div class="assistant-section"><strong>Ähnlichster bestehender Batch</strong><div class="assistant-compare" style="margin-top:7px"><b>${esc(a.closest.b.bid)} · ${esc(a.closest.b.name)}</b> · ${Math.round(a.closest.sim*100)} % Überschneidung${onlyThere.length?`<div class="why">Dort zusätzlich: ${onlyThere.map(esc).join(', ')}</div>`:''}</div></div>`}content.innerHTML=`<div class="assistant-section"><span class="theme-chip">Erkannter Typ: ${esc(a.theme.name)}</span><span class="theme-chip">${a.themeFit} % Typ-Match</span><div class="progress"><span style="width:${a.completeness}%"></span></div></div>${basic}${sug}${compare}`}
function createBasicBatchFromCurrent(){const current=collectBatchDraft(),a=batchAssistantAnalysis(current);if(!a.theme||!a.basicItems.length)return;const name=(current.name||a.theme.name).replace(/\s*[–-]\s*(Basic|Complete)$/i,'')+' – Basic';openBatch();$('#batchName').value=name;renderBatchItemRows(a.basicItems);$('#batchTargetMargin').value=current.targetMargin||30;liveBatchCalc()}
function addAssistantProduct(pid){const batch=collectBatchDraft();if((batch.items||[]).some(i=>i.pid===pid))return;batch.items.push({pid,qty:1});renderBatchItemRows(batch.items);const live=collectBatchDraft();live.key=$('#batchKey').value;renderBatchAssistant(live)}

function initBatchSuggestionsCollapse(){
  const btn=$('#toggleBatchSuggestionsBtn'),panel=$('#batchSuggestionsPanel');if(!btn||!panel)return;
  const key='batchies_batch_suggestions_collapsed';
  const apply=collapsed=>{panel.classList.toggle('hidden',collapsed);btn.textContent=collapsed?'Anzeigen':'Minimieren';btn.setAttribute('aria-expanded',String(!collapsed));};
  let collapsed=false;try{collapsed=localStorage.getItem(key)==='1'}catch(e){}
  apply(collapsed);
  btn.addEventListener('click',()=>{const next=!panel.classList.contains('hidden');apply(next);try{localStorage.setItem(key,next?'1':'0')}catch(e){}});
}
initBatchSuggestionsCollapse();
window.addAssistantProduct=addAssistantProduct;window.useBatchSuggestion=useBatchSuggestion;window.createBasicBatchFromCurrent=createBasicBatchFromCurrent;
