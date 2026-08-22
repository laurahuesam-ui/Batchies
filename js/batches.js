

function preferredPackagingSupplier(v){return (v?.suppliers||[]).find(s=>s.preferred)||(v?.suppliers||[])[0]||null}
function packagingPurchaseCost(v){const s=preferredPackagingSupplier(v);return s?supplierLandedUnitCost(s):0}
function sortBatchItemsByPid(items){return [...(items||[])].sort((a,b)=>parseIdNumber(a.pid,'PID')-parseIdNumber(b.pid,'PID')||String(a.pid).localeCompare(String(b.pid),'de',{numeric:true}))}
function sortBatchPackagingByVid(items){return [...(items||[])].sort((a,b)=>parseIdNumber(a.vid,'VID')-parseIdNumber(b.vid,'VID')||String(a.vid).localeCompare(String(b.vid),'de',{numeric:true}))}

function batchProductionPlan(b){
  const pg=new Map(),vg=new Map();
  (b.items||[]).forEach(i=>{if(i.pid)pg.set(i.pid,(pg.get(i.pid)||0)+Math.max(1,num(i.qty,1)))});
  (b.packagingItems||[]).forEach(i=>{if(i.vid)vg.set(i.vid,(vg.get(i.vid)||0)+Math.max(0.001,num(i.qty,1)))});

  const productLines=[],packagingLines=[];
  let firstOrderCost=0,possible=Infinity,missing=false;

  function addLine(kind,id,qty,x,s){
    if(!x||!s){
      missing=true;
      const line={kind,id,name:x?.name||(kind==='product'?'Produkt fehlt':'Verpackung fehlt'),qty,available:0,orderCost:0,batches:0,missing:true,unitLanded:0};
      (kind==='product'?productLines:packagingLines).push(line);possible=0;return
    }
    const available=supplierQtyBase(s),orderCost=supplierOrderCost(s),count=Math.floor(available/qty),
      unitLanded=available>0?orderCost/available:0;
    firstOrderCost+=orderCost;possible=Math.min(possible,count);
    (kind==='product'?productLines:packagingLines).push({kind,id,name:x.name,qty,available,orderCost,batches:count,missing:false,unitLanded})
  }

  pg.forEach((qty,id)=>{const x=state.products.find(p=>p.pid===id),s=(x?.suppliers||[]).find(z=>z.preferred)||(x?.suppliers||[])[0];addLine('product',id,qty,x,s)});
  vg.forEach((qty,id)=>{const x=state.packaging.find(v=>v.vid===id),s=preferredPackagingSupplier(x);addLine('packaging',id,qty,x,s)});

  const lines=[...productLines,...packagingLines];
  if(possible===Infinity)possible=0;
  const limiter=lines.filter(x=>x.batches===possible&&!x.missing);

  let remainingInventoryValue=0;
  lines.forEach(x=>{
    if(x.missing)return;
    const used=Math.min(x.available,possible*x.qty),remaining=Math.max(0,x.available-used);
    x.remainingAfterPossible=remaining;x.remainingValue=remaining*x.unitLanded;remainingInventoryValue+=x.remainingValue
  });

  function scenario(targetBatches){
    targetBatches=Math.max(1,Math.floor(num(targetBatches,1)));
    let additionalCapital=0,totalCapital=firstOrderCost,remainingValue=0;
    const details=lines.map(x=>{
      if(x.missing)return {...x,extraOrders:0,extraCapital:0,totalAvailable:x.available,remainingAfterTarget:0};
      const required=targetBatches*x.qty,extraNeeded=Math.max(0,required-x.available),
        extraOrders=extraNeeded>0?Math.ceil(extraNeeded/x.available):0,
        extraCapital=extraOrders*x.orderCost,totalAvailable=x.available+extraOrders*x.available,
        remainingAfterTarget=Math.max(0,totalAvailable-required),remainingValueAfterTarget=remainingAfterTarget*x.unitLanded;
      additionalCapital+=extraCapital;totalCapital+=extraCapital;remainingValue+=remainingValueAfterTarget;
      return {...x,required,extraOrders,extraCapital,totalAvailable,remainingAfterTarget,remainingValueAfterTarget}
    });
    return{targetBatches,additionalCapital,totalCapital,remainingValue,details}
  }

  return{productLines,packagingLines,lines,firstOrderCost,possible,limiter,unitBatchCost:batchCalc(b).total,missing,remainingInventoryValue,scenario}
}
function productionLinesHtml(lines,label){
  if(!lines.length)return'';
  return`<div class="tiny" style="font-weight:800;margin:12px 0 5px">${esc(label)}</div><div class="production-lines"><div class="production-line head"><span>ID · Position</span><span>Bedarf/Batch</span><span>1. Bestellung</span><span>Reicht für</span></div>${lines.map(x=>{
    const isPack=String(x.id).startsWith('VID-'),
      obj=isPack?state.packaging.find(v=>v.vid===x.id):null,
      sup=isPack?preferredPackagingSupplier(obj):null,
      unit=sup?.priceType==='consumable'?(sup.consumptionUnit||'Einheit'):'Stk.';
    return `<div class="production-line"><span><b>${esc(x.id)}</b> · ${esc(x.name)}</span><span>${x.qty} ${esc(unit)}</span><span>${x.missing?'–':x.available+' '+esc(unit)+' · '+euro(x.orderCost)}</span><span>${x.missing?'–':x.batches+' Batches'}</span></div>`
  }).join('')}</div>`
}
function renderBatchProductionPlan(b){
  const el=$('#batchProductionContent');if(!el)return;
  const p=batchProductionPlan(b);
  if(!p.lines.length){el.innerHTML='<div class="assistant-empty" style="margin-top:10px">Füge Produkte oder Verpackungsmaterialien hinzu, um die Herstellungsplanung zu berechnen.</div>';return}
  const limiter=p.limiter.length?p.limiter.map(x=>esc(x.id+' · '+x.name)).join(', '):(p.missing?'Lieferantendaten fehlen':'–'),
    custom=Math.max(1,Math.floor(num($('#batchPlanHorizon')?.value,25))),
    scenarios=[10,25,50,100].map(n=>p.scenario(n)),customScenario=p.scenario(custom);

  el.innerHTML=`<div class="production-kpis">
    <div class="production-kpi"><div class="label">Kapitalbedarf 1. Einkauf</div><div class="value">${euro(p.firstOrderCost)}</div></div>
    <div class="production-kpi"><div class="label">Mögliche Batches ohne Nachkauf</div><div class="value">${p.possible}</div></div>
    <div class="production-kpi"><div class="label">Lagerbestand danach</div><div class="value">${euro(p.remainingInventoryValue)}</div></div>
    <div class="production-kpi"><div class="label">Engpass</div><div class="value" style="font-size:12px">${limiter}</div></div>
    <div class="production-kpi"><div class="label">Material-EK pro Batch</div><div class="value">${euro(p.unitBatchCost)}</div></div>
  </div>
  <div class="planning-scenarios">
    <div class="toolbar compact"><strong>Ausbau-Szenarien</strong><span class="tiny">Nachbestellungen in echten MOQ-/Set-/Packungsschritten</span></div>
    <div class="production-kpis">${scenarios.map(s=>`<div class="production-kpi scenario-kpi"><div class="label">${s.targetBatches} Batches</div><div class="value">${euro(s.additionalCapital)} zusätzlich</div><div class="tiny">Gesamt ${euro(s.totalCapital)} · Restlager ${euro(s.remainingValue)}</div></div>`).join('')}</div>
    <div class="planning-custom"><label><span>Eigener Planungshorizont</span><input id="batchPlanHorizon" type="number" min="1" step="1" value="${custom}"></label><div class="production-kpi"><div class="label">${custom} Batches</div><div class="value">${euro(customScenario.additionalCapital)} zusätzlich</div><div class="tiny">Gesamtkapital ${euro(customScenario.totalCapital)} · Restlager ${euro(customScenario.remainingValue)}</div></div></div>
    <div class="tiny">Große Überbestände einzelner Produkte bestimmen nicht mehr das Ziel. Du entscheidest, ob du z. B. für 10, 25, 50 oder 100 Verkäufe planen willst.</div>
  </div>
  ${productionLinesHtml(p.productLines,'Produkte (PID)')}${productionLinesHtml(p.packagingLines,'Verpackung (VID)')}`;
  const h=$('#batchPlanHorizon');if(h)h.oninput=()=>renderBatchProductionPlan(b)
}
function batchVariantDots(b,compact=true){
  const names=[...new Set((b?.saleVariants||[]).map(v=>String(v?.name||'').trim()).filter(Boolean))];
  if(!names.length)return '<span class="tiny">keine Verkaufsvariante</span>';
  return `<div class="product-color-dots${compact?' compact':''}" aria-label="Verkaufsfarben">${names.map(name=>{
    const c=PRODUCT_COLOR_MAP[name];
    const hex=(c&&typeof c.hex==='string'&&c.hex.trim())?c.hex:'#b8b8b8';
    return `<span class="product-color-dot batch-sale-color-dot" style="background:${esc(hex)}!important;--dot:${esc(hex)}" title="${esc(name)}" aria-label="${esc(name)}"></span>`
  }).join('')}</div>`
}
function renderBatches(){
  state.batches.forEach(b=>{
    b.items=sortBatchItemsByPid(b.items);
    b.packagingItems=sortBatchPackagingByVid(b.packagingItems)
  });
  const q=($('#searchBatches')?.value||'').toLowerCase().trim(),
    bs=state.batches.filter(b=>(b.bid+' '+b.name+' '+(b.notes||'')).toLowerCase().includes(q)),
    el=$('#batchesTable');
  if(!bs.length){
    el.innerHTML='<div class="empty"><strong>'+(state.batches.length?'Keine Treffer':'Noch keine Batches')+'</strong>Ein Batch kann Produkt-PIDs und Verpackungs-VIDs enthalten.</div>';
    return
  }
  el.innerHTML='<div class="table-wrap"><table class="batch-table"><thead><tr>'+
    '<th class="batch-id-col">ID</th>'+
    '<th class="batch-name-col">Batch</th>'+
    '<th class="batch-status-col">Status</th>'+
    '<th class="batch-products-col">Produkte</th>'+
    '<th class="batch-vid-col">VID</th>'+
    '<th class="batch-first-order-col" title="1. AK / Anfangskauf">1. AK</th>'+
    '<th class="batch-ek-col">EK</th>'+
    '<th class="batch-rec-col">Empf. VK</th>'+
    '<th class="batch-vk-col">VK</th>'+
    '<th class="batch-margin-col">Gewinn</th>'+
    '<th class="batch-action-col"></th>'+
    '</tr></thead><tbody>'+
    bs.map(b=>{
      const c=batchCalc(b),prod=batchProductionPlan(b);
      return `<tr>
        <td class="batch-id-col"><span class="idchip">${esc(b.bid)}</span></td>
        <td class="batch-name-col"><div class="name">${esc(b.name)}</div>${batchVariantDots(b,true)}</td>
        <td class="batch-status-col"><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
        <td class="batch-products-col"><div class="batch-products-list">${(b.items||[]).map(i=>esc(i.pid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="batch-vid-col"><div class="batch-vid-list">${(b.packagingItems||[]).map(i=>esc(i.vid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="money batch-first-order-col">${euro(prod.firstOrderCost)}</td>
        <td class="money batch-ek-col">${euro(c.total)}</td>
        <td class="money positive batch-rec-col">${euro(c.recommended)}</td>
        <td class="money batch-vk-col">${euro(b.salePrice)}</td>
        <td class="batch-margin-col ${c.profit>=automaticTargetProfitForPrice(num(b.salePrice))?'positive':'negative'}" title="Zielgewinn bei diesem VK: ${euro(automaticTargetProfitForPrice(num(b.salePrice)))}">${euro(c.profit)}</td>
        <td class="batch-action-col"><button type="button" class="iconbtn batch-edit-btn" data-key="${esc(b.key)}" title="Batch bearbeiten">✎</button></td>
      </tr>`
    }).join('')+
    '</tbody></table></div>';

}
function renderBatchItemRows(items){
  const clean=sortBatchItemsByPid(Array.isArray(items)?items:[]);
  const opts='<option value="">Produkt wählen …</option>'+state.products.map(p=>`<option value="${esc(p.pid)}">${esc(p.pid)} · ${esc(p.name)}</option>`).join('');
  const shown=clean.length?clean:[{pid:'',qty:1}];
  $('#batchItemRows').innerHTML=shown.map(i=>`<div class="batch-product-row"><select class="batch-product">${opts}</select><input class="batch-qty" type="number" min="1" step="1" value="${Math.max(1,num(i?.qty,1))}"><div class="money batch-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-item">✕</button></div>`).join('');
  $$('#batchItemRows .batch-product-row').forEach((r,idx)=>{
    const select=r.querySelector('.batch-product');
    if(select)select.value=shown[idx]?.pid||'';
  });
  bindBatchItemEvents()
}
function bindBatchItemEvents(){
  $$('#batchItemRows .batch-product,#batchItemRows .batch-qty').forEach(e=>e.addEventListener('input',liveBatchCalc));
  $$('#batchItemRows .remove-batch-item').forEach(btn=>btn.addEventListener('click',()=>{
    const row=btn.closest('.batch-product-row');
    if(row)row.remove();
    liveBatchCalc()
  }))
}
function renderBatchPackagingRows(items){
  const clean=sortBatchPackagingByVid(Array.isArray(items)?items:[]);
  const opts='<option value="">Verpackung wählen …</option>'+state.packaging.map(v=>`<option value="${esc(v.vid)}">${esc(v.vid)} · ${esc(v.name)}</option>`).join('');
  const shown=clean.length?clean:[{vid:'',qty:1}];
  $('#batchPackagingRows').innerHTML=shown.map(i=>`<div class="batch-packaging-row"><select class="batch-packaging">${opts}</select><div class="batch-packaging-usage-wrap"><input class="batch-packaging-qty" type="number" min="0.001" step="0.01" value="${Math.max(0.001,num(i?.qty,1))}"><span class="batch-packaging-unit">Stk.</span></div><div class="money batch-packaging-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-packaging">✕</button></div>`).join('');
  $$('#batchPackagingRows .batch-packaging-row').forEach((r,idx)=>{
    const select=r.querySelector('.batch-packaging');
    if(!select)return;
    const vid=shown[idx]?.vid||'';
    select.value=state.packaging.some(v=>v.vid===vid)?vid:'';
    if(vid&&!select.value){
      const missing=document.createElement('option');
      missing.value=vid;
      missing.textContent=vid+' · Verpackung fehlt';
      missing.selected=true;
      select.appendChild(missing);
    }
  });
  bindBatchPackagingEvents()
}
function bindBatchPackagingEvents(){
  $$('#batchPackagingRows .batch-packaging,#batchPackagingRows .batch-packaging-qty').forEach(e=>e.addEventListener('input',liveBatchCalc));
  $$('#batchPackagingRows .remove-batch-packaging').forEach(btn=>btn.addEventListener('click',()=>{
    const row=btn.closest('.batch-packaging-row');
    if(row)row.remove();
    liveBatchCalc()
  }))
}

function batchVariantProductOptions(pid,selected=''){
  const p=state.products.find(x=>x.pid===pid),colors=normalizeProductColors(p?.colors);
  return `<option value="">Ohne Farbe / neutral</option>`+colors.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')
}
function batchVariantNameOptions(pids,selected='',vids=[]){
  const colors=[...new Set([...(pids||[]).flatMap(pid=>normalizeProductColors(state.products.find(x=>x.pid===pid)?.colors)),...(vids||[]).flatMap(vid=>normalizeProductColors(state.packaging.find(x=>x.vid===vid)?.colors))])];
  if(selected&&!colors.includes(selected))colors.push(selected);
  return `<option value="">Farbe auswählen …</option>`+colors.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')
}
function addBatchVariantRow(v=null){
  const host=$('#batchVariantRows');if(!host)return;
  const key=v?.key||crypto.randomUUID(),name=v?.name||'',pc=v?.productColors||{},vc=v?.packagingColors||{};
  const products=$$('#batchItemRows .batch-product-row').map(r=>r.querySelector('.batch-product')?.value).filter(Boolean),
    packaging=$$('#batchPackagingRows .batch-packaging-row').map(r=>r.querySelector('.batch-packaging')?.value).filter(Boolean);
  const variantDefault=name;
  products.forEach(pid=>{if(!pc[pid]&&variantDefault&&normalizeProductColors(state.products.find(x=>x.pid===pid)?.colors).includes(variantDefault))pc[pid]=variantDefault});
  packaging.forEach(vid=>{if(!vc[vid]&&variantDefault&&normalizeProductColors(state.packaging.find(x=>x.vid===vid)?.colors).includes(variantDefault))vc[vid]=variantDefault});
  host.insertAdjacentHTML('beforeend',`<div class="batch-variant-card" data-key="${esc(key)}">
    <div class="batch-variant-head"><div class="field"><label>Verkaufsfarbe</label><select class="batch-variant-name">${batchVariantNameOptions(products,name,packaging)}</select></div><button type="button" class="iconbtn remove-batch-variant">✕</button></div>
    <div class="batch-variant-products">${products.map(pid=>{const p=state.products.find(x=>x.pid===pid);return `<div class="batch-variant-product" data-pid="${esc(pid)}"><div class="tiny"><strong>${esc(pid)}</strong> · ${esc(p?.name||pid)}</div><label>Farbe in dieser Variante</label><select class="batch-variant-product-color">${batchVariantProductOptions(pid,pc[pid]||'')}</select></div>`}).join('')}</div>
    ${packaging.length?`<div class="tiny" style="font-weight:800;margin-top:8px">Verpackung / Versand (VID)</div><div class="batch-variant-packaging">${packaging.map(vid=>{const x=state.packaging.find(v=>v.vid===vid),colors=normalizeProductColors(x?.colors);return `<div class="batch-variant-packaging-item" data-vid="${esc(vid)}"><div class="tiny"><strong>${esc(vid)}</strong> · ${esc(x?.name||vid)}</div><label>Farbe in dieser Variante</label><select class="batch-variant-packaging-color"><option value="">Ohne Farbe / neutral</option>${colors.map(c=>`<option value="${esc(c)}" ${c===(vc[vid]||'')?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`}).join('')}</div>`:''}
  </div>`);
  const card=host.lastElementChild;
  bindBatchVariantEvents();
  if(card&&name)applyBatchVariantMainColor(card)
}
function applyBatchVariantMainColor(card){
  if(!card)return;
  const main=card.querySelector('.batch-variant-name')?.value||'';
  if(!main)return;
  card.querySelectorAll('.batch-variant-product').forEach(row=>{
    const pid=row.dataset.pid,
      sel=row.querySelector('.batch-variant-product-color'),
      available=normalizeProductColors(state.products.find(x=>x.pid===pid)?.colors);
    if(sel&&available.includes(main)){
      sel.value=main;
      sel.dataset.autoColor=main
    }
  });
  card.querySelectorAll('.batch-variant-packaging-item').forEach(row=>{
    const vid=row.dataset.vid,sel=row.querySelector('.batch-variant-packaging-color'),available=normalizeProductColors(state.packaging.find(x=>x.vid===vid)?.colors);
    if(sel&&available.includes(main)){sel.value=main;sel.dataset.autoColor=main}
  })
}
function bindBatchVariantEvents(){
  $$('#batchVariantRows .batch-variant-card').forEach(card=>{
    const main=card.querySelector('.batch-variant-name');
    if(main)main.onchange=()=>applyBatchVariantMainColor(card);
    card.querySelectorAll('.batch-variant-product-color,.batch-variant-packaging-color').forEach(sel=>{
      sel.onchange=()=>{sel.dataset.autoColor=''}
    });
    const remove=card.querySelector('.remove-batch-variant');
    if(remove)remove.onclick=()=>card.remove()
  })
}
function renderBatchVariants(variants=[]){
  const host=$('#batchVariantRows');if(!host)return;host.innerHTML='';
  (variants||[]).forEach(v=>addBatchVariantRow(v));
  bindBatchVariantEvents()
}
function collectBatchVariants(){
  return $$('#batchVariantRows .batch-variant-card').map(card=>{
    const productColors={},packagingColors={};
    card.querySelectorAll('.batch-variant-product').forEach(row=>{productColors[row.dataset.pid]=row.querySelector('.batch-variant-product-color')?.value||''});
    card.querySelectorAll('.batch-variant-packaging-item').forEach(row=>{packagingColors[row.dataset.vid]=row.querySelector('.batch-variant-packaging-color')?.value||''});
    return{key:card.dataset.key||crypto.randomUUID(),name:card.querySelector('.batch-variant-name')?.value||'',productColors,packagingColors}
  })
}
function refreshBatchVariantProducts(){
  const current=collectBatchVariants();
  renderBatchVariants(current);
  $$('#batchVariantRows .batch-variant-card').forEach(card=>applyBatchVariantMainColor(card))
}
function collectBatchDraft(){
  const items=$$('#batchItemRows .batch-product-row').map(r=>{
    const product=r.querySelector('.batch-product'),qty=r.querySelector('.batch-qty');
    return product?{pid:product.value,qty:Math.max(1,num(qty?.value,1))}:null
  }).filter(i=>i&&i.pid);
  const packagingItems=$$('#batchPackagingRows .batch-packaging-row').map(r=>{
    const packaging=r.querySelector('.batch-packaging'),qty=r.querySelector('.batch-packaging-qty');
    return packaging?{vid:packaging.value,qty:Math.max(0.001,num(qty?.value,1))}:null
  }).filter(i=>i&&i.vid);
  return{
    key:$('#batchKey').value||crypto.randomUUID(),
    bid:$('#batchBid').value,
    name:$('#batchName').value.trim(),
    status:$('#batchStatus').value,
    items,
    packagingItems,
    saleVariants:collectBatchVariants(),
    targetMargin:30,
    targetProfit:num($('#batchTargetProfit').value,5),
    autoTargetProfit:$('#batchAutoTargetProfit').checked,
    salePrice:num($('#batchSalePrice').value),
    useOffsite:$('#batchUseOffsite').checked,
    useCurrency:$('#batchUseCurrency').checked,
    useSetup:$('#batchUseSetup').checked,
    laborMinutes:num($('#batchLaborMinutes')?.value),
    hourlyRate:num($('#batchHourlyRate')?.value),
    outboundShipping:num($('#batchOutboundShipping')?.value),
    adCost:num($('#batchAdCost')?.value),
    riskPct:num($('#batchRiskPct')?.value),
    returnsPct:Math.max(0,num($('#batchReturnsPct')?.value)),
    discountPct:Math.max(0,num($('#batchDiscountPct')?.value)),
    postTripShare:Math.max(0,num($('#batchPostTripShare')?.value,1)),
    fixedAllocation:num($('#batchFixedAllocation')?.value),
    notes:$('#batchNotes').value.trim()
  }
}
function renderBatchProfitProjection(profitPerBatch){
  const el=$('#batchProfitProjection');if(!el)return;
  const quantities=[1,5,10,25,50,100],
    profit=num(profitPerBatch);
  el.innerHTML=quantities.map(q=>`<div class="batch-profit-projection-card">
    <div class="qty">${q} Batch${q===1?'':'es'}</div>
    <div class="profit ${profit>=0?'positive':'negative'}">${euro(profit*q)}</div>
  </div>`).join('')
}

function liveBatchCalc(){
  const b=collectBatchDraft(),c=batchCalc(b);

  $$('#batchItemRows .batch-product-row').forEach(r=>{
    const productSelect=r.querySelector('.batch-product'),
      qtyInput=r.querySelector('.batch-qty'),
      costEl=r.querySelector('.batch-line-cost');
    if(!productSelect||!costEl)return;
    const x=state.products.find(p=>p.pid===productSelect.value),
      q=Math.max(1,num(qtyInput?.value,1));
    costEl.textContent=euro(x?productPurchaseCost(x)*q:0)
  });

  $$('#batchPackagingRows .batch-packaging-row').forEach(r=>{
    const packagingSelect=r.querySelector('.batch-packaging'),
      qtyInput=r.querySelector('.batch-packaging-qty'),
      costEl=r.querySelector('.batch-packaging-line-cost');
    if(!packagingSelect||!costEl)return;
    const x=state.packaging.find(v=>v.vid===packagingSelect.value),s=preferredPackagingSupplier(x),
      q=Math.max(0.001,num(qtyInput?.value,1)),unitEl=r.querySelector('.batch-packaging-unit');
    if(unitEl)unitEl.textContent=s?.priceType==='consumable'?(s.consumptionUnit||'Einheit'):'Stk.';
    if(qtyInput){qtyInput.step=s?.priceType==='consumable'?'0.01':'1';qtyInput.min=s?.priceType==='consumable'?'0.001':'1'}
    costEl.textContent=euro(x?packagingPurchaseCost(x)*q:0)
  });

  $('#batchProductsCost').textContent=euro(c.productCost);
  $('#batchPackagingCostLive').textContent=euro(c.packagingCost);
  $('#batchTotalCost').textContent=euro(c.total);
  $('#batchFeesLive').textContent=euro(c.fees);
  $('#batchDb1Live').textContent=euro(c.db1);
  $('#batchLaborCostLive').textContent=euro(c.laborCost);
  $('#batchOutboundShippingLive').textContent=euro(c.outboundShipping);
  $('#batchRiskAdsLive').textContent=euro(c.adCost+c.riskCost);
  $('#batchReturnsCostLive').textContent=euro(c.returnsCost);
  $('#batchDiscountCostLive').textContent=euro(c.discountCost);
  $('#batchPostTripCostLive').textContent=euro(c.postTripCost);
  $('#batchDb2Live').textContent=euro(c.db2);
  $('#batchFixedAllocationLive').textContent=euro(c.fixedAllocation);
  $('#batchProfitLive').textContent=euro(c.profit);
  renderBatchProfitProjection(c.profit);
  $('#batchMarginLive').textContent=pct(c.margin);
  $('#batchRecommended').textContent=euro(c.recommended);
  const tp=$('#batchTargetProfit'),auto=$('#batchAutoTargetProfit'),hint=$('#batchTargetProfitHint');
  if(tp&&auto){tp.disabled=auto.checked;if(auto.checked)tp.value=c.targetProfit.toFixed(2)}
  if(hint)hint.textContent=auto?.checked?`Automatisch: ${c.targetLabel} · Zielgewinn beim empfohlenen VK: ${euro(c.targetProfit)}`:'Eigener Zielgewinn wird zusätzlich zu allen Kosten und deiner Arbeitsentlohnung eingerechnet.';

  try{renderBatchProductionPlan(b)}catch(err){console.error('Batch-Plan:',err)}
  if($('#batchKey').value&&typeof renderBatchAssistant==='function'){
    try{renderBatchAssistant(b)}catch(err){console.error('Batch-Assistent:',err)}
  }
}
function openBatch(key=null){
  const dlg=$('#batchDialog');
  const b=key?state.batches.find(x=>x.key===key):null;
  if(key&&!b)return false;
  if(dlg.open)dlg.close();
  $('#batchItemRows').innerHTML='';
  $('#batchPackagingRows').innerHTML='';
  $('#batchKey').value=b?.key||'';$('#batchBid').value=b?.bid||'';$('#batchBidLabel').textContent=b?.bid||'BID wird beim Speichern vergeben';$('#batchModalTitle').textContent=b?'Batch bearbeiten':'Neuer Batch';$('#batchName').value=b?.name||'';$('#batchStatus').value=b?.status||'idea';renderBatchItemRows(b?.items||[]);renderBatchPackagingRows(b?.packagingItems||[]);renderBatchVariants(b?.saleVariants||[]);$('#batchTargetProfit').value=b?.targetProfit??5;$('#batchAutoTargetProfit').checked=b?.autoTargetProfit!==false;$('#batchTargetProfit').disabled=$('#batchAutoTargetProfit').checked;$('#batchSalePrice').value=b?.salePrice??0;$('#batchUseOffsite').checked=!!b?.useOffsite;$('#batchUseCurrency').checked=!!b?.useCurrency;$('#batchUseSetup').checked=!!b?.useSetup;$('#batchLaborMinutes').value=b?.laborMinutes??0;$('#batchHourlyRate').value=b?.hourlyRate??0;$('#batchOutboundShipping').value=b?.outboundShipping??0;$('#batchAdCost').value=b?.adCost??0;$('#batchRiskPct').value=b?.riskPct??0;$('#batchReturnsPct').value=b?.returnsPct??0;$('#batchDiscountPct').value=b?.discountPct??0;$('#batchPostTripShare').value=b?.postTripShare??1;$('#batchFixedAllocation').value=b?.fixedAllocation??0;$('#batchNotes').value=b?.notes||'';$('#deleteBatchBtn').classList.toggle('hidden',!b);
  liveBatchCalc();
  dlg.showModal();
  if(b&&typeof renderBatchAssistant==='function'){try{renderBatchAssistant(b)}catch(err){console.error('Batch-Assistent:',err)}}
  return true;
}
window.openBatch=openBatch;
