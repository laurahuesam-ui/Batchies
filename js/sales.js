
function ensureSalesData(){ensureRealWarehouse();if(!Array.isArray(state.salesHistory))state.salesHistory=[]}
function batchSaleVariants(b){
  return Array.isArray(b?.saleVariants)?b.saleVariants.filter(v=>v&&v.name):[]
}
function batchColorCandidates(b){return batchSaleVariants(b).map(v=>v.name)}
function selectedBatchSaleVariant(b,name){return batchSaleVariants(b).find(v=>v.name===name)||null}

function inventoryLotsForRequirement(kind,id,color){
  const lots=(state.realWarehouse||[]).filter(x=>x.kind===kind&&x.itemId===id&&num(x.qty)>0);
  if(!color)return lots;
  const exact=lots.filter(x=>x.color===color),neutral=lots.filter(x=>!x.color);
  return [...exact,...neutral]
}
function saleRequirements(b,variantName,qty){
  const variant=selectedBatchSaleVariant(b,variantName),pc=variant?.productColors||{},req=[];
  (b.items||[]).forEach(i=>req.push({kind:'PID',id:i.pid,need:Math.max(1,num(i.qty,1))*qty,color:pc[i.pid]||''}));
  (b.packagingItems||[]).forEach(i=>req.push({kind:'VID',id:i.vid,need:Math.max(.001,num(i.qty,1))*qty,color:''}));
  return req
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
  const b=state.batches.find(x=>x.key===sel.value),variants=batchSaleVariants(b);
  el.innerHTML=variants.length?variants.map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join(''):'<option value="">Keine Verkaufsvariante angelegt</option>'
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
  if(!selectedBatchSaleVariant(b,color)){if(status)status.textContent='⚠ Für dieses Batch ist keine gültige Verkaufsvariante ausgewählt.';return}
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
  return batchSaleVariants(b).map(v=>({color:v.name,capacity:stockCapacityForVariant(b,v.name)}))
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
  ensureSalesData();renderSaleBatchOptions();renderSaleAvailability();renderRealStockSalesSimulation();renderSalesHistory();if(typeof renderPurchaseCalcRows==='function'){renderPurchaseCalcRows();renderPurchaseCalc()}if(typeof renderForecastAll==='function')renderForecastAll()
}
function bindSalesUi(){
  const b=$('#saleBatchSelect');if(!b)return;
  b.onchange=()=>{const batch=state.batches.find(x=>x.key===b.value);if(batch)$('#saleActualPrice').value=num(batch.salePrice).toFixed(2);saleColorOptions();renderSaleAvailability()};
  $('#saleColorSelect').onchange=renderSaleAvailability;$('#saleQty').oninput=renderSaleAvailability;
  $('#saleBookBtn').onclick=bookRealSale;$('#saleSimulationRefreshBtn').onclick=renderRealStockSalesSimulation
}


// ===== v3.4.0: Einkaufsrechner + echte Forecast-/Reinvestitionslogik =====
function ensureSalesPlanning(){
  ensureSalesData();
  if(!state.salesPlanning||typeof state.salesPlanning!=='object')state.salesPlanning={};
  if(!Array.isArray(state.salesPlanning.purchaseRows))state.salesPlanning.purchaseRows=[];
  if(!state.salesPlanning.variantRates||typeof state.salesPlanning.variantRates!=='object')state.salesPlanning.variantRates={};
  if(!state.salesPlanning.reorderOverrides||typeof state.salesPlanning.reorderOverrides!=='object')state.salesPlanning.reorderOverrides={};
  state.salesPlanning.leadWeeks=Math.max(0,num(state.salesPlanning.leadWeeks,3));
  state.salesPlanning.safetyWeeks=Math.max(0,num(state.salesPlanning.safetyWeeks,1));
  state.salesPlanning.thresholdPct=Math.max(0,Math.min(100,num(state.salesPlanning.thresholdPct,35)));
  state.salesPlanning.horizonWeeks=Math.max(4,Math.min(260,num(state.salesPlanning.horizonWeeks,52)))
}
function persistSalesPlanning(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(err){console.error('Sales planning save',err)}}
function planningVariantKey(batchKey,variant){return batchKey+'|'+variant}
function planningStockKey(kind,id,color){return kind+'|'+id+'|'+(color||'')}
function planningPreferredSupplier(kind,id){
  if(kind==='PID'){const p=state.products.find(x=>x.pid===id);return (p?.suppliers||[]).find(x=>x.preferred)||(p?.suppliers||[])[0]}
  const v=state.packaging.find(x=>x.vid===id);return preferredPackagingSupplier(v)
}
function planningBaseOrder(kind,id){
  const s=planningPreferredSupplier(kind,id);
  if(!s)return{qty:0,cost:0};
  return{qty:Math.max(.001,supplierQtyBase(s)),cost:Math.max(0,supplierOrderCost(s))}
}
function actualWeeklyRate(batchKey,variant){
  const cutoff=Date.now()-8*7*24*3600*1000;
  const sales=(state.salesHistory||[]).filter(x=>x.batchKey===batchKey&&x.color===variant&&new Date(x.soldAt).getTime()>=cutoff);
  if(!sales.length)return 1;
  return sales.reduce((a,x)=>a+num(x.qty),0)/8
}
function planningRate(batchKey,variant){
  ensureSalesPlanning();
  const k=planningVariantKey(batchKey,variant),v=state.salesPlanning.variantRates[k];
  return v===undefined?actualWeeklyRate(batchKey,variant):Math.max(0,num(v))
}
function allConfiguredVariants(){
  const out=[];
  (state.batches||[]).forEach(b=>batchSaleVariants(b).forEach(v=>out.push({b,variant:v.name,key:planningVariantKey(b.key,v.name)})));
  return out
}
function renderForecastVariantRates(){
  const el=$('#forecastVariantRates');if(!el)return;
  ensureSalesPlanning();
  const vars=allConfiguredVariants();
  el.innerHTML=vars.length?`<div class="forecast-rate-grid">${vars.map(x=>`<div class="forecast-rate-card">
    <div><strong>${esc(x.b.bid)} · ${esc(x.variant)}</strong></div>
    <div class="rowline"><span class="tiny">Verkäufe/Woche</span><input class="forecast-rate-input" data-key="${esc(x.key)}" type="number" min="0" step="0.1" value="${planningRate(x.b.key,x.variant)}"></div>
    <div class="tiny">Ist-Schätzung letzte 8 Wochen: ${actualWeeklyRate(x.b.key,x.variant).toFixed(2).replace('.',',')} / Woche</div>
  </div>`).join('')}</div>`:'<div class="empty"><strong>Keine Verkaufsvarianten angelegt</strong></div>';
  $$('.forecast-rate-input').forEach(inp=>inp.onchange=()=>{state.salesPlanning.variantRates[inp.dataset.key]=Math.max(0,num(inp.value));persistSalesPlanning();renderForecastAll()})
}
function purchaseCalcAddRow(row=null){
  ensureSalesPlanning();
  const first=state.batches.find(b=>batchSaleVariants(b).length);
  if(!first)return;
  const variant=row?.variant||batchSaleVariants(first)[0]?.name||'';
  state.salesPlanning.purchaseRows.push({key:row?.key||crypto.randomUUID(),batchKey:row?.batchKey||first.key,variant,qty:Math.max(1,num(row?.qty,1))});
  persistSalesPlanning();renderPurchaseCalcRows();renderPurchaseCalc()
}
function purchaseCalcBatchOptions(selected){return state.batches.filter(b=>batchSaleVariants(b).length).map(b=>`<option value="${esc(b.key)}" ${b.key===selected?'selected':''}>${esc(b.bid)} · ${esc(b.name)}</option>`).join('')}
function purchaseCalcVariantOptions(batchKey,selected){const b=state.batches.find(x=>x.key===batchKey);return batchSaleVariants(b).map(v=>`<option value="${esc(v.name)}" ${v.name===selected?'selected':''}>${esc(v.name)}</option>`).join('')}
function renderPurchaseCalcRows(){
  const el=$('#purchaseCalcRows');if(!el)return;ensureSalesPlanning();
  if(!state.salesPlanning.purchaseRows.length){
    el.innerHTML='<div class="assistant-empty">Noch keine Batch-Variante ausgewählt. Füge beliebig viele Varianten hinzu.</div>';return
  }
  el.innerHTML=state.salesPlanning.purchaseRows.map((r,i)=>`<div class="purchase-calc-row" data-key="${esc(r.key)}">
    <div class="field"><label>Batch</label><select class="purchase-row-batch">${purchaseCalcBatchOptions(r.batchKey)}</select></div>
    <div class="field"><label>Farbe / Variante</label><select class="purchase-row-variant">${purchaseCalcVariantOptions(r.batchKey,r.variant)}</select></div>
    <div class="field"><label>Menge</label><input class="purchase-row-qty" type="number" min="1" step="1" value="${Math.max(1,num(r.qty,1))}"></div>
    <button class="iconbtn purchase-row-remove" type="button">✕</button>
  </div>`).join('');
  $$('.purchase-calc-row').forEach(row=>{
    const key=row.dataset.key,r=state.salesPlanning.purchaseRows.find(x=>x.key===key),bsel=row.querySelector('.purchase-row-batch'),vsel=row.querySelector('.purchase-row-variant'),q=row.querySelector('.purchase-row-qty');
    bsel.onchange=()=>{r.batchKey=bsel.value;const b=state.batches.find(x=>x.key===r.batchKey);r.variant=batchSaleVariants(b)[0]?.name||'';persistSalesPlanning();renderPurchaseCalcRows();renderPurchaseCalc()};
    vsel.onchange=()=>{r.variant=vsel.value;persistSalesPlanning();renderPurchaseCalc()};
    q.onchange=()=>{r.qty=Math.max(1,Math.floor(num(q.value,1)));persistSalesPlanning();renderPurchaseCalc()};
    row.querySelector('.purchase-row-remove').onclick=()=>{state.salesPlanning.purchaseRows=state.salesPlanning.purchaseRows.filter(x=>x.key!==key);persistSalesPlanning();renderPurchaseCalcRows();renderPurchaseCalc()}
  })
}
function aggregatePurchaseRequirements(){
  ensureSalesPlanning();const map=new Map();
  state.salesPlanning.purchaseRows.forEach(r=>{
    const b=state.batches.find(x=>x.key===r.batchKey);if(!b||!selectedBatchSaleVariant(b,r.variant))return;
    saleRequirements(b,r.variant,Math.max(1,num(r.qty,1))).forEach(req=>{
      const k=planningStockKey(req.kind,req.id,req.color);
      if(!map.has(k))map.set(k,{...req,need:0});
      map.get(k).need+=req.need
    })
  });
  return [...map.values()]
}
function calcPurchasePlan(useStock=true){
  const reqs=aggregatePurchaseRequirements();let total=0;
  const lines=reqs.map(r=>{
    const stock=useStock?availableForSaleRequirement(r):0,short=Math.max(0,r.need-stock),base=planningBaseOrder(r.kind,r.id);
    const packs=short>1e-9&&base.qty>0?Math.ceil(short/base.qty):0,ordered=packs*base.qty,cost=packs*base.cost,excess=Math.max(0,stock+ordered-r.need);
    total+=cost;return{...r,stock,short,baseQty:base.qty,packs,ordered,cost,excess,missingSupplier:short>0&&base.qty<=0}
  });
  return{lines,total,missing:lines.some(x=>x.missingSupplier)}
}
function renderPurchaseCalc(){
  const el=$('#purchaseCalcResult');if(!el)return;
  const useStock=$('#purchaseCalcUseStock')?.checked!==false,p=calcPurchasePlan(useStock);
  const totalNeeded=p.lines.reduce((a,x)=>a+x.need,0),covered=p.lines.filter(x=>x.short<=1e-9).length;
  el.innerHTML=`<div class="purchase-calc-summary">
    <div class="production-kpi"><div class="label">Zusätzlicher Einkauf</div><div class="value">${euro(p.total)}</div></div>
    <div class="production-kpi"><div class="label">Positionen</div><div class="value">${p.lines.length}</div></div>
    <div class="production-kpi"><div class="label">Komplett aus Lager</div><div class="value">${covered}</div></div>
    <div class="production-kpi"><div class="label">Gesamtbedarf Einheiten</div><div class="value">${totalNeeded.toLocaleString('de-DE')}</div></div>
  </div>
  <div class="purchase-lines">${p.lines.map(x=>`<div class="purchase-line">
    <span><b>${esc(x.id)}</b></span><span>${esc(warehouseItemName(x.kind,x.id))}${x.color?' · '+esc(x.color):''}</span>
    <span>Bedarf ${x.need}</span><span>Lager ${x.stock}</span><span>${x.short<=0?'✓ aus Lager':x.ordered+' bestellen'}</span><strong>${x.missingSupplier?'kein Lieferant':euro(x.cost)}</strong>
  </div>`).join('')||'<div class="empty">Keine Auswahl</div>'}</div>`
}
function weeklyRequirements(){
  const map=new Map();
  allConfiguredVariants().forEach(x=>{
    const rate=planningRate(x.b.key,x.variant);if(rate<=0)return;
    saleRequirements(x.b,x.variant,1).forEach(req=>{
      const k=planningStockKey(req.kind,req.id,req.color);
      if(!map.has(k))map.set(k,{...req,weekly:0});
      map.get(k).weekly+=req.need*rate
    })
  });
  return [...map.values()]
}
function reorderPointFor(r){
  ensureSalesPlanning();const k=planningStockKey(r.kind,r.id,r.color),override=state.salesPlanning.reorderOverrides[k];
  if(override!==undefined&&override!==''&&Number.isFinite(Number(override)))return Math.max(0,num(override));
  const weeks=state.salesPlanning.leadWeeks+state.salesPlanning.safetyWeeks,
    demandPoint=r.weekly*weeks,
    base=planningBaseOrder(r.kind,r.id).qty,
    pctPoint=Math.min(base*(state.salesPlanning.thresholdPct/100),r.weekly*8);
  return Math.max(demandPoint,pctPoint)
}
function renderForecastReorderTable(){
  const el=$('#forecastReorderTable');if(!el)return;ensureSalesPlanning();
  const rows=weeklyRequirements().map(r=>{
    const stock=availableForSaleRequirement(r),point=reorderPointFor(r),weeks=r.weekly>0?stock/r.weekly:Infinity,k=planningStockKey(r.kind,r.id,r.color);
    return{...r,stock,point,weeks,k,alert:stock<=point+1e-9}
  }).sort((a,b)=>(b.alert-a.alert)||(a.weeks-b.weeks));
  el.innerHTML=`<div class="forecast-reorder-wrap"><table class="forecast-reorder-table"><thead><tr><th>ID</th><th>Artikel</th><th>Farbe</th><th>Bestand</th><th>Verbrauch/Woche</th><th>Reicht ca.</th><th>Auto-Nachbestellpunkt</th><th>Override</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr>
    <td><span class="idchip">${esc(x.id)}</span></td><td>${esc(warehouseItemName(x.kind,x.id))}</td><td>${warehouseColorChip(x.color)}</td><td>${x.stock.toFixed(2)}</td><td>${x.weekly.toFixed(2)}</td><td>${Number.isFinite(x.weeks)?x.weeks.toFixed(1)+' Wo.':'∞'}</td><td>${x.point.toFixed(2)}</td>
    <td><input class="reorder-override" data-key="${esc(x.k)}" type="number" min="0" step="0.1" placeholder="automatisch" value="${state.salesPlanning.reorderOverrides[x.k]??''}"></td>
    <td class="forecast-alert ${x.alert?'negative':'positive'}">${x.alert?'NACHBESTELLEN':'OK'}</td>
  </tr>`).join('')}</tbody></table></div>`;
  $$('.reorder-override').forEach(inp=>inp.onchange=()=>{if(inp.value==='')delete state.salesPlanning.reorderOverrides[inp.dataset.key];else state.salesPlanning.reorderOverrides[inp.dataset.key]=Math.max(0,num(inp.value));persistSalesPlanning();renderForecastAll()})
}
function estimatedSaleCashContribution(b,variant,actualPrice=null){
  const price=actualPrice===null?num(b.salePrice):num(actualPrice),c=batchCalc({...b,salePrice:price});
  // material cash is handled via real/simulated purchases; retain platform + labor etc.
  return price-c.fees-c.laborCost-c.outboundShipping-c.adCost-c.riskCost-c.fixedAllocation
}
function actualRecoveredCash(){
  return (state.salesHistory||[]).reduce((sum,s)=>{
    const b=state.batches.find(x=>x.key===s.batchKey);if(!b)return sum;
    return sum+estimatedSaleCashContribution(b,s.color,s.actualUnitPrice)*num(s.qty,1)
  },0)
}
function reconstructedActualPurchaseCapital(){
  // Current paid inventory value + historical COGS reconstructs entered purchases consumed by booked sales.
  return warehouseTotalValue()+(state.salesHistory||[]).reduce((a,x)=>a+num(x.cogs),0)
}
function cloneForecastStock(){
  const stock={};
  (state.realWarehouse||[]).forEach(x=>{const k=planningStockKey(x.kind,x.itemId,x.color);stock[k]=(stock[k]||0)+num(x.qty)});
  return stock
}
function forecastStockAvailable(stock,kind,id,color){
  const exact=stock[planningStockKey(kind,id,color)]||0,neutral=color?(stock[planningStockKey(kind,id,'')]||0):0;
  return color?exact+neutral:exact
}
function forecastConsume(stock,r,amount){
  let left=amount;
  if(r.color){
    const ek=planningStockKey(r.kind,r.id,r.color),take=Math.min(stock[ek]||0,left);stock[ek]=(stock[ek]||0)-take;left-=take
  }
  const nk=planningStockKey(r.kind,r.id,'');
  const take=Math.min(stock[nk]||0,left);stock[nk]=(stock[nk]||0)-take;left-=take;
  return left
}
function forecastAddOrder(stock,r,qty){const k=planningStockKey(r.kind,r.id,r.color);stock[k]=(stock[k]||0)+qty}
function runRealReinvestmentForecast(){
  ensureSalesPlanning();
  let stock=cloneForecastStock(),cash=actualRecoveredCash()-reconstructedActualPurchaseCapital(),initialCash=cash,events=[],breakEvenWeek=cash>=0?0:null;
  const hasRealStock=(state.realWarehouse||[]).length>0;
  // If no actual purchase exists yet, use the current purchase-calculator plan as the virtual initial buy.
  if(!hasRealStock){
    const plan=calcPurchasePlan(false);cash-=plan.total;
    plan.lines.forEach(x=>{if(x.ordered>0)forecastAddOrder(stock,x,x.ordered)});
    if(plan.total>0)events.push({week:0,text:'Virtueller Ersteinkauf aus Einkaufsrechner',amount:-plan.total})
  }
  const horizon=Math.floor(state.salesPlanning.horizonWeeks),reqWeekly=weeklyRequirements();
  let totalForecastSales=0,totalReorders=0,reorderCost=0;
  for(let week=1;week<=horizon;week++){
    // sales are expected values; consume fractional units for forecasting.
    allConfiguredVariants().forEach(x=>{
      const rate=planningRate(x.b.key,x.variant);if(rate<=0)return;
      const requirements=saleRequirements(x.b,x.variant,1);
      // Only forecast sales that can be supported; reorder checks below should normally keep it possible.
      let feasible=rate;
      requirements.forEach(r=>{const av=forecastStockAvailable(stock,r.kind,r.id,r.color);feasible=Math.min(feasible,av/Math.max(.001,r.need))});
      feasible=Math.max(0,feasible);
      requirements.forEach(r=>forecastConsume(stock,r,r.need*feasible));
      cash+=estimatedSaleCashContribution(x.b,x.variant)*feasible;totalForecastSales+=feasible
    });
    // reorder based on dynamic point and enough to refill by real supplier packs.
    reqWeekly.forEach(r=>{
      const current=forecastStockAvailable(stock,r.kind,r.id,r.color),point=reorderPointFor(r);
      if(current<=point+1e-9){
        const base=planningBaseOrder(r.kind,r.id);if(base.qty<=0)return;
        // Order enough to restore at least point + one lead-time demand cycle.
        const target=point+r.weekly*Math.max(1,state.salesPlanning.leadWeeks),missing=Math.max(0,target-current),packs=Math.max(1,Math.ceil(missing/base.qty)),qty=packs*base.qty,cost=packs*base.cost;
        forecastAddOrder(stock,r,qty);cash-=cost;totalReorders+=packs;reorderCost+=cost;
        events.push({week,text:`${r.id}${r.color?' · '+r.color:''} nachbestellen · ${qty}`,amount:-cost})
      }
    });
    if(breakEvenWeek===null&&cash>=0)breakEvenWeek=week
  }
  return{cash,initialCash,breakEvenWeek,events,totalForecastSales,totalReorders,reorderCost,stock}
}
function renderRealReinvestmentForecast(){
  const el=$('#realReinvestmentForecast');if(!el)return;
  const r=runRealReinvestmentForecast(),capital=reconstructedActualPurchaseCapital(),recovered=actualRecoveredCash();
  el.innerHTML=`<div class="forecast-summary">
    <div class="production-kpi"><div class="label">Echtes investiertes Einkaufskapital</div><div class="value">${euro(capital)}</div></div>
    <div class="production-kpi"><div class="label">Durch Verkäufe zurückgeflossen</div><div class="value">${euro(recovered)}</div></div>
    <div class="production-kpi"><div class="label">Amortisation</div><div class="value">${r.breakEvenWeek===null?'>'+state.salesPlanning.horizonWeeks+' Wo.':r.breakEvenWeek===0?'bereits erreicht':'ca. '+r.breakEvenWeek+' Wo.'}</div></div>
    <div class="production-kpi"><div class="label">Prognose Verkäufe</div><div class="value">${r.totalForecastSales.toFixed(1)}</div></div>
    <div class="production-kpi"><div class="label">Prognose Nachbestellungen</div><div class="value">${euro(r.reorderCost)}</div><div class="tiny">${r.totalReorders} Bestellpakete</div></div>
  </div>
  <div class="info"><strong>Forecast-Endsaldo nach ${state.salesPlanning.horizonWeeks} Wochen:</strong> ${euro(r.cash)}. ${r.breakEvenWeek===null?'Innerhalb des gewählten Horizonts noch nicht amortisiert.':'Break-even berücksichtigt simulierte Nachbestellungen.'}</div>
  <details style="margin-top:10px"><summary>Prognostizierte Nachbestellereignisse (${r.events.length})</summary><div class="forecast-week-events">${r.events.map(e=>`<div class="forecast-event"><span>Woche ${e.week}</span><span>${esc(e.text)}</span><strong>${euro(e.amount)}</strong></div>`).join('')||'<div class="tiny">Keine Ereignisse.</div>'}</div></details>`
}
function renderForecastAll(){
  ensureSalesPlanning();
  const lead=$('#forecastLeadWeeks'),safety=$('#forecastSafetyWeeks'),pct=$('#forecastThresholdPct'),hor=$('#forecastHorizonWeeks');
  if(lead)lead.value=state.salesPlanning.leadWeeks;if(safety)safety.value=state.salesPlanning.safetyWeeks;if(pct)pct.value=state.salesPlanning.thresholdPct;if(hor)hor.value=state.salesPlanning.horizonWeeks;
  renderForecastVariantRates();renderForecastReorderTable();renderRealReinvestmentForecast()
}
function bindSalesPlanningUi(){
  ensureSalesPlanning();
  const add=$('#purchaseCalcAddBtn');if(!add)return;
  add.onclick=()=>purchaseCalcAddRow();
  $('#purchaseCalcUseStock').onchange=renderPurchaseCalc;
  ['forecastLeadWeeks','forecastSafetyWeeks','forecastThresholdPct','forecastHorizonWeeks'].forEach(id=>$('#'+id).onchange=()=>{
    state.salesPlanning.leadWeeks=Math.max(0,num($('#forecastLeadWeeks').value,3));
    state.salesPlanning.safetyWeeks=Math.max(0,num($('#forecastSafetyWeeks').value,1));
    state.salesPlanning.thresholdPct=Math.max(0,Math.min(100,num($('#forecastThresholdPct').value,35)));
    state.salesPlanning.horizonWeeks=Math.max(4,Math.min(260,Math.floor(num($('#forecastHorizonWeeks').value,52))));
    persistSalesPlanning();renderForecastAll()
  });
  $('#forecastRecalcBtn').onclick=renderForecastAll;
  renderPurchaseCalcRows();renderPurchaseCalc();renderForecastAll()
}

