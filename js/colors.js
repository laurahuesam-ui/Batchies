const PRODUCT_COLORS=[
  {name:'Weiß',hex:'#ffffff'},
  {name:'Schwarz',hex:'#111111'},
  {name:'Grau',hex:'#8a8f93'},
  {name:'Silber',hex:'#c0c0c0'},
  {name:'Gold',hex:'#d4af37'},
  {name:'Beige',hex:'#d8c7a6'},
  {name:'Braun',hex:'#7a4b2b'},
  {name:'Khaki',hex:'#8b8b55'},
  {name:'Rot',hex:'#d64545'},
  {name:'Rosa',hex:'#f2a7b8'},
  {name:'Pink',hex:'#e83e8c'},
  {name:'Orange',hex:'#ef8b2c'},
  {name:'Gelb',hex:'#e5c83f'},
  {name:'Hellgrün',hex:'#9bd38c'},
  {name:'Grün',hex:'#4f9b5f'},
  {name:'Dunkelgrün',hex:'#24513b'},
  {name:'Hellblau',hex:'#8fc8e8'},
  {name:'Blau',hex:'#3978c5'},
  {name:'Dunkelblau',hex:'#1f3f73'},
  {name:'Türkis',hex:'#35b7b1'},
  {name:'Lila',hex:'#9b6bc3'},
  {name:'Violett',hex:'#6f42a6'}
];
const PRODUCT_COLOR_MAP=Object.fromEntries(PRODUCT_COLORS.map(c=>[c.name,c]));

function normalizeProductColors(colors){
  if(!Array.isArray(colors))return [];
  const valid=new Set(PRODUCT_COLORS.map(c=>c.name));
  return [...new Set(colors.filter(c=>valid.has(c)))];
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
const COLOR_RGB=PRODUCT_COLORS.map(c=>{const h=c.hex.slice(1);return {...c,rgb:[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}});
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
  return ranked.filter(([,n])=>n>=Math.max(8,top*.14)).slice(0,5).map(([name])=>name);
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
