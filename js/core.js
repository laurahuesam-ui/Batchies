const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const num=(v,d=0)=>{const n=parseFloat(v);return Number.isFinite(n)?n:d};
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(num(n));
const pct=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1}).format(num(n))+' %';
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const safeUrl=u=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}};
function normalizeText(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ').trim()}
function displayId(prefix,n){return prefix+'-'+String(n).padStart(4,'0')}
function parseIdNumber(v,prefix){const m=String(v||'').match(new RegExp('^'+prefix+'-(\\d+)$'));return m?num(m[1]):0}
function loadState(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));const s=raw?{...structuredClone(defaultState),...raw,settings:{...defaultState.settings,...raw.settings},counters:{...defaultState.counters,...raw.counters},categoryLearning:{...defaultState.categoryLearning,...raw.categoryLearning}}:structuredClone(defaultState);migrateState(s);return s}catch{return structuredClone(defaultState)}}
function migrateState(s){s.products=Array.isArray(s.products)?s.products:[];s.batches=Array.isArray(s.batches)?s.batches:[];s.investments=Array.isArray(s.investments)?s.investments:[];s.simulationSelectedBatches=Array.isArray(s.simulationSelectedBatches)?s.simulationSelectedBatches.filter(x=>typeof x==='string'):[];s.investments=s.investments.map(x=>({key:x.key||crypto.randomUUID(),type:String(x.type||x.name||''),url:String(x.url||''),cost:num(x.cost??x.amount)}));let maxP=num(s.counters?.product),maxB=num(s.counters?.batch);s.products.forEach((p,i)=>{if(!p.key)p.key=p.id||crypto.randomUUID();let n=parseIdNumber(p.pid,'PID');if(!n){n=++maxP;p.pid=displayId('PID',n)}else maxP=Math.max(maxP,n);if(!Array.isArray(p.suppliers)){p.suppliers=[];if(p.url)p.suppliers.push({id:crypto.randomUUID(),name:'Fundstelle',url:p.url,price:num(p.basePrice),imageUrl:'',preferred:true})}if(p.basePrice===undefined)p.basePrice=0;p.suppliers=p.suppliers.map((x,j)=>{const priceType=x.priceType==='set'?'set':'unit',setQty=Math.max(1,num(x.setQty,1)),setPrice=num(x.setPrice,priceType==='set'?num(x.price)*setQty:0),price=priceType==='set'?setPrice/setQty:num(x.price);return{id:x.id||crypto.randomUUID(),name:x.name||'Lieferant '+(j+1),url:x.url||'',priceType,price,minOrderQty:priceType==='unit'?Math.max(1,num(x.minOrderQty,1)):1,setPrice:priceType==='set'?setPrice:0,setQty:priceType==='set'?setQty:1,totalShipping:num(x.totalShipping),imageUrl:x.imageUrl||'',customs:!!x.customs,preferred:!!x.preferred}});if(p.suppliers.length&&!p.suppliers.some(x=>x.preferred))p.suppliers[0].preferred=true;p.imageUrl=p.imageUrl||'';p.imageData=p.imageData||'';p.colors=normalizeProductColors(p.colors);p.baseColors=normalizeBaseColors(p.baseColors,p.colors)});s.batches.forEach(b=>{if(!b.key)b.key=b.id||crypto.randomUUID();let n=parseIdNumber(b.bid,'BID');if(!n){n=++maxB;b.bid=displayId('BID',n)}else maxB=Math.max(maxB,n);b.items=(Array.isArray(b.items)?b.items:[]).slice().sort((a,c)=>parseIdNumber(a.pid,'PID')-parseIdNumber(c.pid,'PID')||String(a.pid).localeCompare(String(c.pid),'de',{numeric:true}));if(b.targetMargin===undefined)b.targetMargin=30;b.useOffsite=!!b.useOffsite;b.useCurrency=!!b.useCurrency;b.useSetup=!!b.useSetup});s.counters={product:maxP,batch:maxB};
  if(num(s.categorySchemaVersion)<2){
    const fixes={
      'kosmetiktasche':['Beauty','Kosmetiktaschen & Etuis'],
      'kamm':['Beauty','Haarpflege & Styling'],
      'haarklammer':['Beauty','Haarschmuck'],
      'scrunchie':['Beauty','Haarschmuck'],
      'haargummi':['Beauty','Haarschmuck'],
      'spiegel':['Beauty','Spiegel'],
      'kamm mit spiegel':['Beauty','Haarpflege & Styling'],
      'labello':['Beauty','Lippenpflege'],
      'ventilator':['Reise & Unterwegs','Handventilatoren'],
      'fusselburste':['Haushalt & Alltag','Kleiderpflege & Fusselentfernung'],
      'desinfektionsmittel':['Hygiene & Gesundheit','Desinfektion'],
      'pinseletui':['Beauty','Make-up Aufbewahrung'],
      'makeup schwammchen box':['Beauty','Make-up Aufbewahrung'],
      'makeup schwammchen':['Beauty','Make-up Zubehör'],
      'wattepad reisebox':['Hygiene & Gesundheit','Reisebehälter & Hygiene-Boxen'],
      'qtip box':['Hygiene & Gesundheit','Reisebehälter & Hygiene-Boxen'],
      'zahnburste box':['Hygiene & Gesundheit','Mund- & Zahnpflege'],
      'sonnenbrillenetui':['Kleidung & Accessoires','Brillenetuis'],
      'pillenbox':['Hygiene & Gesundheit','Pillenboxen & Medikamentenaufbewahrung'],
      'taschentucher':['Hygiene & Gesundheit','Taschentücher'],
      'parfumflaschen':['Beauty','Parfüm & Duftzubehör'],
      'ringbox':['Schmuck','Ringboxen & Schmucketuis'],
      'pflaster':['Hygiene & Gesundheit','Erste Hilfe'],
      'handcreme':['Beauty','Hautpflege'],
      'zahnstocher':['Hygiene & Gesundheit','Mund- & Zahnpflege']
    };
    s.products.forEach(p=>{const k=normalizeText(p.name);if(fixes[k]){p.category=fixes[k][0];p.subcategory=fixes[k][1]}});
    // Existing learning data from v1.2-v1.6 contained raw Alibaba URL tokens; rebuild it cleanly from product names.
    s.categoryLearning={};
    s.products.forEach(p=>{if(!p.category||!p.subcategory)return;normalizeText(p.name).split(/\s+/).filter(t=>t.length>=3&&!/^\d+$/.test(t)).forEach(t=>{const old=s.categoryLearning[t];if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;else s.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1}})});
    s.categorySchemaVersion=2;
  }

  if(num(s.categorySchemaVersion)<3){
    const fixes3={
      'stempelkissen':['Büro & Schule','Stempel & Stempelkissen'],
      'stempel':['Büro & Schule','Stempel & Stempelkissen'],
      'postits':['Büro & Schule','Haftnotizen'],
      'postits klein':['Büro & Schule','Haftnotizen'],
      'buchlicht':['Büro & Schule','Lesezubehör'],
      'mappchen':['Büro & Schule','Mäppchen & Etuis'],
      'lesezeichen':['Büro & Schule','Lesezeichen'],
      'journal':['Büro & Schule','Notizbücher'],
      'schlusselanhanger':['Kleidung & Accessoires','Schlüsselanhänger'],
      'anstecker':['Kleidung & Accessoires','Pins & Anstecker'],
      'kugelschreiber':['Büro & Schule','Stifte'],
      'leder lesezeichen in herzform':['Büro & Schule','Lesezeichen'],
      'seitenhalter':['Büro & Schule','Lesezubehör'],
      'sticker':['Büro & Schule','Sticker']
    };
    s.products.forEach(p=>{const k=normalizeText(p.name);if(fixes3[k]){p.category=fixes3[k][0];p.subcategory=fixes3[k][1]}});
    s.categoryLearning={};
    s.products.forEach(p=>{if(!p.category||!p.subcategory)return;normalizeText(p.name).split(/\s+/).filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!['mit','und','der','die','das','klein'].includes(t)).forEach(t=>{const old=s.categoryLearning[t];if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;else s.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1}})});
    s.categorySchemaVersion=3;
  }

  if(num(s.categorySchemaVersion)<4){
    const fixes4={
      'filsstift':['Büro & Schule','Stifte'],
      'filzstift':['Büro & Schule','Stifte'],
      'bleistift':['Büro & Schule','Stifte'],
      'korrekturroller':['Büro & Schule','Korrekturmittel'],
      'highlighter':['Büro & Schule','Stifte'],
      'wochenplaner':['Büro & Schule','Planer'],
      'washi tape':['Basteln & DIY','Washi Tape & Deko-Klebebänder'],
      'book tracker':['Büro & Schule','Lese- & Buchtracker'],
      'buroklammer':['Büro & Schule','Schreibtischzubehör']
    };
    s.products.forEach(p=>{const k=normalizeText(p.name);if(fixes4[k]){p.category=fixes4[k][0];p.subcategory=fixes4[k][1]}});
    s.batches.forEach(b=>{b.items=(b.items||[]).slice().sort((a,c)=>parseIdNumber(a.pid,'PID')-parseIdNumber(c.pid,'PID')||String(a.pid).localeCompare(String(c.pid),'de',{numeric:true}))});
    s.categoryLearning={};
    s.products.forEach(p=>{if(!p.category||!p.subcategory)return;normalizeText(p.name).split(/\s+/).filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!['mit','und','der','die','das','klein'].includes(t)).forEach(t=>{const old=s.categoryLearning[t];if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;else s.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1}})});
    s.categorySchemaVersion=4;
  }

  if(num(s.categorySchemaVersion)<5){
    const fixes5={
      'filsstift':['Büro & Schule','Stifte'],
      'filzstift':['Büro & Schule','Stifte'],
      'bleistift':['Büro & Schule','Stifte'],
      'korrekturroller':['Büro & Schule','Korrekturmittel'],
      'highlighter':['Büro & Schule','Stifte'],
      'wochenplaner':['Büro & Schule','Planer'],
      'washi tape':['Basteln & DIY','Washi Tape & Deko-Klebebänder'],
      'book tracker':['Büro & Schule','Lese- & Buchtracker'],
      'buroklammer':['Büro & Schule','Schreibtischzubehör']
    };
    s.products.forEach(p=>{const k=normalizeText(p.name),f=fixes5[k];if(f&&(!p.category||p.category==='Sonstiges'||!p.subcategory)){p.category=f[0];p.subcategory=f[1]}});
    s.categoryLearning={};
    s.products.forEach(p=>{if(!p.category||!p.subcategory)return;normalizeText(p.name).split(/\s+/).filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!['mit','und','der','die','das','klein'].includes(t)).forEach(t=>{const old=s.categoryLearning[t];if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;else s.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1}})});
    s.categorySchemaVersion=5;
  }


  if(num(s.categorySchemaVersion)<6){
    const fixes6={
      'augenmaske':['Beauty','Augenpflege'],
      'einmalhandtuch gross':['Hygiene & Gesundheit','Einmalhandtücher & Waschhandschuhe'],
      'einmalhandtuch':['Hygiene & Gesundheit','Einmalhandtücher & Waschhandschuhe'],
      'beutel':['Verpackung','Tüten & Beutel'],
      'buchtasche':['Büro & Schule','Buchtaschen & Buchhüllen'],
      'planer schablone':['Büro & Schule','Planer-Zubehör'],
      'kuschelsocken':['Kleidung & Accessoires','Socken'],
      'stressball':['Wellness & Spa','Stressabbau & Entspannung'],
      'ringplaner':['Büro & Schule','Planer'],
      'feuchttucher':['Hygiene & Gesundheit','Feuchttücher'],
      'strandtasche':['Kleidung & Accessoires','Taschen & Beutel'],
      'zahnstocher box':['Hygiene & Gesundheit','Mund- & Zahnpflege'],
      'foldback klammer':['Büro & Schule','Schreibtischzubehör'],
      'abstandslineal':['Garten','Aussaatlineale & Pflanzabstand'],
      'abschminktucher':['Beauty','Make-up Entfernung'],
      'nagelfeile':['Beauty','Nagelpflege'],
      'pinzette':['Beauty','Beauty Tools'],
      'bobby pins':['Beauty','Haarschmuck'],
      'mini paketoffner':['Büro & Schule','Schreibtischzubehör'],
      'lineal':['Büro & Schule','Schulzubehör'],
      'tacker':['Büro & Schule','Schreibtischzubehör'],
      'heftklammer':['Büro & Schule','Schreibtischzubehör']
    };
    s.products.forEach(p=>{const k=normalizeText(p.name),f=fixes6[k];if(f&&(!p.category||p.category==='Sonstiges'||!p.subcategory||k==='augenmaske')){p.category=f[0];p.subcategory=f[1]}});
    s.categoryLearning={};
    s.products.forEach(p=>{if(!p.category||!p.subcategory)return;normalizeText(p.name).split(/\s+/).filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!['mit','und','der','die','das','klein','kleine','gross'].includes(t)).forEach(t=>{const old=s.categoryLearning[t];if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;else s.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1}})});
    s.categorySchemaVersion=6;
  }

}
function saveState(){state.batches.forEach(b=>{b.items=(b.items||[]).slice().sort((a,c)=>parseIdNumber(a.pid,'PID')-parseIdNumber(c.pid,'PID')||String(a.pid).localeCompare(String(c.pid),'de',{numeric:true}))});localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function statusLabel(s){return ({idea:'Idee',research:'Recherche',prototype:'Prototyp',ready:'Verkaufsbereit'})[s]||'Idee'}

let state=loadState();
