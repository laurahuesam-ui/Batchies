function simulationPreferredSupplier(p){return (p?.suppliers||[]).find(s=>s.preferred)||(p?.suppliers||[])[0]||null}
function simulationPackageQty(s){return s?(s.priceType==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))):0}
function simulationBuildCart(){
  const selected=new Set(state.simulationSelectedBatches||[]),pr=new Map(),vr=new Map();state.batches.filter(b=>selected.has(b.key)||selected.has(b.bid)).forEach(b=>{(b.items||[]).forEach(i=>pr.set(i.pid,(pr.get(i.pid)||0)+Math.max(1,num(i.qty,1))));(b.packagingItems||[]).forEach(i=>vr.set(i.vid,(vr.get(i.vid)||0)+Math.max(1,num(i.qty,1))))});
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
  picker.innerHTML=state.batches.length?state.batches.map(b=>`<label class="sim-batch-option ${selected.has(b.key)||selected.has(b.bid)?'selected':''}"><input type="checkbox" class="simulation-batch-check" value="${esc(b.key)}" ${selected.has(b.key)||selected.has(b.bid)?'checked':''}><div><div><span class="idchip">${esc(b.bid)}</span></div><div class="name" style="margin-top:4px">${esc(b.name)}</div><div class="tiny">1. AK einzeln: ${euro(batchProductionPlan(b).firstOrderCost)}</div></div></label>`).join(''):'<div class="muted">Noch keine Batches vorhanden.</div>';
  const cart=simulationBuildCart();
  summary.innerHTML=`<div class="sim-kpi"><div class="label">Ausgewählte Batches</div><div class="value">${cart.selected.size}</div></div><div class="sim-kpi"><div class="label">Verschiedene Positionen bestellt</div><div class="value">${cart.lines.length}</div></div><div class="sim-kpi"><div class="label">Stück insgesamt bestellt</div><div class="value">${cart.totalUnits}</div></div><div class="sim-kpi"><div class="label">Warenkorb / Investition</div><div class="value">${euro(cart.totalCost)}</div></div>`;
  stockEl.innerHTML=cart.lines.length?`<div class="table-wrap"><table class="sim-stock-table"><thead><tr><th>ID</th><th>Produkt / Verpackung</th><th>Bestellte Menge</th><th>Bestellwert</th><th>Warum bestellt?</th></tr></thead><tbody>${cart.lines.map(x=>`<tr><td><span class="idchip">${esc(x.id)}</span></td><td>${esc(x.name)}<div class="tiny">${esc(x.type)}</div></td><td>${x.missing?'–':x.ordered+' Stk.'}${x.packs>1?` <span class="tiny">(${x.packs} Bestellungen)</span>`:''}</td><td class="money">${x.missing?'–':euro(x.cost)}</td><td class="tiny">Bedarf durch Auswahl: ${x.needed} Stk.${x.missing?' · Lieferant fehlt':''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><strong>Noch kein Batch ausgewählt</strong>Wähle oben einen oder mehrere Batches aus.</div>';
  if(!state.batches.length){results.innerHTML='<div class="muted">Noch keine Batches vorhanden.</div>';return}
  const rows=state.batches.map(b=>({b,gap:simulationBatchGap(b,cart),selected:cart.selected.has(b.key)||selected.has(b.bid)})).sort((a,b)=>Number(b.gap.possible)-Number(a.gap.possible)||a.gap.extraCost-b.gap.extraCost||a.gap.missing.length-b.gap.missing.length||parseIdNumber(a.b.bid,'BID')-parseIdNumber(b.b.bid,'BID'));
  results.innerHTML=`<div class="table-wrap"><table class="sim-result-table"><thead><tr><th>ID</th><th>Batch</th><th>Status / Fehlende Positionen</th><th>Zusätzlich nötig</th><th></th></tr></thead><tbody>${rows.map(({b,gap,selected})=>`<tr class="${gap.possible?'possible':''}"><td><span class="idchip">${esc(b.bid)}</span></td><td><div class="name">${esc(b.name)}</div>${selected?'<div class="tiny">ausgewählt</div>':''}</td><td>${gap.possible?'<span class="badge ready">✓ komplett möglich</span>':`<div><strong>${gap.missing.length} Position${gap.missing.length===1?'':'en'} fehlen</strong></div><div class="sim-missing">${gap.missing.map(m=>`<div class="missing-line"><span>${esc(m.id)} · ${esc(m.name)}</span><span>${m.missingSupplier?'kein Lieferant':euro(m.cost)}</span></div>`).join('')}</div>`}</td><td class="money ${gap.possible?'positive':''}">${gap.possible?'0,00 €':gap.missingSupplier?euro(gap.extraCost)+' + offen':euro(gap.extraCost)}</td><td>${selected?'':`<button type="button" class="btn secondary simulation-add-batch" data-key="${esc(b.key)}">+ mitbestellen</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  $$('.simulation-batch-check').forEach(c=>c.onchange=()=>{const set=new Set(state.simulationSelectedBatches||[]);c.checked?set.add(c.value):set.delete(c.value);state.simulationSelectedBatches=[...set];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation();if(typeof renderInventoryEditor==='function'){renderInventoryEditor();renderInventoryResults()}});
  $$('.simulation-add-batch').forEach(btn=>btn.onclick=()=>{const set=new Set(state.simulationSelectedBatches||[]);set.add(btn.dataset.key);state.simulationSelectedBatches=[...set];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation();if(typeof renderInventoryEditor==='function'){renderInventoryEditor();renderInventoryResults()}});
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
function inventorySelectedBatchIds(){
  const selectedIds=new Set(state.simulationSelectedBatches||[]);
  return state.batches.filter(b=>selectedIds.has(b.key)||selectedIds.has(b.bid))
}
function inventoryUsedIds(){
  const ids=new Set();
  inventorySelectedBatchIds().forEach(b=>{
    (b.items||[]).forEach(i=>{if(i.pid)ids.add(i.pid)});
    (b.packagingItems||[]).forEach(i=>{if(i.vid)ids.add(i.vid)})
  });
  return ids
}
function inventoryStockValue(id){ensureInventorySimulationState();return Math.max(0,num(state.inventorySimulation.stock[id]))}
function inventoryUnitLandedCost(kind,id){
  if(kind==='PID'){
    const x=state.products.find(p=>p.pid===id),
      s=(x?.suppliers||[]).find(z=>z.preferred)||(x?.suppliers||[])[0];
    if(!s)return 0;
    const qty=supplierQtyBase(s),cost=supplierOrderCost(s);
    return qty>0?cost/qty:0
  }
  const x=state.packaging.find(v=>v.vid===id),s=preferredPackagingSupplier(x);
  if(!s)return 0;
  const qty=supplierQtyBase(s),cost=supplierOrderCost(s);
  return qty>0?cost/qty:0
}
function inventoryCurrentTotals(){
  ensureInventorySimulationState();
  let pidValue=0,vidValue=0,pidPositions=0,vidPositions=0;
  state.products.forEach(p=>{
    const qty=inventoryStockValue(p.pid);
    if(qty>0){pidPositions++;pidValue+=qty*inventoryUnitLandedCost('PID',p.pid)}
  });
  state.packaging.forEach(v=>{
    const qty=inventoryStockValue(v.vid);
    if(qty>0){vidPositions++;vidValue+=qty*inventoryUnitLandedCost('VID',v.vid)}
  });
  return{pidValue,vidValue,total:pidValue+vidValue,pidPositions,vidPositions}
}
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
  if(only&&!inventorySelectedBatchIds().length){
    el.innerHTML='<div class="empty"><strong>Keine Batches ausgewählt</strong>Wähle oben in der Einkaufssimulation zuerst mindestens einen Batch aus.</div>';
    return
  }
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
    best=rows.filter(x=>x.capacity===maxCap&&maxCap>0).map(x=>x.b.bid).join(', ')||'–',
    totals=inventoryCurrentTotals();

  el.innerHTML=`<div class="inventory-summary">
    <div class="production-kpi"><div class="label">Wert ausgewählte Produkte (PID)</div><div class="value">${euro(totals.pidValue)}</div><div class="tiny">${totals.pidPositions} Positionen</div></div>
    <div class="production-kpi"><div class="label">Wert ausgewählte Verpackung (VID)</div><div class="value">${euro(totals.vidValue)}</div><div class="tiny">${totals.vidPositions} Positionen</div></div>
    <div class="production-kpi"><div class="label">Summe Lager / 1. AK</div><div class="value">${euro(totals.total)}</div></div>
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

function applyInventoryFirstOrder(){
  ensureInventorySimulationState();
  let changed=0;
  state.products.forEach(x=>{
    const qty=inventoryFirstOrderQty('PID',x.pid);
    state.inventorySimulation.stock[x.pid]=qty;
    if(qty>0)changed++
  });
  state.packaging.forEach(x=>{
    const qty=inventoryFirstOrderQty('VID',x.vid);
    state.inventorySimulation.stock[x.vid]=qty;
    if(qty>0)changed++
  });
  saveInventorySimulation();
  renderInventoryEditor();
  renderInventoryResults();
  const status=$('#inventoryActionStatus');
  if(status)status.textContent='✓ 1. AK übernommen ('+changed+' Positionen)';
}

function applyInventoryFromSelectedShoppingSimulation(){
  ensureInventorySimulationState();

  const selectedIds=new Set(state.simulationSelectedBatches||[]);
  const selected=state.batches.filter(b=>selectedIds.has(b.key)||selectedIds.has(b.bid));

  const status=$('#inventoryActionStatus');

  if(!selected.length){
    if(status)status.textContent='⚠ Keine Batches in der Einkaufssimulation ausgewählt';
    return
  }

  const pidNeed=new Map(),vidNeed=new Map();

  selected.forEach(b=>{
    (b.items||[]).forEach(i=>{
      if(!i.pid)return;
      pidNeed.set(i.pid,(pidNeed.get(i.pid)||0)+Math.max(1,num(i.qty,1)))
    });
    (b.packagingItems||[]).forEach(i=>{
      if(!i.vid)return;
      vidNeed.set(i.vid,(vidNeed.get(i.vid)||0)+Math.max(.001,num(i.qty,1)))
    })
  });

  // Start bewusst leer: Nur Artikel der ausgewählten Batches werden übernommen.
  state.inventorySimulation.stock={};

  let positions=0;

  pidNeed.forEach((needed,id)=>{
    const p=state.products.find(x=>x.pid===id),
      s=(p?.suppliers||[]).find(x=>x.preferred)||(p?.suppliers||[])[0];
    if(!s)return;
    const base=Math.max(.001,supplierQtyBase(s)),
      packs=Math.ceil(needed/base),
      ordered=packs*base;
    state.inventorySimulation.stock[id]=ordered;
    positions++
  });

  vidNeed.forEach((needed,id)=>{
    const v=state.packaging.find(x=>x.vid===id),
      s=preferredPackagingSupplier(v);
    if(!s)return;
    const base=Math.max(.001,supplierQtyBase(s)),
      packs=Math.ceil(needed/base),
      ordered=packs*base;
    state.inventorySimulation.stock[id]=ordered;
    positions++
  });

  saveInventorySimulation();
  renderInventoryEditor();
  renderInventoryResults();

  if(status){
    status.textContent='✓ 1. AK übernommen: '+selected.map(b=>b.bid).join(', ')+' · '+positions+' Positionen'
  }
}
window.applyInventoryFromSelectedShoppingSimulation=applyInventoryFromSelectedShoppingSimulation;

function clearInventorySimulationStock(){
  ensureInventorySimulationState();
  state.inventorySimulation.stock={};
  saveInventorySimulation();
  renderInventoryEditor();
  renderInventoryResults();
  const status=$('#inventoryActionStatus');
  if(status)status.textContent='✓ Bestand auf 0 gesetzt';
}
window.applyInventoryFirstOrder=applyInventoryFirstOrder;
window.clearInventorySimulationStock=clearInventorySimulationStock;

function renderInventorySimulation(){
  if(!$('#inventoryEditor'))return;
  ensureInventorySimulationState();
  renderInventoryEditor();
  renderInventoryResults();
  const search=$('#inventorySearch'),only=$('#inventoryOnlyUsed'),first=$('#inventoryUseFirstOrderBtn'),selectedFirst=$('#inventoryUseSelectedSimulationBtn'),zero=$('#inventoryZeroBtn');
  if(search)search.oninput=renderInventoryEditor;
  if(only)only.onchange=renderInventoryEditor;
  if(first)first.onclick=applyInventoryFirstOrder;
  if(selectedFirst)selectedFirst.onclick=applyInventoryFromSelectedShoppingSimulation;
  if(zero)zero.onclick=clearInventorySimulationStock;
}


function ensureSalesGrowthState(){
  if(!state.salesGrowthSimulation||typeof state.salesGrowthSimulation!=='object'){
    state.salesGrowthSimulation={sourceKey:'',stages:[]}
  }
  if(!Array.isArray(state.salesGrowthSimulation.stages))state.salesGrowthSimulation.stages=[]
}
function saveSalesGrowthState(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(err){console.error('Verkaufs-Simulation speichern:',err)}
}
function salesGrowthBatches(){
  return (state.batches||[]).slice().sort((a,b)=>String(a.bid).localeCompare(String(b.bid),'de',{numeric:true}))
}
function salesGrowthSupplier(kind,id){
  if(kind==='PID'){
    const x=state.products.find(p=>p.pid===id);
    return{x,s:(x?.suppliers||[]).find(z=>z.preferred)||(x?.suppliers||[])[0]}
  }
  const x=state.packaging.find(v=>v.vid===id);
  return{x,s:preferredPackagingSupplier(x)}
}
function salesGrowthBatchNeeds(b){
  const needs=[];
  (b.items||[]).forEach(i=>{if(i.pid)needs.push({kind:'PID',id:i.pid,qty:Math.max(1,num(i.qty,1))})});
  (b.packagingItems||[]).forEach(i=>{if(i.vid)needs.push({kind:'VID',id:i.vid,qty:Math.max(.001,num(i.qty,1))})});
  return needs
}
function salesGrowthOrderForNeed(kind,id,neededQty){
  const {x,s}=salesGrowthSupplier(kind,id);
  if(!x||!s)return{kind,id,name:x?.name||id,neededQty,baseQty:0,packs:0,orderedQty:0,cost:0,missing:true};
  const baseQty=Math.max(.001,supplierQtyBase(s)),
    packs=Math.max(1,Math.ceil(Math.max(.001,neededQty)/baseQty)),
    orderedQty=packs*baseQty,
    cost=packs*supplierOrderCost(s);
  return{kind,id,name:x.name,neededQty,baseQty,packs,orderedQty,cost,missing:false}
}
function salesGrowthInitialPurchase(b){
  const lines=salesGrowthBatchNeeds(b).map(n=>salesGrowthOrderForNeed(n.kind,n.id,n.qty));
  return{lines,total:lines.reduce((a,x)=>a+x.cost,0),missing:lines.some(x=>x.missing)}
}
function salesGrowthNonMaterialCashPerSale(b){
  const c=batchCalc(b);
  // Actual cash-flow view:
  // material is handled discretely via stock/reorders below.
  // Sale contributes revenue minus platform fees and the other per-sale costs.
  return c.revenue-c.fees-c.laborCost-c.outboundShipping-c.adCost-c.riskCost-c.fixedAllocation
}
function salesGrowthCheapestTarget(excludeKeys=new Set()){
  const candidates=salesGrowthBatches()
    .filter(b=>!excludeKeys.has(b.key))
    .map(b=>({b,p:salesGrowthInitialPurchase(b)}))
    .filter(x=>!x.p.missing&&x.p.total>0)
    .sort((a,b)=>a.p.total-b.p.total||String(a.b.bid).localeCompare(String(b.b.bid),'de',{numeric:true}));
  return candidates[0]?.b||null
}
function salesGrowthPopulateSource(){
  ensureSalesGrowthState();
  const el=$('#salesSimSource');if(!el)return;
  const batches=salesGrowthBatches(),old=state.salesGrowthSimulation.sourceKey||el.value;
  el.innerHTML=batches.map(b=>`<option value="${esc(b.key)}">${esc(b.bid)} · ${esc(b.name)}</option>`).join('');
  if(batches.some(b=>b.key===old))el.value=old;
  else if(batches[0])el.value=batches[0].key;
  state.salesGrowthSimulation.sourceKey=el.value||''
}
function salesGrowthSanitizeStages(){
  ensureSalesGrowthState();
  const source=state.salesGrowthSimulation.sourceKey;
  const valid=new Set(state.batches.map(b=>b.key));
  const seen=new Set(source?[source]:[]);
  state.salesGrowthSimulation.stages=(state.salesGrowthSimulation.stages||[]).filter(k=>{
    if(!valid.has(k)||seen.has(k))return false;
    seen.add(k);return true
  })
}
function renderSalesGrowthStages(){
  const el=$('#salesSimStages');if(!el)return;
  ensureSalesGrowthState();salesGrowthSanitizeStages();
  const batches=salesGrowthBatches(),
    usedBefore=new Set([state.salesGrowthSimulation.sourceKey]);

  if(!state.salesGrowthSimulation.stages.length){
    el.innerHTML='<div class="assistant-empty">Noch kein weiteres Ziel-Batch. Mit „+ weiteres Ziel-Batch“ kannst du die Reinvestitionskette beliebig erweitern.</div>';
    return
  }

  el.innerHTML=state.salesGrowthSimulation.stages.map((key,idx)=>{
    const options=batches.filter(b=>!usedBefore.has(b.key)||b.key===key);
    const current=state.batches.find(b=>b.key===key);
    usedBefore.add(key);
    const cost=current?salesGrowthInitialPurchase(current).total:0;
    return `<div class="sales-stage-row" data-index="${idx}">
      <div class="sales-stage-number">${idx+1}.</div>
      <div class="field" style="margin:0"><label>Ziel-Batch</label><select class="sales-stage-select">${options.map(b=>`<option value="${esc(b.key)}" ${b.key===key?'selected':''}>${esc(b.bid)} · ${esc(b.name)}</option>`).join('')}</select></div>
      <div class="sales-stage-cost"><div class="kpi-label">1. AK</div><div class="money">${euro(cost)}</div></div>
      <button type="button" class="iconbtn sales-stage-remove" title="Ziel entfernen">✕</button>
    </div>`
  }).join('');

  $$('.sales-stage-select').forEach(sel=>sel.onchange=()=>{
    const row=sel.closest('.sales-stage-row'),idx=Number(row.dataset.index);
    state.salesGrowthSimulation.stages[idx]=sel.value;
    salesGrowthSanitizeStages();saveSalesGrowthState();renderSalesGrowthStages();scheduleSalesGrowthSimulation()
  });
  $$('.sales-stage-remove').forEach(btn=>btn.onclick=()=>{
    const idx=Number(btn.closest('.sales-stage-row').dataset.index);
    state.salesGrowthSimulation.stages.splice(idx,1);
    saveSalesGrowthState();renderSalesGrowthStages();scheduleSalesGrowthSimulation()
  })
}
let salesGrowthRenderTimer=null;
function scheduleSalesGrowthSimulation(){
  const status=$('#salesSimActionStatus');
  if(status)status.textContent='Berechnung läuft …';
  if(salesGrowthRenderTimer)clearTimeout(salesGrowthRenderTimer);
  salesGrowthRenderTimer=setTimeout(()=>{
    try{
      renderSalesGrowthSimulation();
      if(status)status.textContent='✓ Berechnung aktualisiert'
    }catch(err){
      console.error('Verkaufs-Simulation berechnen:',err);
      if(status)status.textContent='⚠ Berechnung konnte nicht abgeschlossen werden'
    }
  },30)
}

function salesGrowthAddStage(useCheapest=false){
  ensureSalesGrowthState();
  salesGrowthSanitizeStages();

  const excluded=new Set([state.salesGrowthSimulation.sourceKey,...state.salesGrowthSimulation.stages]);
  const target=useCheapest
    ? salesGrowthCheapestTarget(excluded)
    : salesGrowthBatches().find(b=>!excluded.has(b.key));

  const status=$('#salesSimActionStatus');

  if(!target){
    if(status)status.textContent='⚠ Kein weiteres Batch verfügbar';
    return false
  }

  state.salesGrowthSimulation.stages.push(target.key);
  saveSalesGrowthState();

  // Wichtig: die neue Stufe sofort anzeigen, bevor die aufwendige Simulation startet.
  renderSalesGrowthStages();

  if(status){
    status.textContent=useCheapest
      ? '✓ '+target.bid+' als günstigstes Ziel hinzugefügt'
      : '✓ '+target.bid+' hinzugefügt'
  }

  scheduleSalesGrowthSimulation();
  return true
}
window.salesGrowthAddStage=salesGrowthAddStage;

function salesGrowthAddStock(stock,purchase){
  purchase.lines.forEach(x=>{
    if(x.missing)return;
    stock[x.id]=(stock[x.id]||0)+x.orderedQty
  })
}
function salesGrowthEnsureForSale(b,stock,cash,reorders,saleNumber){
  for(const need of salesGrowthBatchNeeds(b)){
    const have=Math.max(0,num(stock[need.id]));
    if(have+1e-9>=need.qty)continue;
    const short=need.qty-have,
      order=salesGrowthOrderForNeed(need.kind,need.id,short);
    if(order.missing)return{ok:false,cash};
    cash-=order.cost;
    stock[need.id]=have+order.orderedQty;
    reorders.push({saleNumber,bid:b.bid,...order})
  }
  return{ok:true,cash}
}
function salesGrowthConsumeSale(b,stock){
  salesGrowthBatchNeeds(b).forEach(n=>stock[n.id]=Math.max(0,num(stock[n.id])-n.qty))
}
function salesGrowthStagePurchaseListHtml(purchase){
  if(!purchase?.lines?.length)return'<div class="tiny">Keine Positionen.</div>';
  return `<div class="sales-purchase-list">${purchase.lines.map(x=>`<div class="sales-purchase-line">
    <span><b>${esc(x.id)}</b></span>
    <span>${esc(x.name)}</span>
    <span>${x.missing?'kein Lieferant':x.orderedQty+' bestellt'}</span>
    <strong>${x.missing?'–':euro(x.cost)}</strong>
  </div>`).join('')}</div>`
}
function renderSalesGrowthSimulation(){
  const el=$('#salesSimulationContent');if(!el)return;
  ensureSalesGrowthState();salesGrowthSanitizeStages();

  const source=state.batches.find(b=>b.key===state.salesGrowthSimulation.sourceKey);
  if(!source){
    el.innerHTML='<div class="empty"><strong>Kein Start-Batch</strong>Wähle zuerst ein Start-Batch.</div>';return
  }

  const sourcePurchase=salesGrowthInitialPurchase(source);
  if(sourcePurchase.missing||sourcePurchase.total<=0){
    el.innerHTML=`<div class="hint">Für ${esc(source.bid)} · ${esc(source.name)} fehlen Lieferantendaten für eine vollständige 1. AK.</div>`;return
  }

  const stageBatches=state.salesGrowthSimulation.stages.map(k=>state.batches.find(b=>b.key===k)).filter(Boolean),
    active=[source],stock={},counts=new Map([[source.key,0]]),reorders=[];

  // Start cash is negative initial investment; stock exists after purchase.
  let cash=-sourcePurchase.total,totalSales=0,rr=0,sourceBreakEvenAt=null;
  salesGrowthAddStock(stock,sourcePurchase);

  const stageResults=[];
  const MAX_SALES=100000;

  function oneSale(){
    if(totalSales>=MAX_SALES)return false;
    const b=active[rr%active.length];rr++;
    const ensure=salesGrowthEnsureForSale(b,stock,cash,reorders,totalSales+1);
    if(!ensure.ok)return false;
    cash=ensure.cash;
    salesGrowthConsumeSale(b,stock);
    cash+=salesGrowthNonMaterialCashPerSale(b);
    totalSales++;
    counts.set(b.key,(counts.get(b.key)||0)+1);
    if(sourceBreakEvenAt===null&&cash>=0)sourceBreakEvenAt={totalSales,counts:Object.fromEntries(counts),cash};
    return true
  }

  // First, amortize source business.
  // Keep these reorders separate so the start phase is transparent too.
  const sourceReorderStart=reorders.length;
  while(cash<0&&totalSales<MAX_SALES){
    if(!oneSale())break
  }
  const sourceReorders=reorders.slice(sourceReorderStart);

  // Then finance each target. Target 1. AK is paid from available free cash.
  for(const target of stageBatches){
    const purchase=salesGrowthInitialPurchase(target);
    const stageStartSales=totalSales,stageStartCash=cash,
      reorderStart=reorders.length;

    while(cash+1e-9<purchase.total&&totalSales<MAX_SALES){
      if(!oneSale())break
    }

    const funded=cash+1e-9>=purchase.total&&!purchase.missing;
    if(funded){
      cash-=purchase.total;
      salesGrowthAddStock(stock,purchase);
      active.push(target);
      counts.set(target.key,counts.get(target.key)||0);
      // round-robin resets naturally into enlarged active list
    }

    stageResults.push({
      target,purchase,funded,
      salesDuringStage:totalSales-stageStartSales,
      totalSales,
      cashBeforePurchase:funded?cash+purchase.total:cash,
      cashAfterPurchase:cash,
      counts:Object.fromEntries(counts),
      reorders:reorders.slice(reorderStart)
    });
    if(!funded)break
  }

  const cashPerSaleSource=salesGrowthNonMaterialCashPerSale(source);

  el.innerHTML=`<div class="sales-chain-summary">
    <div class="production-kpi"><div class="label">Start-Investition</div><div class="value">${euro(sourcePurchase.total)}</div></div>
    <div class="production-kpi"><div class="label">Start-Batch amortisiert</div><div class="value">${sourceBreakEvenAt?sourceBreakEvenAt.totalSales+' Verkäufe':'nicht erreicht'}</div></div>
    <div class="production-kpi"><div class="label">Gesamtverkäufe simuliert</div><div class="value">${totalSales}</div></div>
    <div class="production-kpi"><div class="label">Freies Geld am Ende</div><div class="value">${euro(cash)}</div></div>
    <div class="production-kpi"><div class="label">Nachbestellungen gesamt</div><div class="value">${reorders.length}</div><div class="tiny">davon ${sourceReorders.length} bis Start-Amortisation</div></div>
  </div>

  <div class="sales-chain-stage done">
    <div class="sales-chain-stage-head"><div><div class="sales-chain-stage-title">Start · ${esc(source.bid)} · ${esc(source.name)}</div><div class="tiny">1. AK und Amortisation</div></div><span class="badge ready">${sourceBreakEvenAt?'amortisiert':'offen'}</span></div>
    <div class="sales-chain-kpis">
      <div><div class="kpi-label">1. AK</div><strong>${euro(sourcePurchase.total)}</strong></div>
      <div><div class="kpi-label">Cash je Verkauf vor Material-Nachkauf</div><strong>${euro(cashPerSaleSource)}</strong></div>
      <div><div class="kpi-label">Break-even nach</div><strong>${sourceBreakEvenAt?sourceBreakEvenAt.totalSales+' Verkäufen':'–'}</strong></div>
      <div><div class="kpi-label">Verkäufe Start-Batch bis Break-even</div><strong>${sourceBreakEvenAt?(sourceBreakEvenAt.counts[source.key]||0):'–'}</strong></div>
    </div>
    <details><summary>Was wurde für die 1. AK gekauft?</summary>${salesGrowthStagePurchaseListHtml(sourcePurchase)}</details>
    <details open><summary>Nachbestellungen bis zur Amortisation (${sourceReorders.length})</summary>
      ${sourceReorders.length?`<div class="sales-reorder-list">${sourceReorders.map(x=>`<div class="sales-reorder-line"><span>Verkauf ${x.saleNumber}</span><span>${esc(x.id)} · ${esc(x.name)} · ${x.orderedQty} nachbestellt</span><strong>${euro(x.cost)}</strong></div>`).join('')}</div>`:'<div class="tiny">Keine Nachbestellungen bis zur Amortisation nötig.</div>'}
    </details>
  </div>

  ${stageResults.map((r,idx)=>{
    const activeCounts=Object.entries(r.counts).map(([key,n])=>{
      const b=state.batches.find(x=>x.key===key);return b?`<span class="badge">${esc(b.bid)}: ${n}</span>`:''
    }).join('');
    return `<div class="sales-chain-stage ${r.funded?'done':''}">
      <div class="sales-chain-stage-head">
        <div><div class="sales-chain-stage-title">Stufe ${idx+1} · ${esc(r.target.bid)} · ${esc(r.target.name)}</div><div class="tiny">Finanziert durch alle bis dahin aktiven Batches</div></div>
        <span class="badge ${r.funded?'ready':''}">${r.funded?'✓ finanziert':'noch nicht finanziert'}</span>
      </div>
      <div class="sales-chain-kpis">
        <div><div class="kpi-label">1. AK Ziel</div><strong>${euro(r.purchase.total)}</strong></div>
        <div><div class="kpi-label">Zusätzliche Verkäufe bis Ziel</div><strong>${r.salesDuringStage}</strong></div>
        <div><div class="kpi-label">Gesamtverkäufe bis Ziel</div><strong>${r.totalSales}</strong></div>
        <div><div class="kpi-label">Freies Geld nach Kauf</div><strong>${euro(r.cashAfterPurchase)}</strong></div>
      </div>
      <div class="sales-active-counts">${activeCounts}</div>
      <details open><summary>Was muss für ${esc(r.target.bid)} gekauft werden?</summary>${salesGrowthStagePurchaseListHtml(r.purchase)}</details>
      <details><summary>Nachbestellungen während dieser Stufe (${r.reorders.length})</summary>
        ${r.reorders.length?`<div class="sales-reorder-list">${r.reorders.map(x=>`<div class="sales-reorder-line"><span>Verkauf ${x.saleNumber}</span><span>${esc(x.id)} · ${esc(x.name)} · ${x.orderedQty} nachbestellt</span><strong>${euro(x.cost)}</strong></div>`).join('')}</div>`:'<div class="tiny">Keine Nachbestellungen nötig.</div>'}
      </details>
    </div>`
  }).join('')}

  <div class="tiny" style="margin-top:10px">Modellannahme: Sobald mehrere Batches aktiv sind, werden sie reihum verkauft. Dadurch erhältst du eine neutrale gemeinsame Wachstumssimulation. Materialkosten werden als echte Bestellungen verbucht, nicht als geglätteter EK pro Verkauf; Arbeitszeit, Etsy-Gebühren, Werbung/Risiko, Kundenversand und Fixkosten-Umlage werden pro Verkauf berücksichtigt.</div>`
}
function initSalesSimulation(){
  const source=$('#salesSimSource'),add=$('#salesSimAddStageBtn'),suggest=$('#salesSimSuggestBtn');
  if(!source)return;
  ensureSalesGrowthState();
  salesGrowthPopulateSource();
  salesGrowthSanitizeStages();
  renderSalesGrowthStages();
  renderSalesGrowthSimulation();

  source.onchange=()=>{
    state.salesGrowthSimulation.sourceKey=source.value;
    salesGrowthSanitizeStages();
    saveSalesGrowthState();
    renderSalesGrowthStages();
    scheduleSalesGrowthSimulation()
  };
  if(add)add.onclick=()=>salesGrowthAddStage(false);
  if(suggest)suggest.onclick=()=>salesGrowthAddStage(true)
}
window.initSalesSimulation=initSalesSimulation;

