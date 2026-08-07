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
function migrateState(s){s.products=Array.isArray(s.products)?s.products:[];s.batches=Array.isArray(s.batches)?s.batches:[];let maxP=num(s.counters?.product),maxB=num(s.counters?.batch);s.products.forEach((p,i)=>{if(!p.key)p.key=p.id||crypto.randomUUID();let n=parseIdNumber(p.pid,'PID');if(!n){n=++maxP;p.pid=displayId('PID',n)}else maxP=Math.max(maxP,n);if(!Array.isArray(p.suppliers)){p.suppliers=[];if(p.url)p.suppliers.push({id:crypto.randomUUID(),name:'Fundstelle',url:p.url,price:num(p.basePrice),imageUrl:'',preferred:true})}if(p.basePrice===undefined)p.basePrice=0;p.suppliers=p.suppliers.map((x,j)=>({id:x.id||crypto.randomUUID(),name:x.name||'Lieferant '+(j+1),url:x.url||'',price:num(x.price),minOrderQty:Math.max(1,num(x.minOrderQty,1)),totalShipping:num(x.totalShipping),imageUrl:x.imageUrl||'',preferred:!!x.preferred}));if(p.suppliers.length&&!p.suppliers.some(x=>x.preferred))p.suppliers[0].preferred=true;p.imageUrl=p.imageUrl||'';p.imageData=p.imageData||''});s.batches.forEach(b=>{if(!b.key)b.key=b.id||crypto.randomUUID();let n=parseIdNumber(b.bid,'BID');if(!n){n=++maxB;b.bid=displayId('BID',n)}else maxB=Math.max(maxB,n);b.items=Array.isArray(b.items)?b.items:[]});s.counters={product:maxP,batch:maxB}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll()}
function statusLabel(s){return ({idea:'Idee',research:'Recherche',prototype:'Prototyp',ready:'Verkaufsbereit'})[s]||'Idee'}

let state=loadState();
