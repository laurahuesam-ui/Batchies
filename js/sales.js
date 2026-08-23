
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
  const variant=selectedBatchSaleVariant(b,variantName),pc=variant?.productColors||{},vc=variant?.packagingColors||{},req=[];
  (b.items||[]).forEach(i=>req.push({kind:'PID',id:i.pid,need:Math.max(1,num(i.qty,1))*qty,color:pc[i.pid]||''}));
  (b.packagingItems||[]).forEach(i=>req.push({kind:'VID',id:i.vid,need:Math.max(.001,num(i.qty,1))*qty,color:vc[i.vid]||''}));
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

function setAllRestStockBatches(open){
  $$('#realStockSalesSimulation details.real-sales-batch-group').forEach(d=>d.open=!!open)
}
function renderRealStockSalesSimulation(){
  const el=$('#realStockSalesSimulation');if(!el)return;
  ensureSalesData();

  const groups=(state.batches||[]).map(b=>{
    const variants=realSaleVariantsForBatch(b)
      .sort((a,z)=>z.capacity-a.capacity||String(a.color||'').localeCompare(String(z.color||''),'de'));
    return{
      b,variants,
      maxCapacity:variants.length?Math.max(...variants.map(v=>v.capacity)):0,
      sellable:variants.filter(v=>v.capacity>0).length
    }
  }).sort((a,z)=>z.maxCapacity-a.maxCapacity||String(a.b.bid).localeCompare(String(z.b.bid),'de',{numeric:true}));

  el.innerHTML=`<div class="real-sales-batch-list">${groups.map(g=>`
    <details class="real-sales-batch-group" data-batch-key="${esc(g.b.key)}" open>
      <summary>
        <span><strong>${esc(g.b.bid)} · ${esc(g.b.name)}</strong><span class="tiny"> · ${g.sellable}/${g.variants.length} Varianten lieferbar</span></span>
        <span class="badge ${g.maxCapacity>0?'ready':''}">max. ${g.maxCapacity}×</span>
      </summary>
      <div class="real-sales-grid compact">
        ${g.variants.map(v=>`<div class="real-sales-card ${v.capacity?'':'blocked'}">
          <div class="variant"><div><strong>${v.color?warehouseColorChip(v.color):'Ohne feste Farbvariante'}</strong></div><div class="capacity">${v.capacity}×</div></div>
          <div class="tiny" style="margin-top:6px">${v.capacity?`Mit dem jetzigen echten Lager noch ${v.capacity} vollständige Verkäufe möglich.`:'Mindestens eine benötigte PID/VID fehlt.'}</div>
        </div>`).join('')||'<div class="tiny">Keine Verkaufsvarianten angelegt.</div>'}
      </div>
    </details>`).join('')}</div>`
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
  $('#saleBookBtn').onclick=bookRealSale;$('#saleSimulationRefreshBtn').onclick=renderRealStockSalesSimulation;
  const collapse=$('#saleSimulationCollapseAllBtn'),expand=$('#saleSimulationExpandAllBtn');
  if(collapse)collapse.onclick=()=>setAllRestStockBatches(false);
  if(expand)expand.onclick=()=>setAllRestStockBatches(true)
}


// ===== v3.4.0: Einkaufsrechner + echte Forecast-/Reinvestitionslogik =====
function ensureSalesPlanning(){
  ensureSalesData();
  if(!state.salesPlanning||typeof state.salesPlanning!=='object')state.salesPlanning={};
  if(!Array.isArray(state.salesPlanning.purchaseRows))state.salesPlanning.purchaseRows=[];
  if(!state.salesPlanning.variantRates||typeof state.salesPlanning.variantRates!=='object')state.salesPlanning.variantRates={};
  if(!state.salesPlanning.reorderOverrides||typeof state.salesPlanning.reorderOverrides!=='object')state.salesPlanning.reorderOverrides={};
  state.salesPlanning.startWeeklySales=Math.max(0,num(state.salesPlanning.startWeeklySales,1.5));
  state.salesPlanning.forecastScenario=String(state.salesPlanning.forecastScenario||'realistic');
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
  return{qty:Math.max(.001,supplierCalcQty(s)),cost:Math.max(0,supplierOrderCost(s))}
}
function planningItemColors(kind,id){
  if(kind!=='PID')return [];
  return normalizeProductColors(state.products.find(x=>x.pid===id)?.colors)
}
function planningShippingForQty(s,qty){
  const q=Math.max(1,num(qty,1)),
    pts=(s?.shippingPoints||[])
      .map(x=>({
        qty:supplierRawQtyToPieces(s,Math.max(1,num(x.qty,1))),
        rawQty:Math.max(1,num(x.qty,1)),
        shipping:num(x.shipping),
        shippingWithCustoms:num(x.shippingWithCustoms)
      }))
      .filter(x=>x.qty>0)
      .sort((a,b)=>a.qty-b.qty);

  if(!pts.length)return supplierShippingForQty(s,q);

  const exact=pts.find(x=>Math.abs(x.qty-q)<1e-9);
  if(exact){
    if(exact.shippingWithCustoms>0)return{shipping:exact.shippingWithCustoms,includesCustoms:true,source:'Punkt'};
    return{shipping:exact.shipping,includesCustoms:false,source:'Punkt'}
  }

  const lower=[...pts].reverse().find(x=>x.qty<q),
    upper=pts.find(x=>x.qty>q);

  // Between two measured shipping points, interpolate instead of falling back
  // to the unrelated default shipping value.
  if(lower&&upper){
    const lowerVal=lower.shippingWithCustoms>0?lower.shippingWithCustoms:lower.shipping,
      upperVal=upper.shippingWithCustoms>0?upper.shippingWithCustoms:upper.shipping,
      t=(q-lower.qty)/(upper.qty-lower.qty),
      value=lowerVal+(upperVal-lowerVal)*t,
      includesCustoms=lower.shippingWithCustoms>0&&upper.shippingWithCustoms>0;
    return{shipping:value,includesCustoms,source:`Interpolation ${lower.qty}–${upper.qty}`}
  }

  // Outside measured range: use nearest measured point rather than silently
  // jumping back to totalShipping.
  const nearest=lower||upper;
  if(nearest){
    const value=nearest.shippingWithCustoms>0?nearest.shippingWithCustoms:nearest.shipping;
    return{shipping:value,includesCustoms:nearest.shippingWithCustoms>0,source:`nächster Versandpunkt ${nearest.qty}`}
  }

  return supplierShippingForQty(s,q)
}
function planningSupplierOrderCostForQty(s,qty){
  if(!s||qty<=0)return 0;
  const q=Math.max(1,num(qty,1)),
    ship=planningShippingForQty(s,q),
    goods=s.priceType==='set'
      ? (q/Math.max(1,num(s.setQty,1)))*num(s.setPrice)
      : s.priceType==='consumable'
        ? (q/supplierQtyBase(s))*num(s.purchasePrice)
        : supplierTierUnitPrice(s,q)*q,
    base=goods+ship.shipping,
    customs=(s.customs&&!ship.includesCustoms)?base*.12:0,
    subtotal=base+customs,
    vat=supplierVatAddon(s,subtotal),afterVat=subtotal+vat;
  return afterVat+supplierPaymentFee(s,afterVat)
}
function planningStrategicQuantities(s,requiredQty){
  const required=Math.max(1,Math.ceil(num(requiredQty,1))),
    minQty=supplierQtyBase(s),
    activeQty=Math.max(minQty,supplierCalcQty(s)),
    base=Math.max(required,activeQty),
    // "sensible" extra quantity: at most +50% or +10 pieces, whichever is larger.
    // This prevents absurd jumps such as 37 -> 5000 only for a lower unit price.
    sensibleCap=base+Math.max(10,Math.ceil(base*.50)),
    candidates=new Set([base]),
    shippingPoints=(s?.shippingPoints||[])
      .map(p=>Math.max(1,num(p.qty,1)))
      .filter(q=>q>=base)
      .sort((a,b)=>a-b);

  if(shippingPoints.length){
    // Shipping measurements are the strongest/most realistic signal.
    shippingPoints.filter(q=>q<=sensibleCap).slice(0,3).forEach(q=>candidates.add(q));

    // If no measured point falls in the sensible window, keep only the nearest
    // shipping point when it is not wildly larger (<=2x demand).
    if(candidates.size===1){
      const nearest=shippingPoints[0];
      if(nearest<=base*2)candidates.add(nearest)
    }

    // Price tiers are secondary when shipping points exist: only include a tier
    // if it lies inside the same sensible window.
    (s?.priceTiers||[]).forEach(t=>{
      const q=supplierRawQtyToPieces(s,Math.max(1,num(t.minQty,1)));
      if(q>=base&&q<=sensibleCap)candidates.add(q)
    })
  }else{
    // Without shipping points, nearby price tiers are the best available signal.
    (s?.priceTiers||[]).forEach(t=>{
      const q=supplierRawQtyToPieces(s,Math.max(1,num(t.minQty,1)));
      if(q>=base&&q<=sensibleCap)candidates.add(q)
    })
  }

  return [...candidates].sort((a,b)=>a-b)
}
function planningOrderComparison(s,requiredQty){
  if(!s)return [];

  const demand=Math.max(0,num(requiredQty)),
    rows=[],
    seen=new Set();

  function add(q,source,label=''){
    q=Math.max(.001,num(q));
    if(q<=0)return;
    const key=Math.round(q*1000000)/1000000;
    if(seen.has(key))return;
    seen.add(key);

    const shipping=typeof planningShippingForQty==='function'
      ? planningShippingForQty(s,q)
      : supplierShippingForQty(s,q),
      cost=planningSupplierOrderCostForQty(s,q),
      unit=q>0?cost/q:0,
      goods=Math.max(0,cost-shipping.shipping);

    rows.push({qty:q,goods,shipping:shipping.shipping,shippingSource:shipping.source||'',cost,unit,source,label})
  }

  if(s.priceType==='set'||s.priceType==='consumable'){
    // True packages are indivisible. Show alternatives only when there is
    // something meaningful to compare (e.g. one vs several packs or measured
    // shipping/price points).
    const pack=Math.max(.001,supplierQtyBase(s)),
      packsNeeded=Math.max(1,Math.ceil(demand/pack-1e-9)),
      required=packsNeeded*pack;
    add(required,'required','Bedarf / kleinste mögliche Bestellung');

    const rawPoints=[
      ...(s.shippingPoints||[]).map(x=>supplierRawQtyToPieces(s,Math.max(1,num(x.qty,1)))),
      ...(s.priceTiers||[]).map(x=>supplierRawQtyToPieces(s,Math.max(1,num(x.minQty,1))))
    ].filter(q=>q>required+1e-9)
     .sort((a,b)=>a-b);

    rawPoints.slice(0,3).forEach(q=>add(q,'breakpoint','Staffel-/Versandpunkt'));

    // If no explicit points exist, a second package is only useful as a
    // comparison for small package sizes; avoid clutter for huge fixed packs.
    if(rows.length===1&&pack<=25)add(required+pack,'package','2. Packung/Set');
  }else{
    const setSize=Math.max(1,supplierUnitSetSize(s)),
      moq=Math.max(setSize,supplierQtyBase(s)),
      demandRounded=supplierRawQtyToPieces(s,Math.max(1,supplierPiecesToRawQty(s,Math.max(demand,1)))),
      minimum=Math.max(moq,demandRounded),
      active=Math.max(moq,supplierCalcQty(s));

    // Always include what is actually needed/MOQ.
    add(minimum,'required','Bedarf / MOQ');

    // Active selected row is a separate planning choice and must be visible,
    // rather than silently replacing the real required quantity.
    if(active>minimum+1e-9)add(active,'active','Aktive Kalkulationsbasis');

    const sensibleCap=minimum+Math.max(10,Math.ceil(minimum*.50)),
      points=[];

    (s.shippingPoints||[]).forEach(p=>{
      const q=supplierRawQtyToPieces(s,Math.max(1,num(p.qty,1)));
      if(q>minimum+1e-9&&q<=sensibleCap)points.push({q,source:'shipping',label:'Versandpunkt'})
    });
    (s.priceTiers||[]).forEach(t=>{
      const q=supplierRawQtyToPieces(s,Math.max(1,num(t.minQty,1)));
      if(q>minimum+1e-9&&q<=sensibleCap)points.push({q,source:'tier',label:'Preisstaffel'})
    });

    points.sort((a,b)=>a.q-b.q);
    points.slice(0,4).forEach(x=>add(x.q,x.source,x.label));

    // If active quantity is far away, still show only it + actual requirement,
    // not dozens of irrelevant distant tiers.
  }

  rows.sort((a,b)=>a.qty-b.qty);
  if(rows.length<2)return [];

  // Mark the actual need and currently active planned quantity separately.
  rows.forEach(r=>{
    r.isRequired=r.source==='required';
    r.isActive=r.source==='active' || Math.abs(r.qty-supplierCalcQty(s))<1e-9
  });
  return rows
}
function planningOptimizePieceOrder(kind,id,totalShort,s){
  if(totalShort<=1e-9||!s)return{ordered:0,cost:0,moq:0,required:0,recommended:false};

  const factor=supplierUnitSetSize(s),
    moq=supplierQtyBase(s),
    activeQty=Math.max(moq,supplierCalcQty(s)),
    demandRounded=supplierRawQtyToPieces(s,Math.max(1,supplierPiecesToRawQty(s,totalShort))),
    required=Math.max(activeQty,demandRounded),
    candidates=planningStrategicQuantities(s,required).map(q=>{
      const cost=planningSupplierOrderCostForQty(s,q);
      return{qty:q,cost,unit:q>0?cost/q:Infinity,shipping:planningShippingForQty(s,q)}
    }),
    requiredQuote=candidates.find(x=>x.qty===required)||{
      qty:required,cost:planningSupplierOrderCostForQty(s,required),
      unit:planningSupplierOrderCostForQty(s,required)/required,
      shipping:planningShippingForQty(s,required)
    };

  const alternatives=candidates.filter(x=>x.qty>required).map(x=>({
    ...x,
    extraQty:x.qty-required,
    extraCash:x.cost-requiredQuote.cost,
    unitSavingPct:requiredQuote.unit>0?(1-x.unit/requiredQuote.unit)*100:0
  }));

  // Business rule:
  // 1) if more quantity is actually cheaper in TOTAL, take it.
  // 2) otherwise only recommend an alternative if total cash is <=10% higher
  //    AND landed unit cost improves by >=5%.
  // This avoids capital-heavy "bargains".
  const cheaperTotal=alternatives
    .filter(x=>x.cost<requiredQuote.cost-0.005)
    .sort((a,b)=>a.cost-b.cost||a.qty-b.qty)[0];

  const sensibleValue=alternatives
    .filter(x=>x.extraCash>=0&&x.cost<=requiredQuote.cost*1.10&&x.unitSavingPct>=5)
    .sort((a,b)=>b.unitSavingPct-a.unitSavingPct||a.extraCash-b.extraCash)[0];

  const chosen=cheaperTotal||requiredQuote,
    activeSource=supplierActiveCalcSource(s),
    demandQty=demandRounded,
    forcedByPlan=activeQty>demandQty+1e-9&&required===activeQty,
    forcedByMoq=moq>demandQty+1e-9&&required===moq;

  return{
    ordered:chosen.qty,cost:chosen.cost,moq,required,
    demandQty,activeQty,activeSource,forcedByPlan,forcedByMoq,
    requiredCost:requiredQuote.cost,requiredUnit:requiredQuote.unit,
    recommended:!!cheaperTotal,
    reason:cheaperTotal?'nahe Versandmenge ist insgesamt günstiger':forcedByPlan?'aktive Kalkulations-/Planmenge':forcedByMoq?'MOQ':'Bedarf',
    shippingSource:chosen.shipping?.source||'',
    valueOption:sensibleValue||null,
    candidates
  }
}
function planningPieceOrder(kind,id,totalShort,s){
  return planningOptimizePieceOrder(kind,id,totalShort,s)
}
function planningSetComposition(kind,id,s){
  if(!s||s.priceType!=='set')return {};
  const colors=planningItemColors(kind,id),setQty=Math.max(1,num(s.setQty,1));
  if(!colors.length)return {'':setQty};

  const custom=s.setColorDistribution&&typeof s.setColorDistribution==='object'?s.setColorDistribution:null;
  if(custom){
    const out={};colors.forEach(c=>out[c]=Math.max(0,num(custom[c])));
    if(Object.values(out).reduce((a,x)=>a+x,0)>0)return out
  }

  const each=setQty/colors.length,out={};
  colors.forEach(c=>out[c]=each);
  return out
}
function planningSetOrder(kind,id,requirements,s){
  const composition=planningSetComposition(kind,id,s),
    setQty=Math.max(1,num(s.setQty,1));
  let setsNeeded=0;

  requirements.forEach(r=>{
    if(r.short<=1e-9)return;
    const perSet=Math.max(0,num(composition[r.color||'']));
    if(perSet<=0){setsNeeded=Infinity;return}
    setsNeeded=Math.max(setsNeeded,Math.ceil(r.short/perSet-1e-9))
  });

  if(!Number.isFinite(setsNeeded))return{sets:0,ordered:0,cost:0,setQty,composition,impossible:true};
  const ordered=setsNeeded*setQty;
  return{sets:setsNeeded,ordered,cost:setsNeeded?planningSupplierOrderCostForQty(s,ordered):0,setQty,composition,impossible:false}
}

function planningOrderQuote(kind,id,requiredQty){
  const s=planningPreferredSupplier(kind,id);
  if(!s)return{minQty:0,orderedQty:0,cost:0,orderUnits:0,isDiscretePack:false,missing:true};

  const required=Math.max(0,num(requiredQty));
  const minQty=Math.max(.001,supplierQtyBase(s));

  // Stückpreis + MOQ: MOQ is only the minimum. Above it, quantity can increase by 1.
  if(s.priceType!=='set'&&s.priceType!=='consumable'){
    const orderedQty=required<=1e-9?0:Math.max(minQty,Math.ceil(required));
    if(orderedQty<=0)return{minQty,orderedQty:0,cost:0,orderUnits:0,isDiscretePack:false,missing:false};
    const ship=supplierShippingForQty(s,orderedQty),
      goods=supplierTierUnitPrice(s,orderedQty)*orderedQty,
      baseCost=goods+ship.shipping,
      customs=(supplierHasCustoms(s)&&!ship.includesCustoms)?baseCost*.12:0,
      subtotal=baseCost+customs,
      vat=supplierVatAddon(s,subtotal),afterVat=subtotal+vat;
    return{minQty,orderedQty,cost:afterVat+supplierPaymentFee(s,afterVat),orderUnits:orderedQty,isDiscretePack:false,missing:false}
  }

  // Sets / consumables remain physically indivisible packages.
  const packQty=minQty,
    packs=required<=1e-9?0:Math.max(1,Math.ceil(required/packQty)),
    orderedQty=packs*packQty,
    cost=packs*supplierOrderCost(s);
  return{minQty,orderedQty,cost,orderUnits:packs,isDiscretePack:true,missing:false}
}

function actualWeeklyRate(batchKey,variant){
  const cutoff=Date.now()-8*7*24*3600*1000;
  const sales=(state.salesHistory||[]).filter(x=>x.batchKey===batchKey&&x.color===variant&&new Date(x.soldAt).getTime()>=cutoff);
  // No booked sale means ZERO actual sales. Never invent a fallback sale here:
  // the start scenario remains active until a real sale exists in salesHistory.
  if(!sales.length)return 0;
  return sales.reduce((a,x)=>a+num(x.qty),0)/8
}
function hasAnyBookedSale(){
  return Array.isArray(state.salesHistory)&&state.salesHistory.some(x=>num(x.qty)>0&&x.soldAt)
}
function forecastScenarioTotal(){
  ensureSalesPlanning();
  const s=state.salesPlanning.forecastScenario||'realistic';
  if(s==='cautious')return .5;
  if(s==='good')return 3;
  if(s==='custom')return Math.max(0,num(state.salesPlanning.startWeeklySales,1.5));
  return 1.5
}
function forecastScenarioGrowth(){
  ensureSalesPlanning();
  const s=state.salesPlanning.forecastScenario||'realistic';
  if(s==='cautious')return {monthly:.10,cap:2.0};
  if(s==='good')return {monthly:.28,cap:8.0};
  if(s==='custom')return {monthly:.18,cap:5.0};
  return {monthly:.18,cap:5.0}
}
function bookedSalesTrend(){
  if(!hasAnyBookedSale())return null;
  const now=Date.now(),week=7*86400000,counts=[];
  for(let i=7;i>=0;i--){
    const from=now-(i+1)*week,to=now-i*week;
    counts.push((state.salesHistory||[]).filter(x=>{const t=new Date(x.soldAt).getTime();return t>=from&&t<to}).reduce((a,x)=>a+num(x.qty),0))
  }
  const recent=counts.slice(4).reduce((a,b)=>a+b,0)/4,prior=counts.slice(0,4).reduce((a,b)=>a+b,0)/4;
  const raw=prior>0?(recent-prior)/prior:(recent>0?.25:0);
  return Math.max(-.25,Math.min(.35,raw))
}
function forecastWeeklyTotalAt(week){
  ensureSalesPlanning();
  if(!forecastActiveVariants().length)return 0;
  week=Math.max(1,num(week,1));
  if(hasAnyBookedSale()){
    const base=Math.max(0,totalActualSalesLast8Weeks()),trend=bookedSalesTrend()||0;
    // Real data take over gradually; damp the measured 4-week trend to avoid explosive forecasts.
    const monthly=Math.max(-.12,Math.min(.18,trend*.5));
    return Math.max(0,base*Math.pow(1+monthly,(week-1)/4.345))
  }
  const base=forecastScenarioTotal(),g=forecastScenarioGrowth();
  // New-shop ramp: reach/reviews/social proof build over time, but growth is capped.
  return Math.min(g.cap,base*Math.pow(1+g.monthly,(week-1)/4.345))
}
function planningRateAt(batchKey,variant,week){
  // The total weekly forecast belongs to the ACTUAL assortment used by the
  // purchase/warehouse forecast, not to every variant that happens to exist.
  const active=forecastActiveVariants(),
    key=planningVariantKey(batchKey,variant),
    current=active.find(x=>x.key===key);
  if(!current)return 0;

  if(hasAnyBookedSale()){
    const actualTotal=active.reduce((sum,x)=>sum+actualWeeklyRate(x.b.key,x.variant),0);
    if(actualTotal<=0)return 0;
    return forecastWeeklyTotalAt(week)*(actualWeeklyRate(batchKey,variant)/actualTotal)
  }

  const sumWeights=active.reduce((sum,x)=>sum+forecastVariantWeight(x.b.key,x.variant),0);
  return sumWeights>0
    ? forecastWeeklyTotalAt(week)*forecastVariantWeight(batchKey,variant)/sumWeights
    : 0
}
function totalActualSalesLast8Weeks(){
  return allConfiguredVariants().reduce((a,x)=>a+actualWeeklyRate(x.b.key,x.variant),0)
}
function forecastVariantWeight(batchKey,variant){
  ensureSalesPlanning();
  const k=planningVariantKey(batchKey,variant),v=state.salesPlanning.variantRates[k];
  return v===undefined?1:Math.max(0,num(v,1))
}
function planningRate(batchKey,variant){
  ensureSalesPlanning();
  const vars=allConfiguredVariants(),actualTotal=totalActualSalesLast8Weeks();
  // Start forecast stays active until the first REAL sale is booked.
  if(hasAnyBookedSale()){
    return actualWeeklyRate(batchKey,variant)
  }
  const total=forecastScenarioTotal(),
    sumWeights=vars.reduce((a,x)=>a+forecastVariantWeight(x.b.key,x.variant),0);
  if(sumWeights<=0)return 0;
  return total*forecastVariantWeight(batchKey,variant)/sumWeights
}
function allConfiguredVariants(){
  const out=[];
  (state.batches||[]).forEach(b=>batchSaleVariants(b).forEach(v=>out.push({b,variant:v.name,key:planningVariantKey(b.key,v.name)})));
  return out
}
function forecastGrowthSummary(){
  const horizon=currentForecastWeeks(),
    hasAssortment=forecastActiveVariants().length>0,
    at=week=>hasAssortment?forecastWeeklyTotalAt(Math.max(1,week)):0,
    start=at(1),
    month3=at(13),
    month6=at(26),
    month12=at(52),
    end=at(horizon);
  let total=0;
  for(let week=1;week<=horizon;week++)total+=at(week);
  return{horizon,start,month3,month6,month12,end,total,average:horizon?total/horizon:0}
}
function forecastNumber(n,digits=2){
  return num(n).toFixed(digits).replace('.',',')
}
function renderForecastVariantRates(){
  const el=$('#forecastVariantRates');if(!el)return;
  ensureSalesPlanning();
  const vars=forecastActiveVariants(),hasSales=hasAnyBookedSale(),actualTotal=vars.reduce((sum,x)=>sum+actualWeeklyRate(x.b.key,x.variant),0),total=hasSales?actualTotal:forecastScenarioTotal(),g=forecastGrowthSummary(),period=forecastPeriodLabel();
  el.innerHTML=`<div class="info"><strong>${hasSales?'Dynamische Prognose aus gebuchten Verkäufen':'Dynamische Startprognose'}</strong><br>${hasSales?'Die letzten 8 Wochen bilden die Basis. Der jüngste 4-Wochen-Trend wird gedämpft fortgeschrieben, damit Wachstum oder Rückgang berücksichtigt wird, ohne unrealistisch zu explodieren.':'Ein neuer Shop startet bewusst niedriger. Reichweite, Bewertungen und Social Proof werden als allmählicher Wachstumseffekt modelliert. Vorsichtig, Realistisch und Gut haben unterschiedliche Wachstumskurven und Obergrenzen.'}</div>
  <div class="forecast-growth-overview">
    <div class="production-kpi"><div class="label">Start</div><div class="value">${forecastNumber(g.start)} / Woche</div></div>
    <div class="production-kpi"><div class="label">nach 3 Monaten</div><div class="value">${forecastNumber(g.month3)} / Woche</div></div>
    <div class="production-kpi"><div class="label">nach 6 Monaten</div><div class="value">${forecastNumber(g.month6)} / Woche</div></div>
    <div class="production-kpi"><div class="label">nach 12 Monaten</div><div class="value">${forecastNumber(g.month12)} / Woche</div></div>
    <div class="production-kpi"><div class="label">Ende · ${esc(period)}</div><div class="value">${forecastNumber(g.end)} / Woche</div></div>
    <div class="production-kpi"><div class="label">Ø im Zeitraum</div><div class="value">${forecastNumber(g.average)} / Woche</div></div>
    <div class="production-kpi"><div class="label">Erwartete Verkäufe gesamt</div><div class="value">${forecastNumber(g.total,1)}</div><div class="tiny">Summe der dynamischen Wochenprognosen über ${g.horizon} Wochen</div></div>
  </div>
  ${vars.length?`<div class="forecast-rate-grid">${vars.map(x=>`<div class="forecast-rate-card">
    <div><strong>${esc(x.b.bid)} · ${esc(x.variant)}</strong></div>
    <div class="rowline"><span class="tiny">Gewichtung</span><input class="forecast-rate-input" data-key="${esc(x.key)}" type="number" min="0" step="0.1" value="${forecastVariantWeight(x.b.key,x.variant)}"></div>
    <div class="tiny">Start: ${planningRateAt(x.b.key,x.variant,1).toFixed(2).replace('.',',')} / Woche · Ist letzte 8 Wochen: ${actualWeeklyRate(x.b.key,x.variant).toFixed(2).replace('.',',')}</div>
  </div>`).join('')}</div>`:'<div class="empty"><strong>Keine Varianten im Einkaufsrechner ausgewählt</strong><div class="tiny">Füge zuerst unter „Einkaufsrechner nach Batch-Varianten“ die Batches/Farben hinzu, die in der Prognose berücksichtigt werden sollen.</div></div>'}`;
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
function purchaseCalcAddAllVariants(){
  ensureSalesPlanning();
  const existing=new Set(state.salesPlanning.purchaseRows.map(r=>planningVariantKey(r.batchKey,r.variant)));
  let added=0;
  allConfiguredVariants().forEach(x=>{
    const k=planningVariantKey(x.b.key,x.variant);
    if(existing.has(k))return;
    state.salesPlanning.purchaseRows.push({key:crypto.randomUUID(),batchKey:x.b.key,variant:x.variant,qty:1});
    existing.add(k);added++
  });
  persistSalesPlanning();renderPurchaseCalcRows();renderPurchaseCalc();
  return added
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
  const reqs=aggregatePurchaseRequirements(),groups=new Map();
  reqs.forEach(r=>{
    const k=r.kind+'|'+r.id;
    if(!groups.has(k))groups.set(k,{kind:r.kind,id:r.id,requirements:[]});
    groups.get(k).requirements.push({...r})
  });

  let total=0;const groupPlans=[];
  groups.forEach(g=>{
    const s=planningPreferredSupplier(g.kind,g.id),priceType=s?.priceType||'unit';
    let neutralStock=useStock?realStockQty(g.kind,g.id,'',true):0;

    const details=[...g.requirements].sort((a,b)=>{
      if(!!a.color!==!!b.color)return a.color?-1:1;
      return String(a.color||'').localeCompare(String(b.color||''),'de')
    }).map(r=>{
      let remaining=r.need,stockUsed=0;
      if(r.color){
        const exact=useStock?realStockQty(g.kind,g.id,r.color,true):0,
          useExact=Math.min(exact,remaining);
        stockUsed+=useExact;remaining-=useExact
      }
      const useNeutral=Math.min(neutralStock,remaining);
      stockUsed+=useNeutral;neutralStock-=useNeutral;remaining-=useNeutral;
      return{...r,stock:stockUsed,short:Math.max(0,remaining)}
    });

    const totalNeed=details.reduce((a,x)=>a+x.need,0),
      totalAllocatedStock=details.reduce((a,x)=>a+x.stock,0),
      totalShort=details.reduce((a,x)=>a+x.short,0);

    let ordered=0,cost=0,moq=0,sets=0,composition=null,impossible=false;

    if(totalShort>1e-9&&s){
      if(priceType==='set'){
        const o=planningSetOrder(g.kind,g.id,details,s);
        ordered=o.ordered;cost=o.cost;sets=o.sets;composition=o.composition;impossible=o.impossible
      }else if(priceType==='consumable'){
        const pack=Math.max(.0001,supplierQtyBase(s)),packs=Math.ceil(totalShort/pack-1e-9);
        ordered=packs*pack;cost=packs*supplierOrderCost(s);moq=pack
      }else{
        const o=planningPieceOrder(g.kind,g.id,totalShort,s);
        ordered=o.ordered;cost=o.cost;moq=o.moq;
        g.orderOptimization=o
      }
      g.orderComparison=planningOrderComparison(s,totalShort)
    }

    const arrivals={};
    if(priceType==='set'&&composition){
      Object.entries(composition).forEach(([c,n])=>arrivals[c]=n*sets)
    }else{
      details.forEach(d=>{if(d.short>1e-9)arrivals[d.color||'']=(arrivals[d.color||'']||0)+d.short});
      const allocated=Object.values(arrivals).reduce((a,x)=>a+x,0);
      if(ordered>allocated)arrivals['']=(arrivals['']||0)+(ordered-allocated)
    }

    const gp={kind:g.kind,id:g.id,priceType,requirements:details,totalNeed,totalAllocatedStock,totalShort,
      ordered,cost,moq,sets,composition,arrivals,excess:Math.max(0,ordered-totalShort),
      orderOptimization:g.orderOptimization||null,
      orderComparison:g.orderComparison||[],
      missingSupplier:totalShort>1e-9&&!s,impossible};
    total+=cost;groupPlans.push(gp)
  });

  groupPlans.sort((a,b)=>{
    const ak=a.kind==='PID'?0:1,bk=b.kind==='PID'?0:1;
    if(ak!==bk)return ak-bk;
    return parseIdNumber(a.id,a.kind)-parseIdNumber(b.id,b.kind)
  });
  return{groupPlans,total,missing:groupPlans.some(g=>g.missingSupplier||g.impossible)}
}
function renderPurchaseCalc(){
  const el=$('#purchaseCalcResult');if(!el)return;
  const useStock=$('#purchaseCalcUseStock')?.checked!==false,p=calcPurchasePlan(useStock),
    totalNeeded=p.groupPlans.reduce((a,x)=>a+x.totalNeed,0),
    covered=p.groupPlans.filter(x=>x.totalShort<=1e-9).length;

  const groups=p.groupPlans.map(g=>{
    let order='✓ vollständig aus Lager';
    if(g.totalShort>1e-9){
      if(g.missingSupplier)order='kein Lieferant';
      else if(g.impossible)order='Set enthält benötigte Farbe nicht';
      else if(g.priceType==='set'){
        const comp=Object.entries(g.composition||{}).map(([c,n])=>`${c||'neutral'} ${n}/Set`).join(' · ');
        order=`${g.sets} komplettes Set${g.sets===1?'':'s'} = ${g.ordered} Stück · ${comp}`
      }else if(g.priceType==='consumable'){
        order=`${g.totalShort} fehlen · feste Packgröße ${g.moq} → ${g.ordered} bestellen`
      }else{
        const opt=g.orderOptimization;
        if(opt?.forcedByPlan){
          const src=opt.activeSource?.type==='shipping'
            ? `aktiver Versandpunkt ${opt.activeSource.qty}`
            : opt.activeSource?.type==='tier'
              ? `aktive Preisstaffel ab ${opt.activeSource.qty}`
              : `aktive Planmenge ${opt.activeQty}`;
          order=`${g.totalShort} fehlen · MOQ ${g.moq} · ${src} → ${g.ordered} Stück bestellen`
        }else if(opt?.recommended&&g.ordered>opt.required){
          order=`${g.totalShort} fehlen · MOQ ${g.moq} · ${opt.required} benötigt → ${g.ordered} Stück optimiert bestellen`
        }else if(g.totalShort<g.moq){
          order=`${g.totalShort} fehlen · MOQ ${g.moq} → ${g.ordered} Stück bestellen`
        }else{
          order=`${g.totalShort} fehlen · MOQ ${g.moq} erreicht → ${g.ordered} Stück bestellen`
        }
      }
    }
    const arrival=Object.entries(g.arrivals||{}).filter(([,n])=>n>1e-9).map(([c,n])=>`${c||'frei/neutral'} ${Number.isInteger(n)?n:n.toFixed(2)}`).join(' · ');
    const opt=g.orderOptimization,
      valueHint=opt?.valueOption
        ? `Alternative ${opt.valueOption.qty} Stk.: ${euro(opt.valueOption.cost)} gesamt · ${euro(opt.valueOption.unit)}/Stk. · ${euro(opt.valueOption.extraCash)} mehr für ${opt.valueOption.extraQty} zusätzliche Stück · ${opt.valueOption.unitSavingPct.toFixed(1).replace('.',',')} % günstiger/Stk.`
        : '';
    return `<div class="purchase-item-group">
      <div class="purchase-item-group-head">
        <div><span class="idchip">${esc(g.id)}</span> <strong>${esc(warehouseItemName(g.kind,g.id))}</strong></div>
        <div class="tiny">Gesamtbedarf ${g.totalNeed} · Lager ${g.totalAllocatedStock}</div>
        <div><strong>${order}</strong></div>
        <div class="money"><strong>${g.missingSupplier||g.impossible?'–':euro(g.cost)}</strong></div>
      </div>
      <div class="purchase-color-lines">${g.requirements.map(x=>`<div class="purchase-color-line">
        <span>${x.color?warehouseColorChip(x.color):warehouseColorChip('')}</span><span>Bedarf ${x.need}</span><span>Lager ${x.stock}</span><span>${x.short?`fehlen ${x.short}`:'✓ gedeckt'}</span>
      </div>`).join('')}</div>
      ${arrival?`<div class="tiny" style="margin-top:5px"><strong>Bestellung liefert:</strong> ${esc(arrival)}</div>`:''}
      ${opt?.forcedByPlan?`<div class="tiny"><strong>Warum mehr als Bedarf?</strong> Die aktive Kalkulationszeile dieses Lieferanten setzt die Planmenge auf ${opt.activeQty} Stück. Wenn du nur ${opt.demandQty} Stück bestellen willst, ändere bei Produkt → Lieferant die aktive Kalkulationszeile.</div>`:''}
      ${opt?.shippingSource?`<div class="tiny"><strong>Versand:</strong> ${esc(opt.shippingSource)}</div>`:''}
      ${opt?.recommended?`<div class="info" style="margin-top:5px"><strong>Optimiert:</strong> ${opt.required} Stück wären ${euro(opt.requiredCost)}, aber ${opt.ordered} Stück kosten insgesamt nur ${euro(opt.cost)}.</div>`:''}
      ${valueHint?`<div class="tiny" style="margin-top:5px"><strong>Sinnvolle Alternative:</strong> ${valueHint}</div>`:''}
      ${g.orderComparison?.length>1?`<details class="order-comparison" style="margin-top:6px" ${g.id==='PID-0003'?'open':''}>
        <summary>Sinnvolle Bestellmengen vergleichen (${g.orderComparison.length})</summary>
        <div class="table-wrap"><table class="order-comparison-table"><thead><tr><th>Menge</th><th>Grund</th><th>Ware*</th><th>Versand</th><th>Gesamt</th><th>€/Stk.</th></tr></thead><tbody>
        ${g.orderComparison.map(q=>`<tr class="${q.isRequired?'comparison-required':''}"><td><strong>${Number.isInteger(q.qty)?q.qty:q.qty.toFixed(2)}</strong>${q.isActive?' · aktiv':''}</td><td>${esc(q.label||'Alternative')}</td><td>${euro(q.goods)}</td><td>${euro(q.shipping)}<div class="tiny">${esc(q.shippingSource)}</div></td><td><strong>${euro(q.cost)}</strong></td><td>${euro(q.unit)}</td></tr>`).join('')}
        </tbody></table></div><div class="tiny">*Ware ist die Vergleichskomponente ohne den separat ausgewiesenen Versand; Gesamt berücksichtigt die vollständige aktuelle Kostenlogik.</div>
      </details>`:''}
    </div>`
  }).join('');

  el.innerHTML=`<div class="purchase-calc-summary">
    <div class="production-kpi"><div class="label">Zusätzlicher Einkauf</div><div class="value">${euro(p.total)}</div></div>
    <div class="production-kpi"><div class="label">Produkte/VIDs</div><div class="value">${p.groupPlans.length}</div></div>
    <div class="production-kpi"><div class="label">Komplett aus Lager</div><div class="value">${covered}</div></div>
    <div class="production-kpi"><div class="label">Gesamtbedarf</div><div class="value">${totalNeeded.toLocaleString('de-DE')}</div></div>
  </div><div class="purchase-group-list">${groups||'<div class="empty">Keine Auswahl</div>'}</div>`
}
function forecastActiveVariants(){
  ensureSalesPlanning();

  // SINGLE SOURCE OF TRUTH:
  // Only batch variants explicitly listed in "Einkaufsrechner nach Batch-Varianten"
  // participate in sales forecast, stock consumption, reorders, reinvestment and BE.
  // An empty purchase calculator therefore means an empty forecast assortment.
  const seen=new Set(),out=[];
  (state.salesPlanning.purchaseRows||[]).forEach(r=>{
    const k=planningVariantKey(r.batchKey,r.variant);
    if(seen.has(k))return;
    const b=state.batches.find(x=>x.key===r.batchKey);
    if(b&&selectedBatchSaleVariant(b,r.variant)){
      seen.add(k);out.push({b,variant:r.variant,key:k})
    }
  });
  return out
}
function weeklyRequirements(week=1){
  const map=new Map();
  forecastActiveVariants().forEach(x=>{
    const rate=planningRateAt(x.b.key,x.variant,week);if(rate<=0)return;
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
function allocatedForecastRows(){
  const reqs=weeklyRequirements(),
    byItem=new Map();

  reqs.forEach(r=>{
    const gk=r.kind+'|'+r.id;
    if(!byItem.has(gk))byItem.set(gk,[]);
    byItem.get(gk).push({...r})
  });

  const out=[];
  byItem.forEach(rows=>{
    const first=rows[0],
      neutralTotal=realStockQty(first.kind,first.id,'',true);
    let neutralLeft=neutralTotal;

    rows.sort((a,b)=>String(a.color||'').localeCompare(String(b.color||''),'de'));

    rows.forEach(r=>{
      let exact=r.color?realStockQty(r.kind,r.id,r.color,true):0,
        neutralUsed=0;

      // For neutral requirements, use the neutral pool directly.
      // For colored requirements, neutral stock is shared and allocated only once.
      const desiredWeeks=state.salesPlanning.leadWeeks+state.salesPlanning.safetyWeeks;
      const desiredQty=Math.max(r.weekly*desiredWeeks,0);

      if(r.color){
        const needNeutral=Math.max(0,desiredQty-exact);
        neutralUsed=Math.min(neutralLeft,needNeutral);
        neutralLeft-=neutralUsed
      }else{
        neutralUsed=neutralLeft;
        neutralLeft=0
      }

      out.push({...r,allocatedStock:exact+neutralUsed,exactStock:exact,neutralStockUsed:neutralUsed})
    })
  });
  return out
}
function renderForecastReorderTable(){
  const el=$('#forecastReorderTable');if(!el)return;ensureSalesPlanning();

  const rows=allocatedForecastRows().map(r=>{
    const stock=r.allocatedStock,
      point=reorderPointFor(r),
      weeks=r.weekly>0?stock/r.weekly:Infinity,
      k=planningStockKey(r.kind,r.id,r.color);
    return{...r,stock,point,weeks,k,alert:stock<=point+1e-9}
  }).sort((a,b)=>{
    const ak=a.kind==='PID'?0:1,bk=b.kind==='PID'?0:1;
    if(ak!==bk)return ak-bk;
    const ai=parseIdNumber(a.id,a.kind),bi=parseIdNumber(b.id,b.kind);
    if(ai!==bi)return ai-bi;
    return String(a.color||'').localeCompare(String(b.color||''),'de')
  });

  const rowHtml=x=>`<tr>
    <td><span class="idchip">${esc(x.id)}</span></td>
    <td>${esc(warehouseItemName(x.kind,x.id))}</td>
    <td>${warehouseColorChip(x.color)}</td>
    <td>${x.stock.toFixed(2)}</td>
    <td>${x.weekly.toFixed(2)}</td>
    <td>${Number.isFinite(x.weeks)?x.weeks.toFixed(1)+' Wo.':'∞'}</td>
    <td>${x.point.toFixed(2)}</td>
    <td><input class="reorder-override" data-key="${esc(x.k)}" type="number" min="0" step="0.1" placeholder="automatisch" value="${state.salesPlanning.reorderOverrides[x.k]??''}"></td>
    <td class="forecast-alert ${x.alert?'negative':'positive'}">${x.alert?'NACHBESTELLEN':'OK'}</td>
  </tr>`;

  const alerts=rows.filter(x=>x.alert),ok=rows.filter(x=>!x.alert);
  const tableHead='<thead><tr><th>ID</th><th>Artikel</th><th>Farbe</th><th>Bestand</th><th>Verbrauch/Woche</th><th>Reicht ca.</th><th>Nachbestellpunkt</th><th>Override</th><th>Status</th></tr></thead>';

  el.innerHTML=`
    <div class="forecast-status-group">
      <div class="forecast-table-title">Jetzt relevant (${alerts.length})</div>
      ${alerts.length?`<div class="forecast-reorder-wrap"><table class="forecast-reorder-table">${tableHead}<tbody>${alerts.map(rowHtml).join('')}</tbody></table></div>`:'<div class="info">Aktuell muss nichts nachbestellt werden.</div>'}
    </div>
    <details class="forecast-ok-details">
      <summary>OK-Positionen anzeigen (${ok.length})</summary>
      ${ok.length?`<div class="forecast-reorder-wrap"><table class="forecast-reorder-table">${tableHead}<tbody>${ok.map(rowHtml).join('')}</tbody></table></div>`:'<div class="tiny">Keine weiteren Positionen.</div>'}
    </details>`;

  $$('.reorder-override').forEach(inp=>inp.onchange=()=>{
    if(inp.value==='')delete state.salesPlanning.reorderOverrides[inp.dataset.key];
    else state.salesPlanning.reorderOverrides[inp.dataset.key]=Math.max(0,num(inp.value));
    persistSalesPlanning();renderForecastAll()
  })
}
function estimatedSaleCashContribution(b,variant,actualPrice=null){
  const price=actualPrice===null?num(b.salePrice):num(actualPrice),c=batchCalc({...b,salePrice:price});
  // material cash is handled via real/simulated purchases; retain platform + labor etc.
  return price-c.fees-c.laborCost-c.outboundShipping-c.adCost-c.riskCost-c.returnsCost-c.discountCost-c.postTripCost-c.fixedAllocation
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
function forecastPresetWeeks(preset){
  const now=new Date();
  if(preset==='4w')return 4;
  if(preset==='3m')return 13;
  if(preset==='6m')return 26;
  if(preset==='eoy'){
    const end=new Date(now.getFullYear(),11,31,23,59,59);
    return Math.max(1,Math.ceil((end-now)/(7*24*3600*1000)))
  }
  if(preset==='52w')return 52;
  return Math.max(1,Math.min(260,Math.floor(num(state.salesPlanning.horizonWeeks,52))))
}
function currentForecastWeeks(){
  ensureSalesPlanning();
  return forecastPresetWeeks(state.salesPlanning.horizonPreset||'52w')
}
function forecastPeriodLabel(){
  const p=state.salesPlanning.horizonPreset||'52w';
  if(p==='4w')return '4 Wochen';
  if(p==='3m')return '3 Monate';
  if(p==='6m')return '6 Monate';
  if(p==='eoy')return 'bis Jahresende';
  if(p==='52w')return '52 Wochen';
  return currentForecastWeeks()+' Wochen'
}
function forecastShortageKey(r){return planningStockKey(r.kind,r.id,r.color)}
function forecastShortageLabel(r){
  return `${r.id} · ${warehouseItemName(r.kind,r.id)}${r.color?' · '+r.color:''}`
}
function runRealReinvestmentForecast(horizonOverride=null){
  ensureSalesPlanning();

  let stock=cloneForecastStock(),
    cash=actualRecoveredCash()-reconstructedActualPurchaseCapital(),
    events=[],
    pendingOrders=[];

  const hasRealStock=(state.realWarehouse||[]).length>0,
    realCapital=reconstructedActualPurchaseCapital();

  // If no real warehouse/purchases exist yet, the forecast must first buy the
  // virtual initial stock. Break-even is evaluated only AFTER this investment.
  if(!hasRealStock){
    const plan=calcPurchasePlan(false);
    cash-=plan.total;
    plan.groupPlans.forEach(g=>Object.entries(g.arrivals||{}).forEach(([color,qty])=>{
      if(qty>1e-9)forecastAddOrder(stock,{kind:g.kind,id:g.id,color},qty)
    }));
    if(plan.total>0)events.push({
      week:0,type:'purchase',
      text:'Virtueller Ersteinkauf aus Einkaufsrechner',
      amount:-plan.total
    })
  }

  const initialCash=cash,
    hasInitialInvestment=realCapital>1e-9||events.some(e=>e.week===0&&e.type==='purchase'&&e.amount<0),
    breakEvenInitially=!hasInitialInvestment&&cash>=0,
    horizon=horizonOverride===null?currentForecastWeeks():Math.max(1,Math.floor(num(horizonOverride,currentForecastWeeks())));

  let breakEvenWeek=breakEvenInitially?0:null,
    breakEvenSales=breakEvenInitially?0:null,
    breakEvenCash=breakEvenInitially?cash:null,
    leadWeeks=Math.max(0,Math.ceil(state.salesPlanning.leadWeeks)),
    active=forecastActiveVariants();

  let totalForecastSales=0,totalReorders=0,reorderCost=0,lostSales=0,
    expectedDemand=0,shortageMap=new Map();

  for(let week=1;week<=horizon;week++){
    // 1) Previously ordered goods arrive now.
    const arriving=pendingOrders.filter(o=>o.arrivalWeek<=week);
    arriving.forEach(o=>{
      Object.entries(o.arrivals).forEach(([color,qty])=>{
        if(qty>1e-9)forecastAddOrder(stock,{kind:o.kind,id:o.id,color},qty)
      });
      events.push({week,type:'arrival',text:`${o.id} Lieferung eingetroffen`,amount:0})
    });
    pendingOrders=pendingOrders.filter(o=>o.arrivalWeek>week);

    // 2) Forward-looking replenishment on PID/VID level.
    // Core rule:
    // - trigger early enough that CURRENT stock survives until the new shipment
    // - order enough that the NEW shipment survives until the NEXT possible
    //   shipment plus safety stock
    // - neutral/flexible stock is one shared pool and may never be counted once
    //   per color.
    const reorderGroups=new Map(),
      reqNow=weeklyRequirements(week),
      safetyWeeks=Math.max(0,Math.ceil(state.salesPlanning.safetyWeeks)),
      demandCache=new Map();

    const reqMapForWeek=w=>{
      if(!demandCache.has(w)){
        const m=new Map();
        weeklyRequirements(w).forEach(x=>{
          const k=planningStockKey(x.kind,x.id,x.color);
          const prev=m.get(k);
          if(prev)prev.weekly+=x.weekly;
          else m.set(k,{...x})
        });
        demandCache.set(w,m)
      }
      return demandCache.get(w)
    };

    const futureDemand=(kind,id,color,fromWeek,toWeek)=>{
      if(toWeek<fromWeek)return 0;
      const k=planningStockKey(kind,id,color);
      let total=0;
      for(let w=fromWeek;w<=toWeek;w++)total+=num(reqMapForWeek(w).get(k)?.weekly);
      return total
    };

    reqNow.forEach(r=>{
      const gk=r.kind+'|'+r.id;
      if(!reorderGroups.has(gk))reorderGroups.set(gk,{kind:r.kind,id:r.id,rows:[]});
      reorderGroups.get(gk).rows.push(r)
    });

    const allocateSharedNeutral=(rows,neutralQty,demandField,exactField)=>{
      let neutral=Math.max(0,num(neutralQty));
      const out=rows.map(x=>{
        const demand=Math.max(0,num(x[demandField])),
          exact=Math.max(0,num(x[exactField])),
          deficit=Math.max(0,demand-exact);
        return {...x,deficit}
      }).sort((a,b)=>b.deficit-a.deficit);

      out.forEach(x=>{
        const used=Math.min(neutral,x.deficit);
        x.neutralUsed=used;
        x.uncovered=Math.max(0,x.deficit-used);
        neutral-=used
      });
      return{rows:out,neutralLeft:neutral,totalUncovered:out.reduce((a,x)=>a+x.uncovered,0)}
    };

    reorderGroups.forEach(g=>{
      // An existing order is only allowed to block a new order because every
      // order created by this version covers the full next replenishment cycle.
      if(pendingOrders.some(o=>o.kind===g.kind&&o.id===g.id)){
        g.skip=true;
        return
      }

      const arrivalWeek=week+leadWeeks,
        // Current stock must bridge exactly until the first shipment arrives.
        preArrivalEnd=leadWeeks>0?arrivalWeek-1:week-1,
        // After that first shipment arrives, the earliest follow-up order placed
        // then would arrive another lead-time later. Cover that full cycle plus
        // safety stock and one weekly review interval.
        nextPossibleArrival=arrivalWeek+leadWeeks,
        coverEnd=nextPossibleArrival+safetyWeeks,
        neutralCurrent=forecastStockAvailable(stock,g.kind,g.id,''),
        rowData=g.rows.map(r=>{
          const exactCurrent=stock[planningStockKey(r.kind,r.id,r.color)]||0,
            demandToArrival=futureDemand(r.kind,r.id,r.color,week,preArrivalEnd),
            demandToCover=futureDemand(r.kind,r.id,r.color,week,coverEnd),
            safetyDemand=safetyWeeks>0
              ?futureDemand(r.kind,r.id,r.color,nextPossibleArrival,nextPossibleArrival+safetyWeeks-1)
              :0,
            overrideKey=planningStockKey(r.kind,r.id,r.color),
            override=state.salesPlanning.reorderOverrides[overrideKey],
            manualSafety=(override!==undefined&&override!==''&&Number.isFinite(Number(override)))
              ?Math.max(0,num(override))
              :0;
          return{
            ...r,
            exactCurrent,
            demandToArrival,
            demandToCover,
            safetyTarget:Math.max(safetyDemand,manualSafety)
          }
        });

      // FIRST question: can current exact stock + ONE shared neutral pool survive
      // until the new order arrives?
      const bridge=allocateSharedNeutral(rowData,neutralCurrent,'demandToArrival','exactCurrent');

      // Keep configured manual safety stock at arrival as an additional trigger.
      const projectedRows=bridge.rows.map(x=>({
        ...x,
        projectedAtArrival:Math.max(0,x.exactCurrent-x.demandToArrival)+(x.neutralUsed?0:0)
      }));
      const safetyTrigger=projectedRows.some(x=>{
        const exactAfter=Math.max(0,x.exactCurrent-x.demandToArrival);
        return exactAfter<x.safetyTarget-1e-9
      });

      // Also retain the percentage / conventional reorder point as an early
      // warning, but calculate it from the real shared stock only once.
      const aggregateCurrent=g.rows.reduce((a,r)=>a+(stock[planningStockKey(r.kind,r.id,r.color)]||0),0)+neutralCurrent,
        aggregatePoint=g.rows.reduce((a,r)=>a+reorderPointFor(r),0),
        shouldOrder=bridge.totalUncovered>1e-9||aggregateCurrent<=aggregatePoint+1e-9||safetyTrigger;

      if(!shouldOrder){
        g.skip=true;
        return
      }

      // SECOND question: how much must the new order contain?
      // Target stock covers demand from now through the NEXT possible arrival
      // (2 × lead time from today) plus safety/review interval.
      const targetAllocation=allocateSharedNeutral(rowData,neutralCurrent,'demandToCover','exactCurrent');

      g.needs=targetAllocation.rows
        .map(x=>({
          ...x,
          short:Math.max(0,x.uncovered),
          projectedAtArrival:x.exactCurrent-x.demandToArrival,
          arrivalWeek,
          coverEnd
        }))
        .filter(x=>x.short>1e-9);

      if(!g.needs.length){
        g.skip=true;
        return
      }
    });

    [...reorderGroups.entries()].forEach(([k,g])=>{if(g.skip)reorderGroups.delete(k)});

    reorderGroups.forEach(g=>{
      const supplier=planningPreferredSupplier(g.kind,g.id);if(!supplier)return;
      let cost=0,arrivals={},text='';

      if(supplier.priceType==='set'){
        const o=planningSetOrder(g.kind,g.id,g.needs,supplier);
        if(o.impossible||o.ordered<=0)return;
        cost=o.cost;
        Object.entries(o.composition).forEach(([c,n])=>arrivals[c]=n*o.sets);
        text=`${g.id} · ${o.sets} komplettes Set${o.sets===1?'':'s'} bestellen = ${o.ordered} Stück`
      }else if(supplier.priceType==='consumable'){
        const missing=g.needs.reduce((a,x)=>a+x.short,0),
          pack=supplierQtyBase(supplier),
          packs=Math.ceil(missing/pack-1e-9);
        cost=packs*supplierOrderCost(supplier);
        arrivals['']=packs*pack;
        text=`${g.id} · ${packs*pack} als feste Packmenge bestellen`
      }else{
        const missing=g.needs.reduce((a,x)=>a+x.short,0),
          o=planningPieceOrder(g.kind,g.id,missing,supplier);
        cost=o.cost;
        let left=o.ordered;

        // Ordered pieces go to the concrete future color deficits first.
        g.needs
          .slice()
          .sort((a,b)=>b.short-a.short)
          .forEach(r=>{
            const a=Math.min(r.short,left);
            if(a>1e-9){
              arrivals[r.color||'']=(arrivals[r.color||'']||0)+a;
              left-=a
            }
          });
        // MOQ / active shipping-point surplus remains flexible for any color.
        if(left>1e-9)arrivals['']=(arrivals['']||0)+left;

        text=`${g.id} · ${o.ordered} Stück bestellen (Bedarf bis Folge-Lieferung ${Math.ceil(missing)} · MOQ ${o.moq}${o.recommended?' · nahe Versandoption insgesamt günstiger':''})`
      }

      cash-=cost;
      reorderCost+=cost;
      totalReorders+=1;

      const arrivalWeek=week+leadWeeks;
      if(leadWeeks===0){
        Object.entries(arrivals).forEach(([color,qty])=>{
          if(qty>1e-9)forecastAddOrder(stock,{kind:g.kind,id:g.id,color},qty)
        })
      }else{
        pendingOrders.push({kind:g.kind,id:g.id,arrivals,arrivalWeek,cost})
      }

      events.push({
        week,type:'reorder',
        text:`${text}${leadWeeks?` · Ankunft ca. Woche ${arrivalWeek}`:''} · Vorrat geplant bis mindestens Woche ${Math.max(...g.needs.map(x=>x.coverEnd))}`,
        amount:-cost
      })
    });

    // 3) Expected sales for the week.
    active.forEach(x=>{
      // Use the exact dynamic rate for THIS week (same curve as the forecast UI).
      const rate=planningRateAt(x.b.key,x.variant,week);if(rate<=0)return;
      expectedDemand+=rate;
      const requirements=saleRequirements(x.b,x.variant,1);
      let feasible=rate;

      requirements.forEach(r=>{
        const av=forecastStockAvailable(stock,r.kind,r.id,r.color);
        feasible=Math.min(feasible,av/Math.max(.001,r.need))
      });
      feasible=Math.max(0,feasible);

      const missed=Math.max(0,rate-feasible);
      lostSales+=missed;

      if(missed>1e-9){
        requirements.forEach(r=>{
          const available=forecastStockAvailable(stock,r.kind,r.id,r.color),
            neededForFull=r.need*rate,
            missingUnits=Math.max(0,neededForFull-available);
          if(missingUnits<=1e-9)return;
          const k=forecastShortageKey(r),
            pendingForItem=pendingOrders.filter(o=>o.kind===r.kind&&o.id===r.id),
            nextArrival=pendingForItem.length?Math.min(...pendingForItem.map(o=>o.arrivalWeek)):null,
            entry=shortageMap.get(k)||{
              kind:r.kind,id:r.id,color:r.color||'',lostSales:0,missingUnits:0,
              firstWeek:week,lastWeek:week,nextArrival:null
            };
          entry.lostSales+=missed;
          entry.missingUnits+=missingUnits;
          entry.lastWeek=week;
          if(nextArrival!==null)entry.nextArrival=entry.nextArrival===null?nextArrival:Math.min(entry.nextArrival,nextArrival);
          shortageMap.set(k,entry)
        })
      }

      requirements.forEach(r=>forecastConsume(stock,r,r.need*feasible));
      cash+=estimatedSaleCashContribution(x.b,x.variant)*feasible;
      totalForecastSales+=feasible
    });

    if(breakEvenWeek===null&&cash>=0){
      breakEvenWeek=week;
      breakEvenSales=totalForecastSales;
      breakEvenCash=cash
    }
  }

  return{
    cash,initialCash,breakEvenWeek,breakEvenSales,breakEvenCash,
    events,totalForecastSales,totalReorders,reorderCost,stock,lostSales,
    pendingOrders,weeklyTarget:forecastWeeklyTotalAt(1),weeklyTargetEnd:forecastWeeklyTotalAt(horizon),
    expectedDemand,
    shortages:[...shortageMap.values()].sort((a,b)=>b.lostSales-a.lostSales)
  }
}
function findRealReinvestmentBreakEven(){
  const visibleWeeks=currentForecastWeeks(),
    visible=runRealReinvestmentForecast(visibleWeeks);
  if(visible.breakEvenWeek!==null)return{...visible,searchWeeks:visibleWeeks,found:true};

  // Continue the identical week-by-week model farther into the future.
  // We rerun from week 0 for each extension so stock, MOQ/set purchases,
  // delivery lead times, growth forecast and reinvestments remain identical.
  const maxWeeks=1040; // 20 years: practical guard against endless simulations
  let weeks=Math.max(visibleWeeks+1,Math.ceil(visibleWeeks/25)*25);
  while(weeks<=maxWeeks){
    const r=runRealReinvestmentForecast(weeks);
    if(r.breakEvenWeek!==null)return{...r,searchWeeks:weeks,found:true};
    if(weeks===maxWeeks)break;
    weeks=Math.min(maxWeeks,weeks+Math.max(25,Math.ceil(weeks*.2)))
  }
  return{...runRealReinvestmentForecast(maxWeeks),searchWeeks:maxWeeks,found:false}
}
function renderRealReinvestmentForecast(){
  const el=$('#realReinvestmentForecast');if(!el)return;
  const r=runRealReinvestmentForecast(),
    be=findRealReinvestmentBreakEven(),
    capital=reconstructedActualPurchaseCapital(),
    recovered=actualRecoveredCash(),
    period=forecastPeriodLabel(),
    netChange=r.cash-r.initialCash;

  const beReached=be.breakEvenWeek!==null,
    beText=beReached
      ? (be.breakEvenWeek===0?'Bereits erreicht':`Woche ${be.breakEvenWeek}`)
      : 'Mit aktueller Prognose nicht erreicht',
    beSales=beReached&&be.breakEvenSales!==null?be.breakEvenSales.toFixed(1):'–';

  el.innerHTML=`<div class="break-even-panel ${beReached?'reached':'pending'}">
    <div><div class="tiny">BREAK-EVEN-POINT</div><div class="break-even-main">${beText}</div></div>
    <div><div class="tiny">Verkäufe bis Break-even</div><strong>${beSales}</strong></div>
    <div><div class="tiny">Bedeutung</div><span>Erster Zeitpunkt nach dem echten bzw. simulierten Ersteinkauf, an dem der kumulierte Cashflow inklusive aller nötigen Nachbestellungen erstmals wieder mindestens 0 € erreicht.</span></div>
  </div>
  <div class="forecast-summary">
    <div class="production-kpi"><div class="label">Bisher echtes Einkaufskapital</div><div class="value">${euro(capital)}</div></div>
    <div class="production-kpi"><div class="label">Bisheriger Rückfluss aus Verkäufen</div><div class="value">${euro(recovered)}</div></div>
    <div class="production-kpi"><div class="label">Break-even-Punkt</div><div class="value">${beText}</div><div class="tiny">${beReached?`${beSales} simulierte Verkäufe bis dahin · freies Geld ab dann ${euro(be.breakEvenCash)}`:`auch nach ${be.searchWeeks} Wochen nicht positiv`}</div></div>
    <div class="production-kpi"><div class="label">Erwartete Nachfrage (${period})</div><div class="value">${r.expectedDemand.toFixed(1)}</div><div class="tiny">${forecastNumber(r.weeklyTarget)} / Woche Start → ${forecastNumber(r.weeklyTargetEnd)} / Woche Ende · Ø ${forecastNumber(r.expectedDemand/Math.max(1,currentForecastWeeks()))} / Woche · identische Wachstumskurve wie oben</div></div>
    <div class="production-kpi"><div class="label">Voraussichtlich lieferbar</div><div class="value">${r.totalForecastSales.toFixed(1)}</div><div class="tiny">${r.expectedDemand>0?(r.totalForecastSales/r.expectedDemand*100).toFixed(1).replace('.',','):'0,0'} % der erwarteten Nachfrage</div></div>
    <div class="production-kpi"><div class="label">Gefährdet / nicht lieferbar</div><div class="value">${r.lostSales.toFixed(1)}</div><div class="tiny">${r.expectedDemand>0?(r.lostSales/r.expectedDemand*100).toFixed(1).replace('.',','):'0,0'} % der erwarteten Nachfrage</div></div>
    <div class="production-kpi"><div class="label">Simulierte Nachbestellungen</div><div class="value">${euro(r.reorderCost)}</div><div class="tiny">${r.totalReorders} Bestellpakete</div></div>
  </div>
  <div class="info">
    <strong>Voraussichtliches frei verfügbares Geld nach ${period}: ${euro(r.cash)}</strong><br>
    Das ist der simulierte Cash-Bestand nach Verkäufen und allen bis dahin nötigen Nachbestellungen. 
    ${netChange>=0?`Gegenüber dem Start der Prognose steigt der freie Cash-Bestand um ${euro(netChange)}.`:`Gegenüber dem Start der Prognose sinkt der freie Cash-Bestand um ${euro(Math.abs(netChange))}.`}
    ${beReached
      ? (be.breakEvenWeek>currentForecastWeeks()
          ? ` Im gewählten Zeitraum ist der Break-even noch nicht erreicht. Bei unveränderter Prognose wird das freie Geld erstmals in <strong>Woche ${be.breakEvenWeek}</strong> positiv bzw. mindestens 0 € (${euro(be.breakEvenCash)}).`
          : ` Der Break-even wird in <strong>Woche ${be.breakEvenWeek}</strong> erreicht; dort ist der kumulierte Cashflow nach Einkauf, Verkäufen und notwendigen Nachbestellungen erstmals mindestens 0 €.`)
      : ` Mit der aktuellen Verkaufs-, Kosten-, Lager- und Nachbestellprognose wird innerhalb von ${be.searchWeeks} Wochen kein positiver kumulierter Cashflow erreicht.`}
  </div>
  ${r.shortages.length?`<details class="shortage-details" style="margin-top:10px" open>
    <summary>Warum Verkäufe gefährdet sind (${r.shortages.length} Engpässe)</summary>
    <div class="forecast-reorder-wrap"><table class="forecast-reorder-table"><thead><tr><th>Artikel</th><th>Farbe</th><th>Betroffene Verkäufe*</th><th>Fehlmenge kumuliert</th><th>Erstmals</th><th>Nächste Lieferung</th></tr></thead><tbody>
    ${r.shortages.map(x=>`<tr><td><span class="idchip">${esc(x.id)}</span> ${esc(warehouseItemName(x.kind,x.id))}</td><td>${warehouseColorChip(x.color)}</td><td>${x.lostSales.toFixed(1)}</td><td>${x.missingUnits.toFixed(1)}</td><td>Woche ${x.firstWeek}</td><td>${x.nextArrival===null?'keine offene Bestellung':`Woche ${x.nextArrival}`}</td></tr>`).join('')}
    </tbody></table></div><div class="tiny">*Ein nicht lieferbarer Verkauf kann mehrere fehlende Artikel betreffen; die Artikelwerte dürfen deshalb nicht einfach addiert werden.</div>
  </details>`:`<div class="info" style="margin-top:10px"><strong>Keine Lieferengpässe simuliert.</strong> Die erwartete Nachfrage kann im gewählten Zeitraum vollständig bedient werden.</div>`}
  <details style="margin-top:10px"><summary>Bestell- & Lieferplan (${r.events.length})</summary><div class="forecast-week-events">${r.events.map(e=>`<div class="forecast-event"><span>Woche ${e.week}</span><span>${esc(e.text)}</span><strong>${euro(e.amount)}</strong></div>`).join('')||'<div class="tiny">Keine Ereignisse.</div>'}</div></details>`
}
function renderForecastAll(){
  ensureSalesPlanning();
  const lead=$('#forecastLeadWeeks'),safety=$('#forecastSafetyWeeks'),pct=$('#forecastThresholdPct'),
    hor=$('#forecastHorizonWeeks'),preset=$('#forecastHorizonPreset'),wrap=$('#forecastCustomWeeksWrap');
  if(lead)lead.value=state.salesPlanning.leadWeeks;
  if(safety)safety.value=state.salesPlanning.safetyWeeks;
  if(pct)pct.value=state.salesPlanning.thresholdPct;
  if(hor)hor.value=state.salesPlanning.horizonWeeks;
  if(preset)preset.value=state.salesPlanning.horizonPreset||'52w';
  const scenario=$('#forecastScenario'),startSales=$('#forecastStartWeeklySales'),startWrap=$('#forecastStartWeeklyWrap');
  if(scenario)scenario.value=state.salesPlanning.forecastScenario||'realistic';
  if(startSales)startSales.value=state.salesPlanning.startWeeklySales;
  if(startWrap)startWrap.classList.toggle('hidden',(state.salesPlanning.forecastScenario||'realistic')!=='custom');
  if(wrap)wrap.classList.toggle('hidden',(state.salesPlanning.horizonPreset||'52w')!=='custom');
  try{renderForecastVariantRates()}catch(err){console.error('Forecast Varianten:',err)}
  try{renderForecastReorderTable()}catch(err){console.error('Nachbestellpunkte:',err)}
  try{renderRealReinvestmentForecast()}catch(err){console.error('Break-even/Reinvestition:',err);const el=$('#realReinvestmentForecast');if(el)el.innerHTML='<div class="hint">Prognose konnte nicht berechnet werden. Details stehen in der Browser-Konsole.</div>'}
}
function bindSalesPlanningUi(){
  ensureSalesPlanning();
  const add=$('#purchaseCalcAddBtn');if(!add)return;
  add.onclick=()=>purchaseCalcAddRow();
  const addAll=$('#purchaseCalcAddAllVariantsBtn');if(addAll)addAll.onclick=purchaseCalcAddAllVariants;
  $('#purchaseCalcUseStock').onchange=renderPurchaseCalc;
  ['forecastLeadWeeks','forecastSafetyWeeks','forecastThresholdPct','forecastHorizonWeeks'].forEach(id=>$('#'+id).onchange=()=>{
    state.salesPlanning.leadWeeks=Math.max(0,num($('#forecastLeadWeeks').value,3));
    state.salesPlanning.safetyWeeks=Math.max(0,num($('#forecastSafetyWeeks').value,1));
    state.salesPlanning.thresholdPct=Math.max(0,Math.min(100,num($('#forecastThresholdPct').value,35)));
    state.salesPlanning.horizonWeeks=Math.max(1,Math.min(260,Math.floor(num($('#forecastHorizonWeeks').value,52))));
    persistSalesPlanning();renderForecastAll()
  });
  $('#forecastHorizonPreset').onchange=()=>{
    state.salesPlanning.horizonPreset=$('#forecastHorizonPreset').value;
    persistSalesPlanning();renderForecastAll()
  };
  const scenario=$('#forecastScenario');if(scenario)scenario.onchange=()=>{
    state.salesPlanning.forecastScenario=scenario.value;persistSalesPlanning();renderForecastAll()
  };
  const startSales=$('#forecastStartWeeklySales');if(startSales)startSales.onchange=()=>{
    state.salesPlanning.startWeeklySales=Math.max(0,num(startSales.value,1.5));
    state.salesPlanning.forecastScenario='custom';persistSalesPlanning();renderForecastAll()
  };
  $('#forecastRecalcBtn').onclick=renderForecastAll;
  renderPurchaseCalcRows();renderPurchaseCalc();renderForecastAll()
}

