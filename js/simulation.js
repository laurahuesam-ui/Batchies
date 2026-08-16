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



function salesSimBatchOptions(){
  return (state.batches||[])
    .slice()
    .sort((a,b)=>String(a.bid).localeCompare(String(b.bid),'de',{numeric:true}))
}
function salesSimTargetCost(b){
  try{return batchProductionPlan(b).firstOrderCost}catch(err){return 0}
}
function salesSimProfitPerSale(b){
  try{return batchCalc(b).profit}catch(err){return 0}
}
function salesSimCheapestTarget(sourceKey=null){
  const candidates=salesSimBatchOptions()
    .filter(b=>b.key!==sourceKey)
    .map(b=>({b,cost:salesSimTargetCost(b)}))
    .filter(x=>x.cost>0)
    .sort((a,b)=>a.cost-b.cost||String(a.b.bid).localeCompare(String(b.b.bid),'de',{numeric:true}));
  return candidates[0]?.b||null
}
function salesSimPopulateSelects(){
  const source=$('#salesSimSource'),target=$('#salesSimTarget');
  if(!source||!target)return;
  const batches=salesSimBatchOptions(),
    oldSource=source.value,oldTarget=target.value;
  source.innerHTML=batches.map(b=>`<option value="${esc(b.key)}">${esc(b.bid)} · ${esc(b.name)}</option>`).join('');
  target.innerHTML=batches.map(b=>`<option value="${esc(b.key)}">${esc(b.bid)} · ${esc(b.name)}</option>`).join('');
  if(batches.some(b=>b.key===oldSource))source.value=oldSource;
  if(batches.some(b=>b.key===oldTarget))target.value=oldTarget;
  if(!source.value&&batches[0])source.value=batches[0].key;
  if(!target.value){
    const cheapest=salesSimCheapestTarget(source.value);
    if(cheapest)target.value=cheapest.key;
  }
}
function renderSalesSimulation(){
  const el=$('#salesSimulationContent'),sourceSel=$('#salesSimSource'),targetSel=$('#salesSimTarget');
  if(!el||!sourceSel||!targetSel)return;

  salesSimPopulateSelects();

  const source=state.batches.find(b=>b.key===sourceSel.value),
    target=state.batches.find(b=>b.key===targetSel.value);

  if(!source||!target){
    el.innerHTML='<div class="empty"><strong>Noch nicht genug Batches</strong>Lege mindestens zwei Batches an, um die Verkaufs-Simulation zu nutzen.</div>';
    return
  }

  const profit=salesSimProfitPerSale(source),
    targetCost=salesSimTargetCost(target);

  if(profit<=0){
    el.innerHTML=`<div class="hint"><strong>${esc(source.bid)} · ${esc(source.name)}</strong> hat aktuell keinen positiven kalkulatorischen Gewinn. Mit diesem Batch kann deshalb kein weiteres Batch nachhaltig finanziert werden.</div>`;
    return
  }
  if(targetCost<=0){
    el.innerHTML=`<div class="hint">Für <strong>${esc(target.bid)} · ${esc(target.name)}</strong> kann aktuell kein gültiger Kapitalbedarf der 1. AK berechnet werden.</div>`;
    return
  }

  const salesNeeded=Math.max(1,Math.ceil(targetCost/profit)),
    exactSales=targetCost/profit,
    accumulated=salesNeeded*profit,
    surplus=accumulated-targetCost,
    prev=Math.max(0,(salesNeeded-1)*profit),
    progressBefore=Math.min(100,prev/targetCost*100),
    cheapest=salesSimCheapestTarget(source.key),
    isCheapest=cheapest?.key===target.key,
    steps=[1,5,10,25,50,100];

  el.innerHTML=`<div class="sales-sim-kpis">
    <div class="production-kpi"><div class="label">Gewinn je Verkauf</div><div class="value">${euro(profit)}</div></div>
    <div class="production-kpi"><div class="label">1. AK Ziel-Batch</div><div class="value">${euro(targetCost)}</div></div>
    <div class="production-kpi"><div class="label">Benötigte Verkäufe</div><div class="value">${salesNeeded}</div></div>
    <div class="production-kpi"><div class="label">Gewinn dann angesammelt</div><div class="value">${euro(accumulated)}</div></div>
    <div class="production-kpi"><div class="label">Überschuss danach</div><div class="value">${euro(surplus)}</div></div>
  </div>
  <div class="info">
    Mit <strong>${esc(source.bid)} · ${esc(source.name)}</strong> brauchst du bei aktuell <strong>${euro(profit)} kalkulatorischem Gewinn pro Verkauf</strong>
    <strong>${salesNeeded} Verkäufe</strong>, um die <strong>${euro(targetCost)}</strong> der 1. AK von
    <strong>${esc(target.bid)} · ${esc(target.name)}</strong> zu finanzieren.
    ${isCheapest?'<strong>Dieses Ziel ist aktuell das günstigste weitere Batch.</strong>':cheapest?`Das günstigste weitere Ziel wäre aktuell <strong>${esc(cheapest.bid)} · ${esc(cheapest.name)}</strong> mit ${euro(salesSimTargetCost(cheapest))} 1. AK.`:''}
  </div>
  <div style="margin-top:12px">
    <div class="tiny">Nach ${Math.max(0,salesNeeded-1)} Verkäufen: ${euro(prev)} von ${euro(targetCost)} finanziert (${progressBefore.toFixed(1).replace('.',',')} %)</div>
    <div class="sales-sim-progress"><div style="width:${progressBefore}%"></div></div>
    <div class="tiny">Der nächste Verkauf überschreitet die benötigte Summe um ${euro(surplus)}.</div>
  </div>
  <div class="toolbar compact" style="margin-top:14px;margin-bottom:6px"><strong>Gewinnaufbau</strong><span class="tiny">wenn ausschließlich der kalkulatorische Gewinn reinvestiert wird</span></div>
  <div class="sales-sim-table">${steps.map(n=>`<div class="sales-sim-step"><div class="n">${n} Verkauf${n===1?'':'e'}</div><div class="v">${euro(n*profit)}</div><div class="tiny">${n*profit>=targetCost?'✓ Ziel finanziert':euro(Math.max(0,targetCost-n*profit))+' fehlen'}</div></div>`).join('')}</div>`;
}
function initSalesSimulation(){
  const source=$('#salesSimSource'),target=$('#salesSimTarget'),suggest=$('#salesSimSuggestBtn');
  if(!source||!target)return;
  salesSimPopulateSelects();
  source.onchange=()=>{
    if(source.value===target.value){
      const cheapest=salesSimCheapestTarget(source.value);
      if(cheapest)target.value=cheapest.key
    }
    renderSalesSimulation()
  };
  target.onchange=renderSalesSimulation;
  if(suggest)suggest.onclick=()=>{
    const cheapest=salesSimCheapestTarget(source.value);
    if(cheapest){target.value=cheapest.key;renderSalesSimulation()}
  };
  renderSalesSimulation()
}
