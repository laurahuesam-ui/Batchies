function renderAll(){renderOverview();renderProducts();renderPackaging();renderBatches();renderBatchSuggestions();renderSettings();renderInvestments();renderShoppingSimulation();try{if(typeof renderInventorySimulation==='function')renderInventorySimulation()}catch(err){console.error('Lager-Simulation:',err)}try{if(typeof initSalesSimulation==='function')initSalesSimulation()}catch(err){console.error('Verkaufs-Simulation:',err)}try{if(typeof renderWarehouse==='function')renderWarehouse()}catch(err){console.error('Echtes Lager:',err)}try{if(typeof renderSales==='function')renderSales()}catch(err){console.error('Verkäufe:',err)}}
function productIsCalculable(p){
  const s=(p?.suppliers||[]).find(x=>x.preferred)||(p?.suppliers||[])[0];
  if(!s)return false;
  const unit=supplierLandedUnitCost(s);
  return Number.isFinite(unit)&&unit>0
}
function packagingIsCalculable(v){
  const s=(v?.suppliers||[]).find(x=>x.preferred)||(v?.suppliers||[])[0];
  if(!s)return false;
  const unit=supplierLandedUnitCost(s);
  return Number.isFinite(unit)&&unit>0
}
function batchIsCalculable(b){
  const products=(b.items||[]);
  const packaging=(b.packagingItems||[]);
  if(!products.length)return false;
  return products.every(i=>{
    const p=state.products.find(x=>x.pid===i.pid);
    return p&&productIsCalculable(p)
  })&&packaging.every(i=>{
    const v=state.packaging.find(x=>x.vid===i.vid);
    return v&&packagingIsCalculable(v)
  })
}
function overviewActualWarehouseValue(){
  return Array.isArray(state.realWarehouse)
    ? state.realWarehouse.reduce((a,x)=>a+num(x.paidTotal),0)
    : 0
}
function overviewActualWarehouseUnits(){
  return Array.isArray(state.realWarehouse)
    ? state.realWarehouse.reduce((a,x)=>a+num(x.qty),0)
    : 0
}
function overviewRealizedProfitForSale(s){
  const b=state.batches.find(x=>x.key===s.batchKey);
  if(!b)return{profit:num(s.revenue)-num(s.cogs),fees:0,labor:0,outbound:0,ads:0,risk:0,fixed:0};

  const qty=Math.max(0,num(s.qty,1)),
    price=Math.max(0,num(s.actualUnitPrice)),
    // Use the batch's current non-material selling-cost rules, but replace
    // calculated material with the ACTUAL warehouse COGS booked on this sale.
    c=batchCalc({...b,salePrice:price});

  return{
    profit:num(s.revenue)-num(s.cogs)-c.fees*qty-c.laborCost*qty-c.outboundShipping*qty-c.adCost*qty-c.riskCost*qty-c.returnsCost*qty-c.discountCost*qty-c.postTripCost*qty-c.fixedAllocation*qty,
    fees:c.fees*qty,
    labor:c.laborCost*qty,
    outbound:c.outboundShipping*qty,
    ads:c.adCost*qty,
    risk:c.riskCost*qty,
    fixed:c.fixedAllocation*qty
  }
}
function overviewActualSalesStats(){
  const sales=Array.isArray(state.salesHistory)?state.salesHistory:[],
    now=Date.now(),cut30=now-30*24*3600*1000;

  let profit=0,profit30=0,fees=0,labor=0,outbound=0,ads=0,risk=0,fixed=0;
  sales.forEach(x=>{
    const p=overviewRealizedProfitForSale(x),
      recent=new Date(x.soldAt).getTime()>=cut30;
    profit+=p.profit;
    if(recent)profit30+=p.profit;
    fees+=p.fees;labor+=p.labor;outbound+=p.outbound;ads+=p.ads;risk+=p.risk;fixed+=p.fixed
  });

  const count=sales.reduce((a,x)=>a+num(x.qty,1),0);
  return{
    count,
    orders:sales.length,
    revenue:sales.reduce((a,x)=>a+num(x.revenue),0),
    cogs:sales.reduce((a,x)=>a+num(x.cogs),0),
    last30:sales.filter(x=>new Date(x.soldAt).getTime()>=cut30).reduce((a,x)=>a+num(x.qty,1),0),
    profit,profit30,avgProfit:count>0?profit/count:0,
    fees,labor,outbound,ads,risk,fixed,
    latest:sales.slice().sort((a,b)=>new Date(b.soldAt)-new Date(a.soldAt)).slice(0,5)
  }
}
function overviewReorderRows(){
  try{
    if(typeof allocatedForecastRows!=='function'||typeof reorderPointFor!=='function')return[];
    return allocatedForecastRows().map(r=>{
      const stock=num(r.allocatedStock),
        point=num(reorderPointFor(r)),
        weeks=r.weekly>0?stock/r.weekly:Infinity;
      return{...r,stock,point,weeks,alert:stock<=point+1e-9}
    }).filter(x=>x.alert).sort((a,b)=>{
      const aw=Number.isFinite(a.weeks)?a.weeks:99999,bw=Number.isFinite(b.weeks)?b.weeks:99999;
      return aw-bw
    })
  }catch(err){console.error('Overview Nachbestellung:',err);return[]}
}
function overviewSellableVariants(){
  try{
    if(typeof realSaleVariantsForBatch!=='function')return{sellable:0,total:0};
    let sellable=0,total=0;
    (state.batches||[]).forEach(b=>{
      const vars=realSaleVariantsForBatch(b);
      vars.forEach(v=>{total++;if(num(v.capacity)>0)sellable++})
    });
    return{sellable,total}
  }catch(err){return{sellable:0,total:0}}
}
function renderOverviewLiveStats(){
  const el=$('#overviewLiveStats');if(!el)return;
  const stockValue=overviewActualWarehouseValue(),
    stockUnits=overviewActualWarehouseUnits(),
    lots=Array.isArray(state.realWarehouse)?state.realWarehouse.length:0,
    sales=overviewActualSalesStats(),
    reorder=overviewReorderRows(),
    variants=overviewSellableVariants(),
    gross=sales.revenue-sales.cogs,
    taxReserveRate=.25,
    taxReserve=Math.max(0,sales.profit)*taxReserveRate,
    profitAfterReserve=sales.profit-taxReserve,
    operatingCosts=sales.fees+sales.labor+sales.outbound+sales.ads+sales.risk+sales.fixed;

  const reorderHtml=reorder.length
    ? reorder.slice(0,8).map(x=>`<div class="overview-alert-row">
        <span><span class="idchip">${esc(x.id)}</span></span>
        <span><strong>${esc(typeof warehouseItemName==='function'?warehouseItemName(x.kind,x.id):x.id)}</strong>${x.color?` · ${esc(x.color)}`:''}<div class="why">Bestand ${x.stock.toFixed(1)} · Nachbestellpunkt ${x.point.toFixed(1)}${Number.isFinite(x.weeks)?` · reicht ca. ${x.weeks.toFixed(1)} Wo.`:''}</div></span>
        <span class="overview-action-badge bad">Nachbestellen</span>
      </div>`).join('')
    : '<div class="info"><strong>Aktuell kein Nachbestellbedarf erkannt.</strong></div>';

  const salesHtml=sales.latest.length
    ? sales.latest.map(x=>`<div class="overview-sale-row">
        <span>${new Date(x.soldAt).toLocaleDateString('de-DE')}</span>
        <span><strong>${esc(x.bid||'Batch')}</strong>${x.color?` · ${esc(x.color)}`:''} · ${num(x.qty,1)}×</span>
        <strong>${euro(x.revenue)}</strong>
      </div>`).join('')
    : '<div class="muted">Noch keine echten Verkäufe gebucht.</div>';

  el.innerHTML=`<div class="overview-live-kpis">
    <div class="overview-live-kpi"><div class="label">Echter Lagerwert</div><div class="value">${euro(stockValue)}</div><div class="sub">${lots} Lagerpositionen · ${stockUnits.toLocaleString('de-DE')} Einheiten</div></div>
    <div class="overview-live-kpi"><div class="label">Verkäufe gesamt</div><div class="value">${sales.count.toLocaleString('de-DE')}</div><div class="sub">${sales.orders} Buchungen · letzte 30 Tage: ${sales.last30.toLocaleString('de-DE')}</div></div>
    <div class="overview-live-kpi"><div class="label">Umsatz brutto</div><div class="value">${euro(sales.revenue)}</div><div class="sub">tatsächlich gebuchter Verkaufserlös</div></div>

    <div class="overview-live-kpi"><div class="label">− Warenwert</div><div class="value">${euro(sales.cogs)}</div><div class="sub">tatsächlicher Lager-EK der Verkäufe</div></div>
    <div class="overview-live-kpi"><div class="label">Rohertrag</div><div class="value ${gross>=0?'positive':'negative'}">${euro(gross)}</div><div class="sub">Umsatz − Warenwert · vor Verkaufskosten</div></div>
    <div class="overview-live-kpi"><div class="label">− Weitere Verkaufskosten</div><div class="value">${euro(operatingCosts)}</div><div class="sub">Etsy, Arbeit, Versand, Werbung, Risiko & Fixkosten</div></div>

    <div class="overview-live-kpi profit-kpi"><div class="label">Gewinn vor Einkommensteuer</div><div class="value ${sales.profit>=0?'positive':'negative'}">${euro(sales.profit)}</div><div class="sub">realisierter betrieblicher Gewinn</div></div>
    <div class="overview-live-kpi"><div class="label">Empf. Steuerrücklage</div><div class="value">${euro(taxReserve)}</div><div class="sub">25 % vom positiven Gewinn · nur Planungsrücklage</div></div>
    <div class="overview-live-kpi profit-kpi"><div class="label">Nach Steuerrücklage</div><div class="value ${profitAfterReserve>=0?'positive':'negative'}">${euro(profitAfterReserve)}</div><div class="sub">Gewinn abzüglich 25-%-Planungsrücklage</div></div>

    <div class="overview-live-kpi"><div class="label">Gewinn letzte 30 Tage</div><div class="value ${sales.profit30>=0?'positive':'negative'}">${euro(sales.profit30)}</div><div class="sub">vor Einkommensteuer · ${sales.last30.toLocaleString('de-DE')} verkaufte Batches</div></div>
    <div class="overview-live-kpi"><div class="label">Ø Gewinn / Batch</div><div class="value ${sales.avgProfit>=0?'positive':'negative'}">${euro(sales.avgProfit)}</div><div class="sub">vor Einkommensteuer · realisierter Durchschnitt</div></div>
    <div class="overview-live-kpi"><div class="label">Direkt lieferbare Varianten</div><div class="value">${variants.sellable} / ${variants.total}</div><div class="sub">aus dem echten Lager</div></div>
  </div>
  <div class="overview-profit-breakdown">
    <span><strong>Gewinnweg:</strong></span>
    <span>Umsatz ${euro(sales.revenue)}</span>
    <span>− Waren-EK ${euro(sales.cogs)}</span>
    <span>= Rohertrag ${euro(gross)}</span>
    <span>− Etsy ${euro(sales.fees)}</span>
    <span>− Arbeit ${euro(sales.labor)}</span>
    <span>− Kundenversand ${euro(sales.outbound)}</span>
    <span>− Werbung/Risiko ${euro(sales.ads+sales.risk)}</span>
    <span>− Fixkosten ${euro(sales.fixed)}</span>
    <span>= <strong>vor Steuer ${euro(sales.profit)}</strong></span>
    <span>− Rücklage ${euro(taxReserve)}</span>
    <span>= <strong class="${profitAfterReserve>=0?'positive':'negative'}">nach Rücklage ${euro(profitAfterReserve)}</strong></span>
  </div>
  <div class="tiny" style="margin:6px 0 12px">Die 25-%-Steuerrücklage ist eine vorsichtige Planungsgröße und keine berechnete Einkommensteuer. Die tatsächliche Einkommensteuer hängt von deinem gesamten steuerpflichtigen Jahreseinkommen ab.</div>
  <div class="overview-live-grid">
    <div class="overview-live-section"><h3>Nachbestellen & Engpässe ${reorder.length?`(${reorder.length})`:''}</h3><div class="overview-alert-list">${reorderHtml}</div>${reorder.length>8?`<div class="tiny" style="margin-top:6px">+ ${reorder.length-8} weitere Positionen im Reiter Verkäufe.</div>`:''}</div>
    <div class="overview-live-section"><h3>Letzte echte Verkäufe</h3><div class="overview-sales-list">${salesHtml}</div></div>
  </div>`
}
function renderOverview(){
  const ps=state.products||[],bs=state.batches||[];
  const productCalcCount=ps.filter(productIsCalculable).length;
  const batchCalcCount=bs.filter(batchIsCalculable).length;

  $('#kpiProducts').textContent=ps.length;
  $('#kpiBatches').textContent=bs.length;
  $('#kpiReady').textContent=ps.filter(p=>p.status==='ready').length+' verkaufsbereit';
  $('#kpiBatchesReady').textContent=bs.filter(b=>b.status==='ready').length+' verkaufsbereit';
  $('#kpiProductsCalc').textContent=productCalcCount+' / '+ps.length;
  $('#kpiProductsCalcSub').textContent=(ps.length-productCalcCount)+' noch unvollständig';
  $('#kpiBatchesCalc').textContent=batchCalcCount+' / '+bs.length;
  $('#kpiBatchesCalcSub').textContent=(bs.length-batchCalcCount)+' noch unvollständig';

  renderOverviewLiveStats();

  const el=$('#overviewProducts');
  if(!ps.length){
    el.innerHTML='<div class="empty"><strong>Noch keine Produkte</strong>Lege dein erstes Produkt an.</div>'
  }else{
    el.innerHTML='<div class="table-wrap"><table><thead><tr><th>ID</th><th>Produkt</th><th>Status</th><th>Kosten</th><th>VK</th><th>Marge</th></tr></thead><tbody>'+
      ps.slice(-6).reverse().map(p=>{const c=calcProduct(p);return `<tr><td><span class="idchip">${esc(p.pid)}</span></td><td><div class="name">${esc(p.name)}</div>${productColorDots(p.colors,true)}</td><td><span class="badge ${p.status}">${statusLabel(p.status)}</span></td><td class="money">${euro(c.costs)}</td><td class="money">${euro(p.salePrice)}</td><td>${pct(c.margin)}</td></tr>`}).join('')+
      '</tbody></table></div>'
  }

  const bel=$('#overviewBatches');
  if(!bs.length){
    bel.innerHTML='<div class="empty"><strong>Noch keine Batches</strong>Lege deinen ersten Batch an.</div>';
    return
  }
  bel.innerHTML='<div class="table-wrap"><table class="overview-batch-table"><thead><tr>'+
    '<th class="ob-id">BID</th><th class="ob-name">Batch</th><th class="ob-status">Status</th><th class="ob-products">Produkte</th><th class="ob-vid">VID</th><th class="ob-ek">EK</th><th class="ob-vk">Empf. VK</th><th class="ob-ak">1. AK</th>'+
    '</tr></thead><tbody>'+
    bs.slice().sort((a,b)=>parseIdNumber(a.bid,'BID')-parseIdNumber(b.bid,'BID')).map(b=>{
      const c=batchCalc(b),plan=batchProductionPlan(b);
      return `<tr>
        <td class="ob-id"><span class="idchip">${esc(b.bid)}</span></td>
        <td class="ob-name"><div class="name">${esc(b.name)}</div>${typeof batchVariantDots==='function'?batchVariantDots(b,true):''}</td>
        <td class="ob-status"><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
        <td class="ob-products"><div class="batch-products-list">${(b.items||[]).map(i=>esc(i.pid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="ob-vid"><div class="batch-vid-list">${(b.packagingItems||[]).map(i=>esc(i.vid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="money ob-ek">${euro(c.total)}</td>
        <td class="money positive ob-vk">${euro(c.recommended)}</td>
        <td class="money ob-ak">${euro(plan.firstOrderCost)}</td>
      </tr>`
    }).join('')+
    '</tbody></table></div>'
}
function renderSettings(){const s=state.settings;['listingFee','transactionPct','paymentPct','paymentFixed','offsitePct','currencyPct','feeVatPct','setupFee','setupSales'].forEach(k=>{const e=$('#'+k);if(e&&document.activeElement!==e)e.value=s[k]});$('#setupPerSale').textContent=euro(s.setupSales>0?s.setupFee/s.setupSales:0)}
$$('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.go)));function switchTab(t){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));$$('.tabpage').forEach(p=>p.classList.add('hidden'));$('#tab-'+t).classList.remove('hidden');if(t==='simulation'){if(typeof renderInventorySimulation==='function'){try{renderInventorySimulation()}catch(err){console.error('Lager-Simulation öffnen:',err)}}if(typeof initSalesSimulation==='function'){try{initSalesSimulation()}catch(err){console.error('Verkaufs-Simulation öffnen:',err)}}}}
initColorFilter();$('#addProductBtn').onclick=()=>openProduct();
$('#productsTable').addEventListener('click',e=>{
  const btn=e.target.closest('.product-edit-btn');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  const key=btn.dataset.key;
  if(key)openProduct(key);
});$('#addPackagingBtn').onclick=()=>openPackaging();$('#addBatchBtn').onclick=()=>openBatch();
$('#batchesTable').addEventListener('click',e=>{
  const btn=e.target.closest('.batch-edit-btn');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  const key=btn.dataset.key;
  if(key)openBatch(key);
});$('#searchProducts').oninput=renderProducts;$('#filterProductStatus').onchange=renderProducts;$('#filterProductBatch').onchange=renderProducts;$('#filterProductColor').onchange=renderProducts;$('#searchPackaging').oninput=renderPackaging;$('#searchBatches').oninput=renderBatches;const refreshSuggestions=$('#refreshBatchSuggestionsBtn');if(refreshSuggestions)refreshSuggestions.onclick=renderBatchSuggestions;
$('#addSupplierBtn').onclick=()=>{const has=$$('#supplierRows .supplier-row').length;$('#supplierRows').insertAdjacentHTML('beforeend',supplierRowHtml({id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',paymentFeePct:0,vatRate:0,vatIncluded:false,customs:false,preferred:!has,priceTiers:[],shippingPoints:[]}));const nr=$$('.supplier-row').at(-1);if(nr)renderSupplierTierData(nr,{priceTiers:[],shippingPoints:[]});bindSupplierEvents();liveCalc()};
$('#usePreferredPriceBtn').onclick=()=>{const s=preferredSupplier();if(s){$('#productBasePrice').value=supplierUnitPrice(s).toFixed(2);if(!$('#productImageUrl').value&&s.imageUrl){$('#productImageUrl').value=s.imageUrl;renderImagePreview(s.imageUrl)}liveCalc()}};
$('#addCostBtn').onclick=()=>{$('#costRows').insertAdjacentHTML('beforeend','<div class="cost-row"><input class="cost-name" placeholder="Kostenposition"><input class="cost-amount" type="number" min="0" step="0.01" value="0"><button type="button" class="iconbtn remove-cost">✕</button></div>');bindCostEvents();liveCalc()};
['productBasePrice','shippingCost','shippingCharged','targetMargin','salePrice','useOffsite','useCurrency','useSetup'].forEach(id=>$('#'+id).addEventListener('input',liveCalc));$('#useRecommendedBtn').onclick=()=>{$('#salePrice').value=calcProduct(collectProductDraft()).recommended.toFixed(2);liveCalc()};
$('#applyImageUrlBtn').onclick=()=>{draftImageData='';renderImagePreview($('#productImageUrl').value.trim())};$('#detectColorsBtn').onclick=detectProductColors;$('#tryAutoImageBtn').onclick=tryAutoImage;$('#productImageFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{draftImageData=await resizeImage(f);$('#productImageUrl').value='';renderImagePreview(draftImageData)}catch{alert('Das Bild konnte nicht verarbeitet werden.')}e.target.value=''};$('#removeImageBtn').onclick=()=>{draftImageData='';$('#productImageUrl').value='';renderImagePreview('')};
$('#productCategory').addEventListener('change',()=>{setCategoryOptions($('#productCategory').value,'');$('#productCategory').dataset.auto='';$('#productSubcategory').dataset.auto='';showCategorySuggestion(false)});$('#productSubcategory').addEventListener('change',()=>{$('#productCategory').dataset.auto='';$('#productSubcategory').dataset.auto='';showCategorySuggestion(false)});$('#productName').addEventListener('input',()=>showCategorySuggestion(true));$('#productNotes').addEventListener('input',()=>showCategorySuggestion(true));document.addEventListener('input',e=>{if(e.target.classList?.contains('supplier-url'))showCategorySuggestion(true)});
$$('.close-product-dialog,.cancel-product-dialog').forEach(b=>b.addEventListener('click',()=>$('#productDialog').close()));
$$('.close-batch-dialog,.cancel-batch-dialog').forEach(b=>b.addEventListener('click',()=>$('#batchDialog').close()));
$$('.close-packaging-dialog,.cancel-packaging-dialog').forEach(b=>b.addEventListener('click',()=>$('#packagingDialog').close()));
$('#addPackagingSupplierBtn').onclick=()=>{
  const has=$$('.packaging-supplier-row').length;
  $('#packagingSupplierRows').insertAdjacentHTML('beforeend',packagingSupplierRowHtml({id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',paymentFeePct:0,vatRate:0,vatIncluded:false,customs:false,preferred:!has}));
  bindPackagingSupplierEvents();
};
function persistBatchiesState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function reportSaveError(area,err){console.error(area+' speichern fehlgeschlagen:',err);alert(area+' konnte nicht gespeichert werden. Vorhandene Stammdaten bleiben erhalten. Fehler: '+(err?.message||err))}
$('#packagingForm').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const v=collectPackagingDraft();
    if(!v.name){$('#packagingName').focus();return}
    if(!v.vid){state.counters.packaging++;v.vid=displayId('VID',state.counters.packaging)}
    const i=state.packaging.findIndex(x=>x.key===v.key);
    if(i>=0)state.packaging[i]=v;else state.packaging.push(v);
    persistBatchiesState();
    const dlg=$('#packagingDialog');if(dlg.open)dlg.close();
    setTimeout(()=>renderAll(),0);
  }catch(err){reportSaveError('Verpackungsmaterial',err)}
});
$('#deletePackagingBtn').onclick=()=>{
  const key=$('#packagingKey').value;
  if(key&&confirm('Verpackungsmaterial wirklich löschen?')){
    state.packaging=state.packaging.filter(v=>v.key!==key);
    saveState();
    $('#packagingDialog').close();
  }
};
$('#productForm').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const p=collectProductDraft();
    if(!p.name){$('#productName').focus();return}
    if(!p.pid){state.counters.product++;p.pid=displayId('PID',state.counters.product)}
    const i=state.products.findIndex(x=>x.key===p.key);
    if(i>=0)state.products[i]=p;else state.products.push(p);
    if(p.category&&p.subcategory)learnCategory(p);
    persistBatchiesState();
    const dlg=$('#productDialog');if(dlg.open)dlg.close();
    setTimeout(()=>renderAll(),0);
  }catch(err){reportSaveError('Produkt',err)}
});
$('#deleteProductBtn').onclick=()=>{const key=$('#productKey').value;if(key&&confirm('Produkt wirklich löschen? Verknüpfungen in Batches bleiben als PID sichtbar, können aber nicht mehr kalkuliert werden.')){state.products=state.products.filter(p=>p.key!==key);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));if($('#productDialog').open)$('#productDialog').close();setTimeout(()=>renderAll(),0)}};
$('#addBatchItemBtn').onclick=()=>{const opts='<option value="">Produkt wählen …</option>'+state.products.map(p=>`<option value="${esc(p.pid)}">${esc(p.pid)} · ${esc(p.name)}</option>`).join('');$('#batchItemRows').insertAdjacentHTML('beforeend',`<div class="batch-product-row"><select class="batch-product">${opts}</select><input class="batch-qty" type="number" min="1" step="1" value="1"><div class="money batch-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-item">✕</button></div>`);bindBatchItemEvents();liveBatchCalc()};
$('#addBatchVariantBtn').onclick=()=>addBatchVariantRow();
$('#addBatchPackagingBtn').onclick=()=>{const opts='<option value="">Verpackung wählen …</option>'+state.packaging.map(v=>`<option value="${esc(v.vid)}">${esc(v.vid)} · ${esc(v.name)}</option>`).join('');$('#batchPackagingRows').insertAdjacentHTML('beforeend',`<div class="batch-packaging-row"><select class="batch-packaging">${opts}</select><div class="batch-packaging-usage-wrap"><input class="batch-packaging-qty" type="number" min="0.001" step="0.01" value="1"><span class="batch-packaging-unit">Stk.</span></div><div class="money batch-packaging-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-packaging">✕</button></div>`);bindBatchPackagingEvents();liveBatchCalc()};
['batchTargetProfit','batchAutoTargetProfit','batchSalePrice','batchUseOffsite','batchUseCurrency','batchUseSetup','batchLaborMinutes','batchHourlyRate','batchOutboundShipping','batchAdCost','batchRiskPct','batchReturnsPct','batchDiscountPct','batchPostTripShare','batchFixedAllocation'].forEach(id=>$('#'+id)?.addEventListener('input',liveBatchCalc));$('#batchUseRecommendedBtn').onclick=()=>{$('#batchSalePrice').value=batchCalc(collectBatchDraft()).recommended.toFixed(2);liveBatchCalc()};
$('#batchItemRows').addEventListener('change',()=>setTimeout(refreshBatchVariantProducts,0));$('#batchItemRows').addEventListener('click',e=>{if(e.target.closest('.remove-batch-item'))setTimeout(refreshBatchVariantProducts,0)});
$('#batchForm').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const b=collectBatchDraft();
    b.items=sortBatchItemsByPid(b.items);
    b.packagingItems=sortBatchPackagingByVid(b.packagingItems);
    if(!b.name){$('#batchName').focus();return}
    if(!b.bid){state.counters.batch++;b.bid=displayId('BID',state.counters.batch)}
    const i=state.batches.findIndex(x=>x.key===b.key);
    if(i>=0)state.batches[i]=b;else state.batches.push(b);
    persistBatchiesState();
    const dlg=$('#batchDialog');if(dlg.open)dlg.close();
    setTimeout(()=>renderAll(),0);
  }catch(err){reportSaveError('Batch',err)}
});
$('#deleteBatchBtn').onclick=()=>{
  const key=$('#batchKey').value;
  if(key&&confirm('Batch wirklich löschen?')){
    state.batches=state.batches.filter(b=>b.key!==key);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    const dlg=$('#batchDialog');
    if(dlg.open)dlg.close();
    setTimeout(()=>{renderBatches();try{renderOverview()}catch(err){console.error('Dashboard:',err)}},0);
  }
};
['listingFee','transactionPct','paymentPct','paymentFixed','offsitePct','currencyPct','feeVatPct','setupFee','setupSales'].forEach(k=>$('#'+k).addEventListener('input',e=>{state.settings[k]=num(e.target.value,defaultState.settings[k]);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderOverview();$('#setupPerSale').textContent=euro(state.settings.setupSales>0?state.settings.setupFee/state.settings.setupSales:0)}));
$('#productsCsvBtn').onclick=exportProductsCsv;$('#packagingCsvBtn').onclick=exportPackagingCsv;$('#batchesCsvBtn').onclick=exportBatchesCsv;$('#exportBackupBtn').onclick=exportBackup;$('#dataBackupBtn').onclick=exportBackup;$('#importBackupBtn').onclick=()=>$('#backupFile').click();$('#dataImportBtn').onclick=()=>$('#backupFile').click();$('#backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const rawText=(await f.text()).replace(/^\uFEFF/,'');const x=JSON.parse(rawText);if(!Array.isArray(x.products))throw Error();state={...structuredClone(defaultState),...x,settings:{...defaultState.settings,...x.settings},counters:{...defaultState.counters,...x.counters},categoryLearning:{...defaultState.categoryLearning,...x.categoryLearning}};migrateState(state);saveState();alert('Batchies-Backup wurde importiert.')}catch{alert('Ungültiges Batchies-Backup.')}e.target.value=''};

function jointFirstOrderForAllBatches(){
  const pr=new Map(),vr=new Map();state.batches.forEach(b=>{(b.items||[]).forEach(i=>pr.set(i.pid,(pr.get(i.pid)||0)+Math.max(1,num(i.qty,1))));(b.packagingItems||[]).forEach(i=>vr.set(i.vid,(vr.get(i.vid)||0)+Math.max(1,num(i.qty,1))))});
  let totalCost=0,missingSupplier=false;const lines=[];
  const add=(id,needed,x,type)=>{const s=simulationPreferredSupplier(x);if(!x||!s){missingSupplier=true;lines.push({id,name:x?.name||(type==='Verpackung'?'Verpackung fehlt':'Produkt fehlt'),needed,ordered:0,packs:0,cost:0,missing:true,type});return}const packQty=simulationPackageQty(s),packs=Math.max(1,Math.ceil(needed/packQty)),ordered=packQty*packs,cost=supplierOrderCost(s)*packs;totalCost+=cost;lines.push({id,name:x.name,needed,ordered,packs,cost,missing:false,type})};
  [...pr.entries()].sort((a,b)=>parseIdNumber(a[0],'PID')-parseIdNumber(b[0],'PID')).forEach(([id,n])=>add(id,n,state.products.find(x=>x.pid===id),'Produkt'));
  [...vr.entries()].sort((a,b)=>parseIdNumber(a[0],'VID')-parseIdNumber(b[0],'VID')).forEach(([id,n])=>add(id,n,state.packaging.find(x=>x.vid===id),'Verpackung'));
  return{lines,totalCost,missingSupplier}
}
function renderInvestments(){
  const body=$('#investmentsBody'),sumEl=$('#investmentsSum'),batchBody=$('#investmentBatchesBody'),batchSumEl=$('#batchOrdersSum'),grandEl=$('#investmentsGrandTotal');if(!body)return;
  state.investments=Array.isArray(state.investments)?state.investments:[];
  body.innerHTML=state.investments.length?state.investments.map(x=>{const href=safeUrl(x.url||'');return `<tr data-key="${esc(x.key)}"><td><input class="investment-type" value="${esc(x.type||'')}" placeholder="z. B. Gewerbeanmeldung, Drucker, Verpackung"></td><td><div class="investment-url-wrap"><input class="investment-url" type="url" value="${esc(x.url||'')}" placeholder="https://…" aria-label="URL der Investition" title="URL der Investition"><a class="iconbtn investment-open-url${href==='#'?' hidden':''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="URL öffnen">↗</a></div></td><td><input class="investment-cost" type="number" min="0" step="0.01" value="${num(x.cost)}"></td><td><button type="button" class="iconbtn investment-remove" title="Investition löschen">✕</button></td></tr>`}).join(''):`<tr><td colspan="4" class="muted">Noch keine Investitionen eingetragen.</td></tr>`;
  const invTotal=state.investments.reduce((a,x)=>a+num(x.cost),0);sumEl.textContent=euro(invTotal);
  const joint=jointFirstOrderForAllBatches();
  batchBody.innerHTML=joint.lines.length?joint.lines.map(x=>`<tr><td><span class="idchip">${esc(x.id)}</span></td><td><div class="name">${esc(x.name)}</div><div class="tiny">${esc(x.type)}</div></td><td>${x.needed} Stk.</td><td>${x.missing?'–':x.ordered+' Stk.'}${x.packs>1?` <span class="tiny">(${x.packs} Bestellungen)</span>`:''}</td><td class="money">${x.missing?'–':euro(x.cost)}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">Noch keine Produkte oder Verpackungsmaterialien in Batches vorhanden.</td></tr>`;
  batchSumEl.textContent=joint.missingSupplier?euro(joint.totalCost)+' + offen':euro(joint.totalCost);
  grandEl.textContent=joint.missingSupplier?euro(invTotal+joint.totalCost)+' + offen':euro(invTotal+joint.totalCost);
  $$('.investment-type,.investment-url,.investment-cost').forEach(el=>{el.oninput=()=>{const r=el.closest('tr'),x=state.investments.find(i=>i.key===r.dataset.key);if(!x)return;x.type=r.querySelector('.investment-type').value;x.url=r.querySelector('.investment-url').value.trim();x.cost=num(r.querySelector('.investment-cost').value);const open=r.querySelector('.investment-open-url'),href=safeUrl(x.url);if(open){open.href=href;open.classList.toggle('hidden',href==='#')}localStorage.setItem(STORAGE_KEY,JSON.stringify(state));const invTotal=state.investments.reduce((a,i)=>a+num(i.cost),0),joint=jointFirstOrderForAllBatches();$('#investmentsSum').textContent=euro(invTotal);$('#investmentsGrandTotal').textContent=joint.missingSupplier?euro(invTotal+joint.totalCost)+' + offen':euro(invTotal+joint.totalCost)}});
  $$('.investment-remove').forEach(b=>b.onclick=()=>{const key=b.closest('tr').dataset.key;state.investments=state.investments.filter(x=>x.key!==key);saveState()})
}

$('#addInvestmentBtn').onclick=()=>{state.investments.push({key:crypto.randomUUID(),type:'',url:'',cost:0});saveState()};const simulationReset=$('#simulationResetBtn');if(simulationReset)simulationReset.onclick=()=>{state.simulationSelectedBatches=[];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation()};const inventoryFirstOrderBtn=$('#inventoryUseFirstOrderBtn');if(inventoryFirstOrderBtn)inventoryFirstOrderBtn.onclick=()=>{if(typeof applyInventoryFirstOrder==='function')applyInventoryFirstOrder()};const inventorySelectedFirstOrderBtn=$('#inventoryUseSelectedSimulationBtn');if(inventorySelectedFirstOrderBtn)inventorySelectedFirstOrderBtn.onclick=()=>{if(typeof applyInventoryFromSelectedShoppingSimulation==='function')applyInventoryFromSelectedShoppingSimulation()};const inventoryZeroBtn=$('#inventoryZeroBtn');if(inventoryZeroBtn)inventoryZeroBtn.onclick=()=>{if(typeof clearInventorySimulationStock==='function')clearInventorySimulationStock()};const salesSimAddStageBtn=$('#salesSimAddStageBtn');if(salesSimAddStageBtn)salesSimAddStageBtn.onclick=()=>{if(typeof salesGrowthAddStage==='function')salesGrowthAddStage(false)};const salesSimSuggestBtn=$('#salesSimSuggestBtn');if(salesSimSuggestBtn)salesSimSuggestBtn.onclick=()=>{if(typeof salesGrowthAddStage==='function')salesGrowthAddStage(true)};
try{if(typeof bindWarehouseUi==='function')bindWarehouseUi()}catch(err){console.error('Lager UI:',err)};try{if(typeof bindSalesUi==='function')bindSalesUi()}catch(err){console.error('Verkaufs UI:',err)};try{if(typeof bindSalesPlanningUi==='function')bindSalesPlanningUi()}catch(err){console.error('Sales Planning UI:',err)};
renderAll();if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
