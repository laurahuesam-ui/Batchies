function simulationPreferredSupplier(p){return (p?.suppliers||[]).find(s=>s.preferred)||(p?.suppliers||[])[0]||null}
function simulationPackageQty(s){return s?(s.priceType==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))):0}
function simulationBuildCart(){
  const selected=new Set(state.simulationSelectedBatches||[]),pr=new Map(),vr=new Map();state.batches.filter(b=>selected.has(b.key)).forEach(b=>{(b.items||[]).forEach(i=>pr.set(i.pid,(pr.get(i.pid)||0)+Math.max(1,num(i.qty,1))));(b.packagingItems||[]).forEach(i=>vr.set(i.vid,(vr.get(i.vid)||0)+Math.max(1,num(i.qty,1))))});
  let totalCost=0,totalUnits=0,missingSupplier=false;const stock=new Map(),lines=[];
  const add=(id,needed,x,type)=>{const s=simulationPreferredSupplier(x);if(!x||!s){missingSupplier=true;stock.set(id,0);lines.push({id,name:x?.name||(type==='VID'?'Verpackung fehlt':'Produkt fehlt'),needed,ordered:0,packs:0,cost:0,missing:true,type});return}const packQty=simulationPackageQty(s),packs=Math.max(1,Math.ceil(needed/packQty)),ordered=packQty*packs,cost=supplierOrderCost(s)*packs;stock.set(id,ordered);totalCost+=cost;totalUnits+=ordered;lines.push({id,name:x.name,needed,ordered,packs,cost,missing:false,type})};
  [...pr.entries()].sort((a,b)=>parseIdNumber(a[0],'PID')-parseIdNumber(b[0],'PID')).forEach(([id,n])=>add(id,n,state.products.find(x=>x.pid===id),'PID'));
  [...vr.entries()].sort((a,b)=>parseIdNumber(a[0],'VID')-parseIdNumber(b[0],'VID')).forEach(([id,n])=>add(id,n,state.packaging.find(x=>x.vid===id),'VID'));
  return{selected,stock,lines,totalCost,totalUnits,missingSupplier}
}
function simulationBatchGap(batch,cart){
  const pr=new Map(),vr=new Map();(batch.items||[]).forEach(i=>pr.set(i.pid,(pr.get(i.pid)||0)+Math.max(1,num(i.qty,1))));(batch.packagingItems||[]).forEach(i=>vr.set(i.vid,(vr.get(i.vid)||0)+Math.max(1,num(i.qty,1))));
  const missing=[];let extraCost=0,missingSupplier=false;
  const check=(id,need,x,type)=>{const have=cart.stock.get(id)||0;if(have>=need)return;const s=simulationPreferredSupplier(x),short=need-have;if(!x||!s){missingSupplier=true;missing.push({id,name:x?.name||(type==='VID'?'Verpackung fehlt':'Produkt fehlt'),short,orderQty:0,cost:0,missingSupplier:true,type});return}const packQty=simulationPackageQty(s),packs=Math.max(1,Math.ceil(short/packQty)),orderQty=packQty*packs,cost=supplierOrderCost(s)*packs;extraCost+=cost;missing.push({id,name:x.name,short,orderQty,cost,missingSupplier:false,type})};
  pr.forEach((n,id)=>check(id,n,state.products.find(x=>x.pid===id),'PID'));vr.forEach((n,id)=>check(id,n,state.packaging.find(x=>x.vid===id),'VID'));
  return{possible:missing.length===0,missing,extraCost,missingSupplier}
}
function renderShoppingSimulation(){
  const picker=$('#simulationBatchPicker'),summary=$('#simulationSummary'),stockEl=$('#simulationStock'),results=$('#simulationResults');if(!picker||!summary||!stockEl||!results)return;
  state.simulationSelectedBatches=Array.isArray(state.simulationSelectedBatches)?state.simulationSelectedBatches.filter(k=>state.batches.some(b=>b.key===k)):[];
  const selected=new Set(state.simulationSelectedBatches);
  picker.innerHTML=state.batches.length?state.batches.map(b=>`<label class="sim-batch-option ${selected.has(b.key)?'selected':''}"><input type="checkbox" class="simulation-batch-check" value="${esc(b.key)}" ${selected.has(b.key)?'checked':''}><div><div><span class="idchip">${esc(b.bid)}</span></div><div class="name" style="margin-top:4px">${esc(b.name)}</div><div class="tiny">1. AK einzeln: ${euro(batchProductionPlan(b).firstOrderCost)}</div></div></label>`).join(''):'<div class="muted">Noch keine Batches vorhanden.</div>';
  const cart=simulationBuildCart();
  summary.innerHTML=`<div class="sim-kpi"><div class="label">Ausgewählte Batches</div><div class="value">${cart.selected.size}</div></div><div class="sim-kpi"><div class="label">Verschiedene Positionen bestellt</div><div class="value">${cart.lines.length}</div></div><div class="sim-kpi"><div class="label">Stück insgesamt bestellt</div><div class="value">${cart.totalUnits}</div></div><div class="sim-kpi"><div class="label">Warenkorb / Investition</div><div class="value">${euro(cart.totalCost)}</div></div>`;
  stockEl.innerHTML=cart.lines.length?`<div class="table-wrap"><table class="sim-stock-table"><thead><tr><th>ID</th><th>Produkt / Verpackung</th><th>Bestellte Menge</th><th>Bestellwert</th><th>Warum bestellt?</th></tr></thead><tbody>${cart.lines.map(x=>`<tr><td><span class="idchip">${esc(x.id)}</span></td><td>${esc(x.name)}<div class="tiny">${esc(x.type)}</div></td><td>${x.missing?'–':x.ordered+' Stk.'}${x.packs>1?` <span class="tiny">(${x.packs} Bestellungen)</span>`:''}</td><td class="money">${x.missing?'–':euro(x.cost)}</td><td class="tiny">Bedarf durch Auswahl: ${x.needed} Stk.${x.missing?' · Lieferant fehlt':''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><strong>Noch kein Batch ausgewählt</strong>Wähle oben einen oder mehrere Batches aus.</div>';
  if(!state.batches.length){results.innerHTML='<div class="muted">Noch keine Batches vorhanden.</div>';return}
  const rows=state.batches.map(b=>({b,gap:simulationBatchGap(b,cart),selected:cart.selected.has(b.key)})).sort((a,b)=>Number(b.gap.possible)-Number(a.gap.possible)||a.gap.extraCost-b.gap.extraCost||a.gap.missing.length-b.gap.missing.length||parseIdNumber(a.b.bid,'BID')-parseIdNumber(b.b.bid,'BID'));
  results.innerHTML=`<div class="table-wrap"><table class="sim-result-table"><thead><tr><th>ID</th><th>Batch</th><th>Status / Fehlende Positionen</th><th>Zusätzlich nötig</th><th></th></tr></thead><tbody>${rows.map(({b,gap,selected})=>`<tr class="${gap.possible?'possible':''}"><td><span class="idchip">${esc(b.bid)}</span></td><td><div class="name">${esc(b.name)}</div>${selected?'<div class="tiny">ausgewählt</div>':''}</td><td>${gap.possible?'<span class="badge ready">✓ komplett möglich</span>':`<div><strong>${gap.missing.length} Position${gap.missing.length===1?'':'en'} fehlen</strong></div><div class="sim-missing">${gap.missing.map(m=>`<div class="missing-line"><span>${esc(m.id)} · ${esc(m.name)}</span><span>${m.missingSupplier?'kein Lieferant':euro(m.cost)}</span></div>`).join('')}</div>`}</td><td class="money ${gap.possible?'positive':''}">${gap.possible?'0,00 €':gap.missingSupplier?euro(gap.extraCost)+' + offen':euro(gap.extraCost)}</td><td>${selected?'':`<button type="button" class="btn secondary simulation-add-batch" data-key="${esc(b.key)}">+ mitbestellen</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  $$('.simulation-batch-check').forEach(c=>c.onchange=()=>{const set=new Set(state.simulationSelectedBatches||[]);c.checked?set.add(c.value):set.delete(c.value);state.simulationSelectedBatches=[...set];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation()});
  $$('.simulation-add-batch').forEach(btn=>btn.onclick=()=>{const set=new Set(state.simulationSelectedBatches||[]);set.add(btn.dataset.key);state.simulationSelectedBatches=[...set];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation()});
}



function ensureInventorySimulationState(){
  if(!state.inventorySimulation||typeof state.inventorySimulation!=='object')state.inventorySimulation={stock:{}};
  if(!state.inventorySimulation.stock||typeof state.inventorySimulation.stock!=='object')state.inventorySimulation.stock={}
}
function inventoryFirstOrderQty(kind,id){
  if(kind==='PID'){
    const x=state.products.find(p=>p.pid===id),s=(x?.suppliers||[]).find(z=>z.preferred)||(x?.suppliers||[])[0];
    return s?supplierQtyBase(s):0
  }
  const x=state.packaging.find(v=>v.vid===id),s=preferredPackagingSupplier(x);
  return s?supplierQtyBase(s):0
}
function inventoryUnit(kind,id){
  if(kind==='VID'){
    const x=state.packaging.find(v=>v.vid===id),s=preferredPackagingSupplier(x);
    return s?.priceType==='consumable'?(s.consumptionUnit||'Einheit'):'Stk.'
  }
  return 'Stk.'
}
function inventoryUsedIds(){
  const ids=new Set();
  state.batches.forEach(b=>{(b.items||[]).forEach(i=>ids.add(i.pid));(b.packagingItems||[]).forEach(i=>ids.add(i.vid))});
  return ids
}
function inventoryStockValue(id){ensureInventorySimulationState();return Math.max(0,num(state.inventorySimulation.stock[id]))}
function saveInventorySimulation(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(err){console.error('Lager-Simulation speichern:',err)}}

function renderInventoryEditor(){
  const el=$('#inventoryEditor');if(!el)return;
  ensureInventorySimulationState();
  const q=($('#inventorySearch')?.value||'').toLowerCase().trim(),only=!!$('#inventoryOnlyUsed')?.checked,used=inventoryUsedIds();
  const rows=[
    ...state.products.map(x=>({kind:'PID',id:x.pid,name:x.name})),
    ...state.packaging.map(x=>({kind:'VID',id:x.vid,name:x.name}))
  ].filter(x=>(!only||used.has(x.id))&&(!q||(x.id+' '+x.name).toLowerCase().includes(q)));

  el.className='inventory-editor';
  el.innerHTML=rows.map(x=>`<div class="inventory-row">
    <div><div class="inventory-id">${esc(x.id)}</div><div class="inventory-kind">${x.kind==='PID'?'Produkt':'Verpackung'}</div></div>
    <div>${esc(x.name)}</div>
    <div class="tiny">1. AK: ${inventoryFirstOrderQty(x.kind,x.id)} ${esc(inventoryUnit(x.kind,x.id))}</div>
    <input class="inventory-stock-input" data-id="${esc(x.id)}" type="number" min="0" step="${x.kind==='VID'&&inventoryUnit(x.kind,x.id)!=='Stk.'?'0.01':'1'}" value="${inventoryStockValue(x.id)}">
  </div>`).join('')||'<div class="empty">Keine Treffer</div>';
  $$('.inventory-stock-input').forEach(inp=>inp.oninput=()=>{state.inventorySimulation.stock[inp.dataset.id]=Math.max(0,num(inp.value));saveInventorySimulation();renderInventoryResults()})
}
function inventoryBatchCapacity(b){
  const caps=[];
  (b.items||[]).forEach(i=>{const have=inventoryStockValue(i.pid),need=Math.max(1,num(i.qty,1));caps.push({id:i.pid,have,need,capacity:Math.floor(have/need),unit:'Stk.'})});
  (b.packagingItems||[]).forEach(i=>{const have=inventoryStockValue(i.vid),need=Math.max(.001,num(i.qty,1));caps.push({id:i.vid,have,need,capacity:Math.floor(have/need),unit:inventoryUnit('VID',i.vid)})});
  const capacity=caps.length?Math.min(...caps.map(x=>x.capacity)):0,limiter=caps.filter(x=>x.capacity===capacity);
  return{capacity,caps,limiter}
}
function renderInventoryResults(){
  const el=$('#inventorySimulationContent');if(!el)return;
  ensureInventorySimulationState();
  const rows=state.batches.map(b=>({b,...inventoryBatchCapacity(b)})).sort((a,b)=>b.capacity-a.capacity||a.b.bid.localeCompare(b.b.bid,'de',{numeric:true})),
    possible=rows.filter(x=>x.capacity>0),
    maxCap=rows.length?Math.max(...rows.map(x=>x.capacity)):0,
    best=rows.filter(x=>x.capacity===maxCap&&maxCap>0).map(x=>x.b.bid).join(', ')||'–';

  el.innerHTML=`<div class="inventory-summary">
    <div class="production-kpi"><div class="label">Batches mindestens 1× möglich</div><div class="value">${possible.length} / ${rows.length}</div></div>
    <div class="production-kpi"><div class="label">Höchste Reichweite</div><div class="value">${maxCap}×</div></div>
    <div class="production-kpi"><div class="label">Beste Reichweite</div><div class="value" style="font-size:13px">${esc(best)}</div></div>
  </div>
  <div class="inventory-batch-grid">${rows.map(x=>`<div class="inventory-batch-card ${x.capacity>0?'possible':'blocked'}">
    <div class="inventory-batch-head"><strong>${esc(x.b.bid)} · ${esc(x.b.name)}</strong><span class="badge ${x.capacity>0?'ready':''}">${x.capacity}× möglich</span></div>
    <div class="tiny">Engpass: ${x.limiter.length?x.limiter.map(l=>esc(l.id)+' · '+l.have+' vorhanden / '+l.need+' benötigt').join(', '):'–'}</div>
    <details><summary>Alle Positionen</summary><div class="inventory-lines">${x.caps.map(c=>`<div><span>${esc(c.id)}</span><span>${c.have} / ${c.need} ${esc(c.unit)}</span><strong>${c.capacity}×</strong></div>`).join('')}</div></details>
  </div>`).join('')}</div>`
}
function renderInventorySimulation(){
  if(!$('#inventoryEditor'))return;
  ensureInventorySimulationState();
  renderInventoryEditor();renderInventoryResults();
  const search=$('#inventorySearch'),only=$('#inventoryOnlyUsed'),first=$('#inventoryUseFirstOrderBtn'),zero=$('#inventoryZeroBtn');
  if(search)search.oninput=renderInventoryEditor;
  if(only)only.onchange=renderInventoryEditor;
  if(first)first.onclick=()=>{
    [...state.products.map(x=>['PID',x.pid]),...state.packaging.map(x=>['VID',x.vid])].forEach(([kind,id])=>state.inventorySimulation.stock[id]=inventoryFirstOrderQty(kind,id));
    saveInventorySimulation();renderInventoryEditor();renderInventoryResults()
  };
  if(zero)zero.onclick=()=>{state.inventorySimulation.stock={};saveInventorySimulation();renderInventoryEditor();renderInventoryResults()}
}
