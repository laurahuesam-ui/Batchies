const PRODUCT_COLORS=[
  {name:'Weiß',hex:'#ffffff',base:'Weiß'},
  {name:'Creme',hex:'#f3ead3',base:'Weiß'},
  {name:'Schwarz',hex:'#111111',base:'Schwarz'},
  {name:'Grau',hex:'#8a8f93',base:'Grau'},
  {name:'Silber',hex:'#c0c0c0',base:'Grau'},
  {name:'Gold',hex:'#d4af37',base:'Gold'},
  {name:'Beige',hex:'#d8c7a6',base:'Beige'},
  {name:'Braun',hex:'#7a4b2b',base:'Braun'},
  {name:'Dunkelbraun',hex:'#4b2b1a',base:'Braun'},
  {name:'Khaki',hex:'#8b8b55',base:'Grün'},
  {name:'Olivgrün',hex:'#7b7a3d',base:'Grün'},
  {name:'Rot',hex:'#d64545',base:'Rot'},
  {name:'Koralle',hex:'#f26f63',base:'Rot'},
  {name:'Rosa',hex:'#f2a7b8',base:'Rosa'},
  {name:'Altrosa',hex:'#c98696',base:'Rosa'},
  {name:'Pink',hex:'#e83e8c',base:'Rosa'},
  {name:'Magenta',hex:'#c82f7a',base:'Rosa'},
  {name:'Bordeaux',hex:'#7b1f3a',base:'Rot'},
  {name:'Orange',hex:'#ef8b2c',base:'Orange'},
  {name:'Apricot',hex:'#f5b27c',base:'Orange'},
  {name:'Pfirsich',hex:'#f7a987',base:'Orange'},
  {name:'Gelb',hex:'#e5c83f',base:'Gelb'},
  {name:'Senfgelb',hex:'#c7a32b',base:'Gelb'},
  {name:'Hellgrün',hex:'#9bd38c',base:'Grün'},
  {name:'Mint',hex:'#a8dfc1',base:'Grün'},
  {name:'Grün',hex:'#4f9b5f',base:'Grün'},
  {name:'Dunkelgrün',hex:'#24513b',base:'Grün'},
  {name:'Pfaugrün',hex:'#007f73',base:'Grün'},
  {name:'Hellblau',hex:'#8fc8e8',base:'Blau'},
  {name:'Blau',hex:'#3978c5',base:'Blau'},
  {name:'Dunkelblau',hex:'#1f3f73',base:'Blau'},
  {name:'Türkis',hex:'#35b7b1',base:'Blau'},
  {name:'Petrol',hex:'#0b6b73',base:'Blau'},
  {name:'Flieder',hex:'#c2a2da',base:'Lila'},
  {name:'Lavendel',hex:'#aa8bd2',base:'Lila'},
  {name:'Lila',hex:'#9b6bc3',base:'Lila'},
  {name:'Violett',hex:'#6f42a6',base:'Lila'},
  {name:'Bunt',hex:'conic-gradient(#d64545,#ef8b2c,#e5c83f,#4f9b5f,#3978c5,#9b6bc3,#d64545)',base:'Bunt'}
];
const PRODUCT_COLOR_MAP=Object.fromEntries(PRODUCT_COLORS.map(c=>[c.name,c]));
const PRODUCT_COLOR_BASE_MAP=Object.freeze(Object.fromEntries(PRODUCT_COLORS.map(c=>[c.name,c.base])));
const PRODUCT_BASE_COLORS=Object.freeze([...new Set(PRODUCT_COLORS.map(c=>c.base))]);

function normalizeProductColors(colors){
  if(!Array.isArray(colors))return [];
  const valid=new Set(PRODUCT_COLORS.map(c=>c.name));
  return [...new Set(colors.map(c=>typeof c==='string'?c:c?.name).filter(c=>valid.has(c)))];
}
function deriveBaseColors(colors){
  return [...new Set(normalizeProductColors(colors).map(name=>PRODUCT_COLOR_BASE_MAP[name]).filter(Boolean))];
}
function normalizeBaseColors(baseColors,colors=[]){
  const derived=deriveBaseColors(colors);
  if(derived.length)return derived;
  const valid=new Set(PRODUCT_BASE_COLORS);
  return Array.isArray(baseColors)?[...new Set(baseColors.filter(c=>valid.has(c)))]:[];
}

function productColorDots(colors,compact=false){
  const list=normalizeProductColors(colors);
  if(!list.length)return '';
  return `<div class="product-color-dots${compact?' compact':''}" aria-label="Farben">${list.map(name=>{const c=PRODUCT_COLOR_MAP[name];return `<span class="product-color-dot" style="--dot:${c.hex}" title="${esc(name)}" aria-label="${esc(name)}"></span>`}).join('')}</div>`;
}
function renderColorPicker(selected=[]){
  const chosen=new Set(normalizeProductColors(selected));
  const el=$('#productColorPicker');
  if(!el)return;
  el.innerHTML=PRODUCT_COLORS.map(c=>`<button type="button" class="color-choice ${chosen.has(c.name)?'selected':''}" data-color="${esc(c.name)}" aria-pressed="${chosen.has(c.name)?'true':'false'}" title="${esc(c.name)}"><span class="color-choice-dot" style="--dot:${c.hex}"></span><span>${esc(c.name)}</span></button>`).join('');
  el.querySelectorAll('.color-choice').forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    const active=!btn.classList.contains('selected');
    btn.classList.toggle('selected',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  }));
}
function collectSelectedColors(){
  return $$('#productColorPicker .color-choice.selected').map(x=>x.dataset.color).filter(Boolean);
}
function setSelectedColors(colors=[]){renderColorPicker(colors)}
function initColorFilter(){
  const sel=$('#filterProductColor');
  if(!sel)return;
  sel.innerHTML='<option value="">Alle Farben</option>'+PRODUCT_COLORS.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
}
function rgbDistance(a,b){
  const dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];
  return dr*dr+dg*dg+db*db;
}
const COLOR_RGB=PRODUCT_COLORS.filter(c=>/^#[0-9a-f]{6}$/i.test(c.hex)).map(c=>{const h=c.hex.slice(1);return {...c,rgb:[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}});
function nearestProductColor(r,g,b){
  let best=COLOR_RGB[0],dist=Infinity;
  for(const c of COLOR_RGB){const d=rgbDistance([r,g,b],c.rgb);if(d<dist){dist=d;best=c}}
  return best.name;
}
function analyzeImageColors(img){
  const max=180,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data,counts=new Map();
  let sampled=0,nearWhite=0;
  for(let y=0;y<h;y+=2){for(let x=0;x<w;x+=2){const i=(y*w+x)*4,a=d[i+3];if(a<180)continue;const r=d[i],g=d[i+1],b=d[i+2];sampled++;if(r>242&&g>242&&b>242){nearWhite++;continue}const maxc=Math.max(r,g,b),minc=Math.min(r,g,b);if(maxc<20)counts.set('Schwarz',(counts.get('Schwarz')||0)+1);else{const name=nearestProductColor(r,g,b);counts.set(name,(counts.get(name)||0)+1)}}}
  if(sampled&&nearWhite/sampled>.28)counts.set('Weiß',Math.round(nearWhite*.34));
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  if(!ranked.length)return [];
  const top=ranked[0][1];
  const strong=ranked.filter(([,n])=>n>=Math.max(8,top*.14));
  let result=strong.slice(0,5).map(([name])=>name);
  const baseGroups=new Set(strong.slice(0,8).map(([name])=>PRODUCT_COLOR_BASE_MAP[name]).filter(x=>x&&!['Weiß','Grau','Schwarz','Beige','Braun'].includes(x)));
  if(baseGroups.size>=4)result=['Bunt',...result.filter(x=>x!=='Bunt')].slice(0,5);
  return result;
}
function loadImageForColorDetection(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    if(!String(src).startsWith('data:'))img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Bild konnte nicht geladen werden'));img.src=src;
  });
}
async function detectProductColors(){
  const btn=$('#detectColorsBtn'),status=$('#colorDetectStatus');
  const suppliers=typeof collectSuppliers==='function'?collectSuppliers():[];
  const preferred=suppliers.find(s=>s.preferred)||suppliers[0];
  const src=draftImageData||$('#productImageUrl')?.value.trim()||preferred?.imageUrl||'';
  if(!src){if(status)status.textContent='Kein Produktbild vorhanden.';return}
  if(btn)btn.disabled=true;if(status)status.textContent='Farben werden erkannt …';
  try{
    const img=await loadImageForColorDetection(src),colors=analyzeImageColors(img);
    if(!colors.length)throw new Error('Keine Farben erkannt');
    setSelectedColors(colors);
    if(status)status.textContent='Erkannt: '+colors.join(', ')+' · Auswahl kann manuell geändert werden.';
  }catch(err){
    if(status)status.textContent='Automatische Erkennung wurde vom Bildserver blockiert. Nutze ein hochgeladenes Bild oder wähle die Farben manuell.';
  }finally{if(btn)btn.disabled=false}
}
