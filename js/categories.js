function categoryText(){
  const urls=$$('.supplier-url').map(e=>e.value).join(' ');
  return normalizeText($('#productName').value+' '+urls+' '+$('#productNotes').value);
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
  const text=categoryText();
  if(!text)return null;
  const tokens=text.split(/\s+/).filter(x=>x.length>=3);
  const scores={};
  for(const [cat,sub,words] of CATEGORY_RULES){
    let score=0;
    for(const w of words){
      const n=normalizeText(w);
      if(text.includes(n))score+=n.includes(' ')?4:3;
    }
    if(score)scores[cat+'|||'+sub]=(scores[cat+'|||'+sub]||0)+score;
  }
  for(const token of tokens){
    const learned=state.categoryLearning?.[token];
    if(learned){
      const k=learned.category+'|||'+learned.subcategory;
      scores[k]=(scores[k]||0)+Math.min(6,2+(learned.count||1));
    }
  }
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  if(!ranked.length)return null;
  const [k,score]=ranked[0];
  const [category,subcategory]=k.split('|||');
  const second=ranked[1]?.[1]||0;
  const confidence=Math.max(52,Math.min(97,Math.round(58+score*5+(score-second)*3)));
  return{category,subcategory,confidence};
}

function showCategorySuggestion(apply=false){
  const sug=categorySuggestion(),box=$('#categorySuggestion');
  if(!sug){
    box.classList.add('hidden');
    box.textContent='';
    return;
  }
  const canAutoApply=apply&&(!$('#productCategory').value||$('#productCategory').dataset.auto==='1');
  if(canAutoApply){
    setCategoryOptions(sug.category,sug.subcategory);
    $('#productCategory').dataset.auto='1';
    $('#productSubcategory').dataset.auto='1';
  }
  box.classList.remove('hidden');
  box.classList.toggle('low',sug.confidence<70);
  const status=canAutoApply?' · automatisch gewählt':($('#productCategory').dataset.auto==='1'?' · automatisch gewählt':' · Vorschlag');
  box.innerHTML=`Automatische Kategorie: <strong>${esc(sug.category)} → ${esc(sug.subcategory)}</strong> · <span class="confidence">${sug.confidence} %</span>${status}`;
}

function learnCategory(p){
  const text=normalizeText(p.name+' '+(p.suppliers||[]).map(s=>s.url).join(' ')+' '+(p.notes||''));
  const tokens=[...new Set(text.split(/\s+/).filter(x=>x.length>=4))].slice(0,30);
  for(const token of tokens){
    const cur=state.categoryLearning[token];
    if(cur&&cur.category===p.category&&cur.subcategory===p.subcategory)cur.count=Math.min(20,(cur.count||1)+1);
    else state.categoryLearning[token]={category:p.category,subcategory:p.subcategory,count:1};
  }
}
