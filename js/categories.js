const CATEGORY_URL_STOPWORDS=new Set(['https','http','www','com','de','german','alibaba','product','detail','wholesale','custom','logo','html','prosearch','normal','offer','image','priceid','selectedcarriercode','standard','semi','managed','spm','trafficsource']);

function meaningfulUrlText(url){
  try{
    const u=new URL(url);
    const path=decodeURIComponent(u.pathname).replace(/\.[a-z0-9]{2,5}$/i,' ');
    return normalizeText(path).split(/\s+/).filter(t=>t.length>=3&&!CATEGORY_URL_STOPWORDS.has(t)&&!/^\d+$/.test(t)&&!/[0-9]{7,}/.test(t)).join(' ');
  }catch{return ''}
}
function categorySources(){
  return{
    name:normalizeText($('#productName').value),
    notes:normalizeText($('#productNotes').value),
    urls:$$('.supplier-url').map(e=>meaningfulUrlText(e.value)).join(' ')
  };
}
function setCategoryOptions(category='',subcategory=''){
  const c=$('#productCategory'),sub=$('#productSubcategory');
  const cats=Object.keys(CATEGORY_TREE);
  c.innerHTML='<option value="">Kategorie wählen …</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+(category&&!cats.includes(category)?`<option value="${esc(category)}">${esc(category)} (bestehend)</option>`:'');
  if(category)c.value=category;
  const selected=c.value;
  const subs=CATEGORY_TREE[selected]||[];
  sub.innerHTML='<option value="">Unterkategorie wählen …</option>'+subs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+(subcategory&&!subs.includes(subcategory)?`<option value="${esc(subcategory)}">${esc(subcategory)} (bestehend)</option>`:'');
  if(subcategory)sub.value=subcategory;
}
function categorySuggestion(){
  const src=categorySources();
  if(!src.name&&!src.notes&&!src.urls)return null;
  const scores={};
  for(const [cat,sub,words] of CATEGORY_RULES){
    let score=0;
    for(const w of words){
      const n=normalizeText(w); if(!n)continue;
      if(src.name===n)score+=18;
      else if(src.name.includes(n))score+=n.includes(' ')?13:10;
      if(src.notes.includes(n))score+=n.includes(' ')?6:4;
      if(src.urls.includes(n))score+=n.includes(' ')?4:2;
    }
    if(score)scores[cat+'|||'+sub]=(scores[cat+'|||'+sub]||0)+score;
  }
  // Learning uses only meaningful words from product name, never raw supplier URLs.
  const learnedTokens=src.name.split(/\s+/).filter(x=>x.length>=3&&!/^\d+$/.test(x));
  for(const token of learnedTokens){
    const learned=state.categoryLearning?.[token];
    if(learned){
      const k=learned.category+'|||'+learned.subcategory;
      scores[k]=(scores[k]||0)+Math.min(5,1+(learned.count||1));
    }
  }
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  if(!ranked.length)return null;
  const [k,score]=ranked[0],second=ranked[1]?.[1]||0;
  const [category,subcategory]=k.split('|||');
  const confidence=Math.max(55,Math.min(99,Math.round(58+score*2.2+(score-second)*1.8)));
  return{category,subcategory,confidence};
}
function showCategorySuggestion(apply=false){
  const sug=categorySuggestion(),box=$('#categorySuggestion');
  if(!sug){box.classList.add('hidden');box.textContent='';return}
  const canAutoApply=apply&&(!$('#productCategory').value||$('#productCategory').dataset.auto==='1');
  if(canAutoApply){setCategoryOptions(sug.category,sug.subcategory);$('#productCategory').dataset.auto='1';$('#productSubcategory').dataset.auto='1'}
  box.classList.remove('hidden');box.classList.toggle('low',sug.confidence<70);
  const status=canAutoApply?' · automatisch gewählt':($('#productCategory').dataset.auto==='1'?' · automatisch gewählt':' · Vorschlag');
  box.innerHTML=`Automatische Kategorie: <strong>${esc(sug.category)} → ${esc(sug.subcategory)}</strong> · <span class="confidence">${sug.confidence} %</span>${status}`;
}
function learnCategory(p){
  // Learn only from the product name. Notes like "3D drucken?" and supplier URLs must not distort product taxonomy.
  const tokens=normalizeText(p.name).split(/\s+/).filter(x=>x.length>=3&&!/^\d+$/.test(x));
  for(const t of tokens){
    const old=state.categoryLearning[t];
    if(old&&old.category===p.category&&old.subcategory===p.subcategory)old.count=(old.count||1)+1;
    else state.categoryLearning[t]={category:p.category,subcategory:p.subcategory,count:1};
  }
}
