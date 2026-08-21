const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const num=(v,d=0)=>{const n=parseFloat(v);return Number.isFinite(n)?n:d};
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(num(n));
const pct=n=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1}).format(num(n))+' %';
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const safeUrl=u=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}};
function normalizeText(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ').trim()}
function isAlibabaSupplierName(name){return normalizeText(name).includes('alibaba')}
function displayId(prefix,n){return prefix+'-'+String(n).padStart(4,'0')}
function parseIdNumber(v,prefix){const m=String(v||'').match(new RegExp('^'+prefix+'-(\\d+)$'));return m?num(m[1]):0}
function mergeRecoveryArray(recovery,current,idField){
  const out=(Array.isArray(recovery)?recovery:[]).map(x=>structuredClone(x));
  (Array.isArray(current)?current:[]).forEach(x=>{
    const id=x?.[idField]||x?.key;
    const idx=out.findIndex(y=>(y?.[idField]||y?.key)===id);
    if(idx<0){out.push(structuredClone(x));return}
    const base=out[idx],merged={...base,...structuredClone(x)};
    if(Array.isArray(base.suppliers)||Array.isArray(x.suppliers)){
      const sm=new Map((base.suppliers||[]).map(s=>[s.id,structuredClone(s)]));
      (x.suppliers||[]).forEach(s=>{
        if(s.id&&sm.has(s.id))sm.set(s.id,{...sm.get(s.id),...structuredClone(s)});
        else sm.set(s.id||crypto.randomUUID(),structuredClone(s))
      });
      merged.suppliers=[...sm.values()]
    }
    out[idx]=merged
  });
  return out
}
function loadState(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY))}
  catch(err){console.error('LocalStorage unlesbar; nur dann wird Recovery verwendet.',err)}

  const recovery=typeof RECOVERY_STATE!=='undefined'?structuredClone(RECOVERY_STATE):structuredClone(defaultState);
  const hasCurrent=!!(raw&&typeof raw==='object');
  const current=hasCurrent?structuredClone(raw):{};

  const s={
    ...structuredClone(defaultState),
    ...(hasCurrent?current:recovery),
    settings:{...defaultState.settings,...(hasCurrent?(current.settings||{}):(recovery.settings||{}))},
    counters:{...defaultState.counters,...(hasCurrent?(current.counters||{}):(recovery.counters||{}))},
    categoryLearning:{...defaultState.categoryLearning,...(hasCurrent?(current.categoryLearning||{}):(recovery.categoryLearning||{}))}
  };

  if(hasCurrent){
    s.products=Array.isArray(current.products)?structuredClone(current.products):[];
    s.packaging=Array.isArray(current.packaging)?structuredClone(current.packaging):[];
    s.batches=Array.isArray(current.batches)?structuredClone(current.batches):[];
    s.investments=Array.isArray(current.investments)?structuredClone(current.investments):[];
  }else{
    s.products=Array.isArray(recovery.products)?structuredClone(recovery.products):[];
    s.packaging=Array.isArray(recovery.packaging)?structuredClone(recovery.packaging):[];
    s.batches=Array.isArray(recovery.batches)?structuredClone(recovery.batches):[];
    s.investments=Array.isArray(recovery.investments)?structuredClone(recovery.investments):[];
  }

  try{migrateState(s)}catch(err){console.error('Migration fehlgeschlagen.',err)}
  return s
}
function migrateAlibabaCustomsOnce(state){
  if(!state || state.alibabaCustomsMigrationV246) return state;
  (state.products || []).forEach(p => {
    (p.suppliers || []).forEach(s => {
      if(isAlibabaSupplierName(s.name)) s.customs = true;
    });
  });
  state.alibabaCustomsMigrationV246 = true;
  return state;
}

function migrateState(s){s.products=Array.isArray(s.products)?s.products:[];s.packaging=Array.isArray(s.packaging)?s.packaging:[];s.batches=Array.isArray(s.batches)?s.batches:[];s.investments=Array.isArray(s.investments)?s.investments:[];s.simulationSelectedBatches=Array.isArray(s.simulationSelectedBatches)?s.simulationSelectedBatches.filter(x=>typeof x==='string'):[];s.inventorySimulation=s.inventorySimulation&&typeof s.inventorySimulation==='object'?s.inventorySimulation:{stock:{}};s.inventorySimulation.stock=s.inventorySimulation.stock&&typeof s.inventorySimulation.stock==='object'?s.inventorySimulation.stock:{};s.salesGrowthSimulation=s.salesGrowthSimulation&&typeof s.salesGrowthSimulation==='object'?s.salesGrowthSimulation:{sourceKey:'',stages:[]};s.salesGrowthSimulation.stages=Array.isArray(s.salesGrowthSimulation.stages)?s.salesGrowthSimulation.stages.filter(x=>typeof x==='string'):[];s.realWarehouse=Array.isArray(s.realWarehouse)?s.realWarehouse:[];s.realWarehouse=s.realWarehouse.map(x=>({key:x.key||crypto.randomUUID(),kind:x.kind==='VID'?'VID':'PID',itemId:String(x.itemId||x.pid||x.vid||''),color:String(x.color||''),qty:Math.max(0,num(x.qty)),paidTotal:Math.max(0,num(x.paidTotal)),note:String(x.note||''),createdAt:x.createdAt||new Date().toISOString()})).filter(x=>x.itemId);s.batches=(s.batches||[]).map(b=>({...b,saleVariants:Array.isArray(b.saleVariants)?b.saleVariants.map(v=>({key:v.key||crypto.randomUUID(),name:String(v.name||v.color||'Variante'),productColors:v.productColors&&typeof v.productColors==='object'?v.productColors:{}})):[]}));s.salesHistory=Array.isArray(s.salesHistory)?s.salesHistory:[];s.salesHistory=s.salesHistory.map(x=>({...x,key:x.key||crypto.randomUUID(),batchKey:String(x.batchKey||''),bid:String(x.bid||''),color:String(x.color||''),qty:Math.max(1,num(x.qty,1)),actualUnitPrice:Math.max(0,num(x.actualUnitPrice)),revenue:Math.max(0,num(x.revenue)),cogs:Math.max(0,num(x.cogs)),soldAt:x.soldAt||new Date().toISOString()}));s.salesPlanning=s.salesPlanning&&typeof s.salesPlanning==='object'?s.salesPlanning:{};s.salesPlanning.purchaseRows=Array.isArray(s.salesPlanning.purchaseRows)?s.salesPlanning.purchaseRows:[];s.salesPlanning.variantRates=s.salesPlanning.variantRates&&typeof s.salesPlanning.variantRates==='object'?s.salesPlanning.variantRates:{};s.salesPlanning.reorderOverrides=s.salesPlanning.reorderOverrides&&typeof s.salesPlanning.reorderOverrides==='object'?s.salesPlanning.reorderOverrides:{};s.salesPlanning.leadWeeks=Math.max(0,num(s.salesPlanning.leadWeeks,3));s.salesPlanning.safetyWeeks=Math.max(0,num(s.salesPlanning.safetyWeeks,1));s.salesPlanning.thresholdPct=Math.max(0,Math.min(100,num(s.salesPlanning.thresholdPct,35)));s.salesPlanning.horizonWeeks=Math.max(4,Math.min(260,num(s.salesPlanning.horizonWeeks,52)));s.salesPlanning.horizonPreset=String(s.salesPlanning.horizonPreset||'52w');s.investments=s.investments.map(x=>({key:x.key||crypto.randomUUID(),type:String(x.type||x.name||''),url:String(x.url||''),cost:num(x.cost??x.amount)}));let maxP=num(s.counters?.product),maxV=num(s.counters?.packaging),maxB=num(s.counters?.batch);s.products.forEach((p,i)=>{if(!p.key)p.key=p.id||crypto.randomUUID();let n=parseIdNumber(p.pid,'PID');if(!n){n=++maxP;p.pid=displayId('PID',n)}else maxP=Math.max(maxP,n);if(!Array.isArray(p.suppliers)){p.suppliers=[];if(p.url)p.suppliers.push({id:crypto.randomUUID(),name:'Fundstelle',url:p.url,price:num(p.basePrice),imageUrl:'',preferred:true})}if(p.basePrice===undefined)p.basePrice=0;p.suppliers=p.suppliers.map((x,j)=>{const priceType=x.priceType==='set'?'set':'unit',setQty=Math.max(1,num(x.setQty,1)),setPrice=num(x.setPrice,priceType==='set'?num(x.price)*setQty:0),price=priceType==='set'?setPrice/setQty:num(x.price);return{...x,id:x.id||crypto.randomUUID(),name:x.name||'Lieferant '+(j+1),url:x.url||'',priceType,price,minOrderQty:priceType==='unit'?Math.max(1,num(x.minOrderQty,1)):1,unitIsSet:priceType==='unit'&&!!x.unitIsSet,unitSetQty:priceType==='unit'&&x.unitIsSet?Math.max(1,num(x.unitSetQty,1)):1,setPrice:priceType==='set'?setPrice:0,setQty:priceType==='set'?setQty:1,totalShipping:num(x.totalShipping),imageUrl:x.imageUrl||'',customs:!!x.customs,preferred:!!x.preferred,priceTiers:Array.isArray(x.priceTiers)?x.priceTiers:[],shippingPoints:Array.isArray(x.shippingPoints)?x.shippingPoints:[],activeCalcSource:x.activeCalcSource&&typeof x.activeCalcSource==='object'?x.activeCalcSource:null}});if(p.suppliers.length&&!p.suppliers.some(x=>x.preferred))p.suppliers[0].preferred=true;p.imageUrl=p.imageUrl||'';p.imageData=p.imageData||'';p.colors=normalizeProductColors(p.colors);p.baseColors=normalizeBaseColors(p.baseColors,p.colors)});
s.packaging.forEach((v,i)=>{
  if(!v.key)v.key=v.id||crypto.randomUUID();
  let n=parseIdNumber(v.vid,'VID');
  if(!n){n=++maxV;v.vid=displayId('VID',n)}else maxV=Math.max(maxV,n);
  v.name=String(v.name||'');
  v.status=v.status||'idea';
  if(!Array.isArray(v.suppliers))v.suppliers=[];
  v.suppliers=v.suppliers.map((x,j)=>{
    const priceType=x.priceType==='consumable'?'consumable':(x.priceType==='set'?'set':'unit'),
      setQty=Math.max(1,num(x.setQty,1)),
      setPrice=num(x.setPrice,priceType==='set'?num(x.price)*setQty:0),
      price=priceType==='set'?setPrice/setQty:(priceType==='consumable'?0:num(x.price));
    return{...x,id:x.id||crypto.randomUUID(),name:x.name||'Lieferant '+(j+1),url:x.url||'',priceType,price,
      minOrderQty:priceType==='unit'?Math.max(1,num(x.minOrderQty,1)):1,
      unitIsSet:priceType==='unit'&&!!x.unitIsSet,
      unitSetQty:priceType==='unit'&&x.unitIsSet?Math.max(1,num(x.unitSetQty,1)):1,
      setPrice:priceType==='set'?setPrice:0,setQty:priceType==='set'?setQty:1,
      purchasePrice:num(x.purchasePrice),packageCount:Math.max(1,num(x.packageCount,1)),
      amountPerPackage:Math.max(0.0001,num(x.amountPerPackage,1)),consumptionUnit:x.consumptionUnit||'m',
      totalShipping:num(x.totalShipping),imageUrl:x.imageUrl||'',customs:!!x.customs,preferred:!!x.preferred,priceTiers:Array.isArray(x.priceTiers)?x.priceTiers.map(t=>{
        const priceType=t.priceType==='set'?'set':'unit',
          setQty=Math.max(1,num(t.setQty,1)),
          setPrice=num(t.setPrice),
          unitPrice=priceType==='set'?(setPrice/setQty):num(t.unitPrice);
        return {...t,priceType,unitPrice,setPrice:priceType==='set'?setPrice:0,setQty:priceType==='set'?setQty:1}
      }):[],
      shippingPoints:Array.isArray(x.shippingPoints)?x.shippingPoints:[]}
  });
  if(v.suppliers.length&&!v.suppliers.some(x=>x.preferred))v.suppliers[0].preferred=true;
  v.notes=String(v.notes||'');
});s.batches.forEach(b=>{if(!b.key)b.key=b.id||crypto.randomUUID();let n=parseIdNumber(b.bid,'BID');if(!n){n=++maxB;b.bid=displayId('BID',n)}else maxB=Math.max(maxB,n);b.items=(Array.isArray(b.items)?b.items:[]).slice().sort((a,c)=>parseIdNumber(a.pid,'PID')-parseIdNumber(c.pid,'PID')||String(a.pid).localeCompare(String(c.pid),'de',{numeric:true}));b.packagingItems=(Array.isArray(b.packagingItems)?b.packagingItems:[]).slice().sort((a,c)=>parseIdNumber(a.vid,'VID')-parseIdNumber(c.vid,'VID')||String(a.vid).localeCompare(String(c.vid),'de',{numeric:true}));if(!Array.isArray(b.costs))b.costs=[];b.extraCost=num(b.extraCost);if(b.targetMargin===undefined)b.targetMargin=30;b.useOffsite=!!b.useOffsite;b.useCurrency=!!b.useCurrency;b.useSetup=!!b.useSetup});s.counters={product:maxP,packaging:maxV,batch:maxB};
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


  return migrateAlibabaCustomsOnce(s);
}
function saveState(){state.packaging=(state.packaging||[]).slice().sort((a,b)=>parseIdNumber(a.vid,'VID')-parseIdNumber(b.vid,'VID')||String(a.vid).localeCompare(String(b.vid),'de',{numeric:true}));state.batches.forEach(b=>{b.items=(b.items||[]).slice().sort((a,c)=>parseIdNumber(a.pid,'PID')-parseIdNumber(c.pid,'PID')||String(a.pid).localeCompare(String(c.pid),'de',{numeric:true}));b.packagingItems=(b.packagingItems||[]).slice().sort((a,c)=>parseIdNumber(a.vid,'VID')-parseIdNumber(c.vid,'VID')||String(a.vid).localeCompare(String(c.vid),'de',{numeric:true}))});localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function statusLabel(s){return ({idea:'Idee',research:'Recherche',prototype:'Prototyp',ready:'Verkaufsbereit'})[s]||'Idee'}

let state=loadState();
