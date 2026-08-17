
function ensureSalesData(){ensureRealWarehouse();if(!Array.isArray(state.salesHistory))state.salesHistory=[]}
function batchColorCandidates(b){
  const colorSets=(b.items||[]).map(i=>{
    const p=state.products.find(x=>x.pid===i.pid),colors=normalizeProductColors(p?.colors);
    return colors
  }).filter(x=>x.length);
  if(!colorSets.length)return [''];
  let intersection=[...colorSets[0]];
  colorSets.slice(1).forEach(set=>intersection=intersection.filter(c=>set.includes(c)));
  if(intersection.length)return intersection;
  // If no strict common color exists, retain all stock-supported colors, validation decides feasibility.
  return [...new Set(colorSets.flat())]
}
function inventoryLotsForRequirement(kind,id,color){
  const lots=(state.realWarehouse||[]).filter(x=>x.kind===kind&&x.itemId===id&&num(x.qty)>0);
  if(!color)return lots;
  const exact=lots.filter(x=>x.color===color),neutral=lots.filter(x=>!x.color);
  return [...exact,...neutral]
}
function itemRequiresColor(kind,id,batchColor){
  if(!batchColor)return false;
  if(kind==='PID'){
    const colors=normalizeProductColors(state.products.find(x=>x.pid===id)?.colors);
    return colors.includes(batchColor)
  }
  // VID becomes color-sensitive only if actual stock has colored variants for that VID.
  return (state.realWarehouse||[]).some(x=>x.kind==='VID'&&x.itemId===id&&x.color===batchColor)
}
function saleRequirements(b,color,qty){
  const req=[];
  (b.items||[]).forEach(i=>req.push({kind:'PID',id:i.pid,need:Math.max(1,num(i.qty,1))*qty}));
  (b.packagingItems||[]).forEach(i=>req.push({kind:'VID',id:i.vid,need:Math.max(.001,num(i.qty,1))*qty}));
  return req.map(r=>({...r,color:itemRequiresColor(r.kind,r.id,color)?color:''}))
}
function availableForSaleRequirement(r){
  return inventoryLotsForRequirement(r.kind,r.id,r.color).reduce((a,x)=>a+num(x.qty),0)
}
function saleValidation(b,color,qty){
  const requirements=saleRequirements(b,color,qty).map(r=>({...r,available:availableForSaleRequirement(r)}));
  return{requirements,ok:requirements.every(r=>r.available+1e-9>=r.need)}
}
function consumeWarehouseRequirement(r){
  let remaining=r.need,cogs=0;
  const lots=inventoryLotsForRequirement(r.kind,r.id,r.color);
  for(const lot of lots){
    if(remaining<=1e-9)break;
    const before=num(lot.qty),take=Math.min(before,remaining),unit=warehouseEntryUnitCost(lot);
    lot.qty=before-take;
    // Keep actual remaining value proportional to remaining quantity.
    lot.paidTotal=Math.max(0,num(lot.paidTotal)-take*unit);
    cogs+=take*unit;remaining-=take
  }
  return{remaining,cogs}
}
function saleColorOptions(){
  const sel=$('#saleBatchSelect'),el=$('#saleColorSelect');if(!sel||!el)return;
  const b=state.batches.find(x=>x.key===sel.value);
  if(!b){el.innerHTML='<option value="">Ohne Farbe</option>';return}
  const colors=batchColorCandidates(b);
  el.innerHTML=(colors.includes('')?colors:['',...colors]).map(c=>`<option value="${esc(c)}">${esc(c||'Ohne Farbe / gemischt')}</option>`).join('')
}
function renderSaleBatchOptions(){
  const el=$('#saleBatchSelect');if(!el)return;
  const old=el.value;
  el.innerHTML=(state.batches||[]).slice().sort((a,b)=>String(a.bid).localeCompare(String(b.bid),'de',{numeric:true})).map(b=>`<option value="${esc(b.key)}">${esc(b.bid)} · ${esc(b.name)}</option>`).join('');
  if(state.batches.some(b=>b.key===old))el.value=old;
  const b=state.batches.find(x=>x.key===el.value);
  if(b&&document.activeElement!==$('#saleActualPrice'))$('#saleActualPrice').value=num(b.salePrice).toFixed(2);
  saleColorOptions()
}
function renderSaleAvailability(){
  const el=$('#saleAvailabilityPreview');if(!el)return;
  const b=state.batches.find(x=>x.key===$('#saleBatchSelect')?.value),qty=Math.max(1,Math.floor(num($('#saleQty')?.value,1))),color=$('#saleColorSelect')?.value||'';
  if(!b){el.innerHTML='';return}
  const v=saleValidation(b,color,qty);
  el.innerHTML=`<div class="${v.ok?'info':'hint'}"><strong>${v.ok?'✓ Verkauf aus Lager möglich':'⚠ Lager reicht nicht vollständig'}</strong>${color?' · Variante '+esc(color):''}</div>
  <div class="sale-preview-list">${v.requirements.map(r=>`<div class="sale-preview-line"><span><b>${esc(r.id)}</b></span><span>${esc(warehouseItemName(r.kind,r.id))}${r.color?' · '+esc(r.color):''}</span><span>${r.need} benötigt / ${r.available} vorhanden</span><strong class="${r.available+1e-9>=r.need?'positive':'negative'}">${r.available+1e-9>=r.need?'✓':'fehlt '+(r.need-r.available).toFixed(2)}</strong></div>`).join('')}</div>`
}
function bookRealSale(){
  ensureSalesData();
  const b=state.batches.find(x=>x.key===$('#saleBatchSelect')?.value),qty=Math.max(1,Math.floor(num($('#saleQty')?.value,1))),color=$('#saleColorSelect')?.value||'',price=Math.max(0,num($('#saleActualPrice')?.value));
  const status=$('#saleActionStatus');if(!b)return;
  const v=saleValidation(b,color,qty);
  if(!v.ok){if(status)status.textContent='⚠ Nicht gebucht: mindestens eine Lagerposition reicht nicht.';renderSaleAvailability();return}
  let cogs=0;
  v.requirements.forEach(r=>{cogs+=consumeWarehouseRequirement(r).cogs});
  // Delete effectively empty lots to keep real stock clean.
  state.realWarehouse=state.realWarehouse.filter(x=>num(x.qty)>1e-9);
  const revenue=price*qty;
  state.salesHistory.unshift({key:crypto.randomUUID(),batchKey:b.key,bid:b.bid,batchName:b.name,color,qty,actualUnitPrice:price,revenue,cogs,soldAt:new Date().toISOString()});
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  if(status)status.textContent=`✓ ${b.bid}${color?' · '+color:''} × ${qty} gebucht. Lager wurde aktualisiert.`;
  renderWarehouse();renderSales();renderRealStockSalesSimulation()
}
function stockCapacityForVariant(b,color){
  const one=saleRequirements(b,color,1);
  if(!one.length)return 0;
  return Math.max(0,Math.min(...one.map(r=>Math.floor(availableForSaleRequirement(r)/r.need))))
}
function realSaleVariantsForBatch(b){
  const colors=batchColorCandidates(b),variants=[];
  if(!colors.length||colors.every(c=>!c))return[{color:'',capacity:stockCapacityForVariant(b,'')}];
  colors.forEach(color=>variants.push({color,capacity:stockCapacityForVariant(b,color)}));
  return variants
}
function renderRealStockSalesSimulation(){
  const el=$('#realStockSalesSimulation');if(!el)return;
  ensureSalesData();
  const cards=[];
  (state.batches||[]).forEach(b=>realSaleVariantsForBatch(b).forEach(v=>cards.push({b,...v})));
  cards.sort((a,b)=>b.capacity-a.capacity||String(a.b.bid).localeCompare(String(b.b.bid),'de',{numeric:true}));
  el.innerHTML=`<div class="real-sales-grid">${cards.map(x=>`<div class="real-sales-card ${x.capacity?'':'blocked'}">
    <div class="variant"><div><strong>${esc(x.b.bid)} · ${esc(x.b.name)}</strong><div class="tiny">${x.color?warehouseColorChip(x.color):'Ohne feste Farbvariante'}</div></div><div class="capacity">${x.capacity}×</div></div>
    <div class="tiny" style="margin-top:6px">${x.capacity?`Mit dem jetzigen echten Lager noch ${x.capacity} vollständige Verkäufe möglich.`:'Mindestens eine benötigte PID/VID fehlt.'}</div>
  </div>`).join('')}</div>`
}
function renderSalesHistory(){
  const el=$('#salesHistoryTable');if(!el)return;
  ensureSalesData();
  if(!state.salesHistory.length){el.innerHTML='<div class="empty"><strong>Noch keine Verkäufe gebucht</strong></div>';return}
  el.innerHTML=`<div class="table-wrap"><table class="sales-history-table"><thead><tr><th>Zeit</th><th>Batch</th><th>Farbe</th><th>Menge</th><th>VK/Stk.</th><th>Umsatz</th><th>entnommener Lagerwert</th></tr></thead><tbody>${state.salesHistory.map(x=>`<tr><td>${new Date(x.soldAt).toLocaleString('de-DE')}</td><td><span class="idchip">${esc(x.bid)}</span> ${esc(x.batchName||'')}</td><td>${warehouseColorChip(x.color)}</td><td>${x.qty}</td><td class="money">${euro(x.actualUnitPrice)}</td><td class="money">${euro(x.revenue)}</td><td class="money">${euro(x.cogs)}</td></tr>`).join('')}</tbody></table></div>`
}
function renderSales(){
  if(!$('#saleBatchSelect'))return;
  ensureSalesData();renderSaleBatchOptions();renderSaleAvailability();renderRealStockSalesSimulation();renderSalesHistory()
}
function bindSalesUi(){
  const b=$('#saleBatchSelect');if(!b)return;
  b.onchange=()=>{const batch=state.batches.find(x=>x.key===b.value);if(batch)$('#saleActualPrice').value=num(batch.salePrice).toFixed(2);saleColorOptions();renderSaleAvailability()};
  $('#saleColorSelect').onchange=renderSaleAvailability;$('#saleQty').oninput=renderSaleAvailability;
  $('#saleBookBtn').onclick=bookRealSale;$('#saleSimulationRefreshBtn').onclick=renderRealStockSalesSimulation
}
