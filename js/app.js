function renderAll(){renderOverview();renderProducts();renderPackaging();renderBatches();renderBatchSuggestions();renderSettings();renderInvestments();renderShoppingSimulation();try{if(typeof renderInventorySimulation==='function')renderInventorySimulation()}catch(err){console.error('Lager-Simulation:',err)}try{if(typeof initSalesSimulation==='function')initSalesSimulation()}catch(err){console.error('Verkaufs-Simulation:',err)}}
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

  const s=state.settings;
  $('#feeRateSummary').textContent=(s.transactionPct+s.paymentPct).toFixed(2).replace('.',',')+' %';
  $('#feeFixedSummary').textContent=euro(s.listingFee+s.paymentFixed);
  $('#feeAdsSummary').textContent=s.offsitePct.toFixed(2).replace('.',',')+' %';
  $('#feeFxSummary').textContent=s.currencyPct.toFixed(2).replace('.',',')+' %';

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
        <td class="ob-name"><div class="name">${esc(b.name)}</div></td>
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
});$('#searchProducts').oninput=renderProducts;$('#filterProductStatus').onchange=renderProducts;$('#filterProductColor').onchange=renderProducts;$('#searchPackaging').oninput=renderPackaging;$('#searchBatches').oninput=renderBatches;const refreshSuggestions=$('#refreshBatchSuggestionsBtn');if(refreshSuggestions)refreshSuggestions.onclick=renderBatchSuggestions;
$('#addSupplierBtn').onclick=()=>{const has=$$('#supplierRows .supplier-row').length;$('#supplierRows').insertAdjacentHTML('beforeend',supplierRowHtml({id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',customs:false,preferred:!has,priceTiers:[],shippingPoints:[]}));const nr=$$('.supplier-row').at(-1);if(nr)renderSupplierTierData(nr,{priceTiers:[],shippingPoints:[]});bindSupplierEvents();liveCalc()};
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
  $('#packagingSupplierRows').insertAdjacentHTML('beforeend',packagingSupplierRowHtml({id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',customs:false,preferred:!has}));
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
$('#addBatchPackagingBtn').onclick=()=>{const opts='<option value="">Verpackung wählen …</option>'+state.packaging.map(v=>`<option value="${esc(v.vid)}">${esc(v.vid)} · ${esc(v.name)}</option>`).join('');$('#batchPackagingRows').insertAdjacentHTML('beforeend',`<div class="batch-packaging-row"><select class="batch-packaging">${opts}</select><div class="batch-packaging-usage-wrap"><input class="batch-packaging-qty" type="number" min="0.001" step="0.01" value="1"><span class="batch-packaging-unit">Stk.</span></div><div class="money batch-packaging-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-packaging">✕</button></div>`);bindBatchPackagingEvents();liveBatchCalc()};
['batchTargetProfit','batchAutoTargetProfit','batchSalePrice','batchUseOffsite','batchUseCurrency','batchUseSetup','batchLaborMinutes','batchHourlyRate','batchOutboundShipping','batchAdCost','batchRiskPct','batchFixedAllocation'].forEach(id=>$('#'+id)?.addEventListener('input',liveBatchCalc));$('#batchUseRecommendedBtn').onclick=()=>{$('#batchSalePrice').value=batchCalc(collectBatchDraft()).recommended.toFixed(2);liveBatchCalc()};
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

$('#addInvestmentBtn').onclick=()=>{state.investments.push({key:crypto.randomUUID(),type:'',url:'',cost:0});saveState()};const simulationReset=$('#simulationResetBtn');if(simulationReset)simulationReset.onclick=()=>{state.simulationSelectedBatches=[];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderShoppingSimulation()};const inventoryFirstOrderBtn=$('#inventoryUseFirstOrderBtn');if(inventoryFirstOrderBtn)inventoryFirstOrderBtn.onclick=()=>{if(typeof applyInventoryFirstOrder==='function')applyInventoryFirstOrder()};const inventorySelectedFirstOrderBtn=$('#inventoryUseSelectedSimulationBtn');if(inventorySelectedFirstOrderBtn)inventorySelectedFirstOrderBtn.onclick=()=>{if(typeof applyInventoryFromSelectedShoppingSimulation==='function')applyInventoryFromSelectedShoppingSimulation()};const inventoryZeroBtn=$('#inventoryZeroBtn');if(inventoryZeroBtn)inventoryZeroBtn.onclick=()=>{if(typeof clearInventorySimulationStock==='function')clearInventorySimulationStock()};
renderAll();if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
