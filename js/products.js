function productImage(p){const preferred=(p.suppliers||[]).find(x=>x.preferred);return preferred?.imageUrl||p.imageData||p.imageUrl||(p.suppliers||[]).find(x=>x.imageUrl)?.imageUrl||''}
function syncProductBatchFilter(){
  const sel=$('#filterProductBatch');if(!sel)return;
  const previous=sel.value||'';
  const batches=(state.batches||[]).slice().sort((a,b)=>{
    const an=parseIdNumber(a.bid,'BID'),bn=parseIdNumber(b.bid,'BID');
    return an-bn||String(a.name||'').localeCompare(String(b.name||''),'de')
  });
  sel.innerHTML='<option value="">Alle Batches</option>'+batches.map(b=>`<option value="${esc(b.key)}">${esc(b.bid)} · ${esc(b.name||'Ohne Namen')}</option>`).join('');
  sel.value=batches.some(b=>b.key===previous)?previous:''
}
function productIdsForBatchKey(batchKey){
  if(!batchKey)return null;
  const b=(state.batches||[]).find(x=>x.key===batchKey);
  if(!b)return new Set();
  return new Set((b.items||[]).map(i=>i.pid).filter(Boolean))
}
function renderProducts(){syncProductBatchFilter();const q=($('#searchProducts')?.value||'').toLowerCase().trim(),status=$('#filterProductStatus')?.value||'',color=$('#filterProductColor')?.value||'',batchKey=$('#filterProductBatch')?.value||'',batchPids=productIdsForBatchKey(batchKey),ps=state.products.filter(p=>(!status||p.status===status)&&(p.pid+' '+p.name+' '+(p.category||'')+' '+(p.subcategory||'')+' '+(p.notes||'')+' '+(p.suppliers||[]).map(s=>s.name+' '+s.url).join(' ')).toLowerCase().includes(q)&&(!color||(p.colors||[]).includes(color))&&(!batchPids||batchPids.has(p.pid))),el=$('#productsTable');if(!ps.length){el.innerHTML='<div class="empty"><strong>'+(state.products.length?'Keine Treffer':'Noch keine Produkte')+'</strong></div>';return}el.innerHTML='<div class="table-wrap"><table><thead><tr><th>ID</th><th>Bild</th><th>Produkt</th><th>Status</th><th>Lieferanten & URLs</th><th>Bestellwert</th><th>Kalk.-Preis</th><th>Empfehlung</th><th>VK</th><th>Gewinn</th><th>Marge</th><th></th></tr></thead><tbody>'+ps.map(p=>{const c=calcProduct(p),sup=p.suppliers||[],img=productImage(p),links=sup.filter(x=>x.url),preferred=sup.find(x=>x.preferred)||sup[0],order=preferred?supplierOrderCost(preferred):0;return `<tr><td><span class="idchip">${esc(p.pid)}</span></td><td>${img?`<img class="product-thumb" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;product-thumb-empty&quot;>kein Bild</div>'">`:'<div class="product-thumb-empty">kein Bild</div>'}</td><td><div class="name">${esc(p.name)}</div><div class="muted">${esc(p.category||'–')}${p.subcategory?' → '+esc(p.subcategory):''}</div>${productColorDots(p.colors,true)}</td><td><span class="badge ${p.status}">${statusLabel(p.status)}</span></td><td><div class="supplier-links">${links.length?links.map(x=>`<div class="supplier-link-row">${x.preferred?'<span class="star" title="Bevorzugter Lieferant">★</span>':''}<a class="link" href="${safeUrl(x.url)}" target="_blank" rel="noopener">${esc(x.name||'Website')} ↗</a><span class="price">${euro(supplierLandedUnitCost(x))}/Stk.</span></div>`).join(''):'<span class="muted">Keine URL hinterlegt</span>'}</div></td><td class="money">${preferred?euro(order):'–'}</td><td class="money">${euro(p.basePrice)}</td><td class="money">${euro(c.recommended)}</td><td class="money">${euro(p.salePrice)}</td><td class="money ${c.profit>=0?'positive':'negative'}">${euro(c.profit)}</td><td>${pct(c.margin)}</td><td><button type="button" class="iconbtn product-edit-btn" data-key="${esc(p.key)}" title="Produkt bearbeiten">✎</button></td></tr>`}).join('')+'</tbody></table></div>'}
function supplierRowHtml(s={}){const type=s.priceType==='set'?'set':'unit',unitIsSet=type==='unit'&&!!s.unitIsSet,unitSetQty=Math.max(1,num(s.unitSetQty,1)),qty=type==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1)),entry=type==='set'?num(s.setPrice,num(s.price)*qty):num(s.price),ship=num(s.totalShipping),effectiveQty=type==='set'?qty:(qty*(unitIsSet?unitSetQty:1)),baseOrder=type==='set'?entry+ship:entry*qty+ship,customs=baseOrder*(s.customs?.12:0),subtotal=baseOrder+customs,vat=s.vatIncluded?0:subtotal*Math.max(0,num(s.vatRate,0))/100,afterVat=subtotal+vat,paymentFee=afterVat*Math.max(0,num(s.paymentFeePct,0))/100,order=afterVat+paymentFee,unit=order/effectiveQty;return `<div class="supplier-row" data-id="${esc(s.id||crypto.randomUUID())}"><div class="supplier-grid"><div class="supplier-cell supplier-calc-active-cell"><span class="supplier-mini-label">Kalkulation</span><label class="supplier-calc-choice" title="Normale Lieferantenzeile für die Kalkulation verwenden"><input class="supplier-calc-source supplier-calc-main" type="radio" name="calc-${esc(s.id||'supplier')}" value="main"><span>●</span></label></div><div class="supplier-cell supplier-name-cell"><span class="supplier-mini-label">Lieferant</span><input class="supplier-name" value="${esc(s.name||'')}" placeholder="z. B. Alibaba"></div><div class="supplier-cell supplier-url-cell"><span class="supplier-mini-label">Produkt-URL</span><input class="supplier-url" type="url" value="${esc(s.url||'')}" placeholder="https://…"></div><div class="supplier-cell supplier-type-cell"><span class="supplier-mini-label">Preisart</span><select class="supplier-price-type"><option value="unit" ${type==='unit'?'selected':''}>Stückpreis</option><option value="set" ${type==='set'?'selected':''}>Setpreis</option></select></div><div class="supplier-cell supplier-unit-set-cell ${type==='unit'?'':'hidden'}"><span class="supplier-mini-label">Stückpreis als Set?</span><div class="supplier-unit-set-wrap"><label class="supplier-toggle supplier-unit-set-toggle" title="Lieferant verkauft mehrere Stück gemeinsam als Set/Packung; MOQ, Preisstaffeln und Versandmengen werden dann in Sets angegeben."><input class="supplier-unit-is-set" type="checkbox" ${unitIsSet?'checked':''}><span>Set</span></label><input class="supplier-unit-set-qty ${unitIsSet?'':'hidden'}" type="number" min="1" step="1" value="${unitSetQty}" placeholder="Stk./Set" title="Wie viele einzelne Stück enthält ein Set?"></div></div><div class="supplier-cell supplier-price-cell"><span class="supplier-mini-label supplier-price-label">${type==='set'?'Setpreis':unitIsSet?'Preis/Set':'Stückpreis'}</span><input class="supplier-price-entry" type="number" min="0" step="0.01" value="${entry}" placeholder="0,00"></div><div class="supplier-cell supplier-qty-cell"><span class="supplier-mini-label supplier-qty-label">${type==='set'?'Stück im Set':unitIsSet?'MOQ (Sets)':'Mindestbestellmenge'}</span><input class="supplier-qty" type="number" min="1" step="1" value="${qty}" placeholder="${type==='set'?'Stück im Set':unitIsSet?'MOQ Sets':'MOQ'}"></div><div class="supplier-cell supplier-shipping-cell"><span class="supplier-mini-label">Versandkosten gesamt</span><input class="supplier-total-shipping" type="number" min="0" step="0.01" value="${ship}" placeholder="0,00"></div><div class="supplier-cell supplier-unit-cost-cell"><span class="supplier-mini-label">Preis/Stück</span><input class="supplier-unit-cost" type="text" value="${euro(unit)}" readonly title="Preis pro Stück inklusive anteiligem Versand${s.customs?' und 12 % Zollpuffer':''}"></div><div class="supplier-cell supplier-order-cell"><span class="supplier-mini-label">Bestellwert</span><input class="supplier-order-cost" type="text" value="${euro(order)}" readonly title="${s.customs?'Warenwert + Versand + 12 % Zollpuffer':'Warenwert + Versand'}"></div><div class="supplier-cell supplier-image-cell"><span class="supplier-mini-label">Bild-URL</span><input class="supplier-image image-url" type="url" value="${esc(s.imageUrl||'')}" placeholder="https://…/bild.jpg"></div><div class="supplier-cell supplier-payment-fee-cell"><span class="supplier-mini-label">Zahlungsgebühr (%)</span><input class="supplier-payment-fee-pct" type="number" min="0" step="0.1" value="${Math.max(0,num(s.paymentFeePct,0))}" placeholder="0" title="Prozentuale Zahlungsabwicklungsgebühr. Sie wird auf den Betrag nach MwSt. berechnet; bei Alibaba aktuell z. B. 3 %."></div><div class="supplier-cell supplier-vat-cell"><span class="supplier-mini-label">MwSt. %</span><input class="supplier-vat-rate" type="number" min="0" step="0.1" value="${Math.max(0,num(s.vatRate,0))}" placeholder="0"></div><div class="supplier-cell supplier-vat-included-cell"><span class="supplier-mini-label">MwSt.</span><label class="supplier-toggle" title="Aktivieren, wenn die MwSt. bereits in Preis/Versand enthalten ist"><input class="supplier-vat-included" type="checkbox" ${s.vatIncluded?'checked':''}><span>inkl.</span></label></div><div class="supplier-cell customs-cell"><span class="supplier-mini-label">Zoll</span><label class="supplier-toggle" title="12 % Zollpuffer auf Warenwert inklusive Versand"><input class="supplier-customs" type="checkbox" ${s.customs?'checked':''}><span>12 %</span></label></div><div class="supplier-cell preferred-cell"><span class="supplier-mini-label">Bevorzugt</span><label class="supplier-preferred" title="Bevorzugter Lieferant"><input class="supplier-star" type="radio" name="preferredSupplier" ${s.preferred?'checked':''}><span>⭐</span></label></div><div class="supplier-remove-cell"><span class="supplier-mini-label">&nbsp;</span><button type="button" class="iconbtn remove-supplier" title="Lieferant entfernen">✕</button></div></div>
<div class="supplier-tier-actions">
  <button type="button" class="btn small toggle-supplier-tiers">Staffeln & Versand</button>
  <span class="tiny supplier-tier-summary"></span>
</div>
<div class="supplier-tier-panel hidden">
  <div class="supplier-tier-section">
    <div class="toolbar compact"><strong>Preisstaffeln</strong><button type="button" class="btn small add-price-tier">+ Preisstaffel</button></div>
    <div class="supplier-price-tiers"></div>
    <div class="tiny">Echte Preisstaffeln des Lieferanten, z. B. 100–499 Stück → 0,1401 €/Stk.</div>
  </div>
  <div class="supplier-tier-section">
    <div class="toolbar compact"><strong>Versand-Kalkulationspunkte</strong><button type="button" class="btn small add-shipping-point">+ Versandpunkt</button></div>
    <div class="supplier-shipping-points"></div>
    <div class="tiny">Nur tatsächlich abgefragte Mengen. „Versand inkl. Zollabwicklung“ wird für diesen Punkt als tatsächlicher Gesamtversand verwendet.</div><div class="tiny auto-note">Automatik: kleinste Preisstaffel → Mindestbestellmenge; passende Staffel → Stückpreis; passender Versandpunkt → Versandkosten. Bei „inkl. Zollabwicklung“ wird kein zusätzlicher 12-%-Puffer berechnet.</div>
  </div>
</div>
</div>`}
function renderSupplierRows(list){const data=list.length?list:[{id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',customs:false,preferred:true}];$('#supplierRows').innerHTML=data.map(s=>supplierRowHtml(s)).join('');$$('#supplierRows .supplier-row').forEach((r,i)=>renderSupplierTierData(r,data[i]||{}));bindSupplierEvents()}
let draftImageData='';
function openProduct(key=null){const p=key?state.products.find(x=>x.key===key):null;$('#productKey').value=p?.key||'';$('#productPid').value=p?.pid||'';$('#productPidLabel').textContent=p?.pid||'PID wird beim Speichern vergeben';$('#productModalTitle').textContent=p?'Produkt bearbeiten':'Neues Produkt';$('#productName').value=p?.name||'';$('#productStatus').value=p?.status||'idea';setSelectedColors(p?.colors||[]);if($('#colorDetectStatus'))$('#colorDetectStatus').textContent='';setCategoryOptions(p?.category||'',p?.subcategory||'');$('#productCategory').dataset.auto='';$('#productSubcategory').dataset.auto='';$('#productBasePrice').value=p?.basePrice??0;renderSupplierRows(p?.suppliers||[]);draftImageData=p?.imageData||'';$('#productImageUrl').value=p?.imageUrl||'';renderImagePreview(draftImageData||p?.imageUrl||(p?.suppliers||[]).find(x=>x.preferred)?.imageUrl||(p?.suppliers||[]).find(x=>x.imageUrl)?.imageUrl||'');renderCostRows(p?.costs?.length?p.costs:[{name:'Verpackung / Sonstiges',amount:0}]);$('#shippingCost').value=p?.shippingCost??0;$('#shippingCharged').value=p?.shippingCharged??0;$('#targetMargin').value=p?.targetMargin??30;$('#salePrice').value=p?.salePrice??0;$('#useOffsite').checked=!!p?.useOffsite;$('#useCurrency').checked=!!p?.useCurrency;$('#useSetup').checked=!!p?.useSetup;$('#productNotes').value=p?.notes||'';$('#deleteProductBtn').classList.toggle('hidden',!p);$('#categorySuggestion').classList.add('hidden');$('#categorySuggestion').textContent='';if(p)showCategorySuggestion(false);liveCalc();$('#productDialog').showModal()}
window.openProduct=openProduct;
function collectProductDraft(){return{key:$('#productKey').value||crypto.randomUUID(),pid:$('#productPid').value,name:$('#productName').value.trim(),status:$('#productStatus').value,colors:collectSelectedColors(),baseColors:deriveBaseColors(collectSelectedColors()),category:$('#productCategory').value,subcategory:$('#productSubcategory').value,basePrice:num($('#productBasePrice').value),suppliers:collectSuppliers(),imageUrl:$('#productImageUrl').value.trim(),imageData:draftImageData,costs:$$('#costRows .cost-row').map(r=>({name:r.querySelector('.cost-name').value.trim()||'Kosten',amount:num(r.querySelector('.cost-amount').value)})),shippingCost:num($('#shippingCost').value),shippingCharged:num($('#shippingCharged').value),targetMargin:num($('#targetMargin').value,30),salePrice:num($('#salePrice').value),useOffsite:$('#useOffsite').checked,useCurrency:$('#useCurrency').checked,useSetup:$('#useSetup').checked,notes:$('#productNotes').value.trim()}}
function collectSuppliers(){return $$('#supplierRows .supplier-row').map((r,i)=>{const priceType=r.querySelector('.supplier-price-type').value==='set'?'set':'unit',entry=num(r.querySelector('.supplier-price-entry').value),qty=Math.max(1,num(r.querySelector('.supplier-qty').value,1)),unitIsSet=priceType==='unit'&&!!r.querySelector('.supplier-unit-is-set')?.checked,unitSetQty=unitIsSet?Math.max(1,num(r.querySelector('.supplier-unit-set-qty')?.value,1)):1,price=priceType==='set'?entry/qty:entry;return{id:r.dataset.id||crypto.randomUUID(),name:r.querySelector('.supplier-name').value.trim()||'Lieferant '+(i+1),url:r.querySelector('.supplier-url').value.trim(),priceType,price,minOrderQty:priceType==='unit'?qty:1,unitIsSet,unitSetQty,setPrice:priceType==='set'?entry:0,setQty:priceType==='set'?qty:1,totalShipping:num(r.querySelector('.supplier-total-shipping').value),imageUrl:r.querySelector('.supplier-image').value.trim(),paymentFeePct:Math.max(0,num(r.querySelector('.supplier-payment-fee-pct')?.value,0)),vatRate:Math.max(0,num(r.querySelector('.supplier-vat-rate')?.value,0)),vatIncluded:!!r.querySelector('.supplier-vat-included')?.checked,customs:r.querySelector('.supplier-customs').checked,preferred:r.querySelector('.supplier-star').checked,priceTiers:collectSupplierPriceTiers(r),shippingPoints:collectSupplierShippingPoints(r),activeCalcSource:supplierCalcSourceFromRow(r)||{type:'main',qty:null}}})}
function renderCostRows(costs){$('#costRows').innerHTML=costs.map(c=>`<div class="cost-row"><input class="cost-name" value="${esc(c.name)}" placeholder="Kostenposition"><input class="cost-amount" type="number" min="0" step="0.01" value="${num(c.amount)}"><button type="button" class="iconbtn remove-cost">✕</button></div>`).join('');bindCostEvents()}
function bindCostEvents(){$$('#costRows .cost-name,#costRows .cost-amount').forEach(e=>e.addEventListener('input',liveCalc));$$('#costRows .remove-cost').forEach(b=>b.addEventListener('click',()=>{b.closest('.cost-row').remove();liveCalc()}))}
function priceTierRowHtml(t={},supplierId='supplier'){const unit=num(t.unitPrice),q=Math.max(1,num(t.minQty,1));return `<div class="supplier-price-tier-row"><label class="supplier-calc-choice" title="Diese Preisstaffel als Kalkulationsbasis verwenden"><input class="supplier-calc-source tier-calc-source" type="radio" name="calc-${esc(supplierId)}" value="tier" data-qty="${q}"><span>●</span></label><input class="tier-min" type="number" min="1" step="1" value="${q}" placeholder="Ab Menge"><input class="tier-max" type="number" min="1" step="1" value="${num(t.maxQty)||''}" placeholder="Bis (leer = offen)"><input class="tier-price" type="number" min="0" step="0.0001" value="${unit||''}" placeholder="€/Stück"><input class="tier-unit-display" type="text" value="${unit?euro(unit):'–'}" readonly title="Preis/Stück dieser Staffel"><button type="button" class="iconbtn remove-price-tier">✕</button></div>`}
function shippingPointRowHtml(s={},supplierId='supplier'){const q=Math.max(1,num(s.qty,1));return `<div class="supplier-shipping-point-row"><label class="supplier-calc-choice" title="Diesen Versandpunkt als Kalkulationsbasis verwenden"><input class="supplier-calc-source shipping-calc-source" type="radio" name="calc-${esc(supplierId)}" value="shipping" data-qty="${q}"><span>●</span></label><input class="ship-point-qty" type="number" min="1" step="1" value="${q}" placeholder="Menge"><input class="ship-point-normal" type="number" min="0" step="0.01" value="${num(s.shipping)||''}" placeholder="Versand"><input class="ship-point-customs" type="number" min="0" step="0.01" value="${num(s.shippingWithCustoms)||''}" placeholder="Versand inkl. Zollabwicklung"><input class="ship-point-unit-display" type="text" value="–" readonly title="Effektiver Preis/Stück bei dieser getesteten Menge"><button type="button" class="iconbtn remove-shipping-point">✕</button></div>`}
function supplierCalcSourceFromRow(r){
  const checked=r?.querySelector('.supplier-calc-source:checked');
  if(!checked)return null;
  if(checked.value==='main')return{type:'main',qty:null};
  const row=checked.closest(checked.value==='tier'?'.supplier-price-tier-row':'.supplier-shipping-point-row');
  const qty=checked.value==='tier'
    ? Math.max(1,num(row?.querySelector('.tier-min')?.value,1))
    : Math.max(1,num(row?.querySelector('.ship-point-qty')?.value,1));
  return{type:checked.value,qty}
}
function applySupplierCalcSourceVisual(r){
  if(!r)return;
  r.querySelectorAll('.supplier-price-tier-row,.supplier-shipping-point-row').forEach(x=>x.classList.remove('calc-active'));
  r.classList.toggle('calc-main-active',!!r.querySelector('.supplier-calc-main:checked'));
  const checked=r.querySelector('.supplier-calc-source:checked');
  if(checked&&!checked.classList.contains('supplier-calc-main'))checked.closest('.supplier-price-tier-row,.supplier-shipping-point-row')?.classList.add('calc-active')
}
function ensureSupplierCalcSource(r,s={}){
  if(!r)return;
  const src=s?.activeCalcSource;
  let target=null;
  if(src?.type==='main')target=r.querySelector('.supplier-calc-main');
  else if(src?.type==='tier'){
    target=[...r.querySelectorAll('.tier-calc-source')].find(x=>Math.max(1,num(x.dataset.qty,1))===Math.max(1,num(src.qty,1)))
  }else if(src?.type==='shipping'){
    target=[...r.querySelectorAll('.shipping-calc-source')].find(x=>Math.max(1,num(x.dataset.qty,1))===Math.max(1,num(src.qty,1)))
  }
  if(!target)target=r.querySelector('.tier-calc-source')||r.querySelector('.supplier-calc-main');
  if(target)target.checked=true;
  applySupplierCalcSourceVisual(r)
}
function supplierDraftForDerived(r){
  const type=r.querySelector('.supplier-price-type').value==='set'?'set':'unit',
    entry=num(r.querySelector('.supplier-price-entry').value),
    qty=Math.max(1,num(r.querySelector('.supplier-qty').value,1)),
    unitIsSet=type==='unit'&&!!r.querySelector('.supplier-unit-is-set')?.checked,
    unitSetQty=unitIsSet?Math.max(1,num(r.querySelector('.supplier-unit-set-qty')?.value,1)):1;
  return{
    priceType:type,
    price:type==='set'?entry/qty:entry,
    minOrderQty:type==='unit'?qty:1,
    unitIsSet,unitSetQty,
    setPrice:type==='set'?entry:0,
    setQty:type==='set'?qty:1,
    totalShipping:num(r.querySelector('.supplier-total-shipping').value),
    paymentFeePct:Math.max(0,num(r.querySelector('.supplier-payment-fee-pct')?.value,0)),
    vatRate:Math.max(0,num(r.querySelector('.supplier-vat-rate')?.value,0)),
    vatIncluded:!!r.querySelector('.supplier-vat-included')?.checked,
    customs:!!r.querySelector('.supplier-customs')?.checked,
    priceTiers:collectSupplierPriceTiers(r),
    shippingPoints:collectSupplierShippingPoints(r),
    activeCalcSource:supplierCalcSourceFromRow(r)||{type:'main',qty:null}
  }
}
function renderSupplierTierData(r,s={}){const sid=r.dataset.id||s.id||'supplier';r.querySelector('.supplier-price-tiers').innerHTML=(s.priceTiers||[]).map(t=>priceTierRowHtml(t,sid)).join('');r.querySelector('.supplier-shipping-points').innerHTML=(s.shippingPoints||[]).map(p=>shippingPointRowHtml(p,sid)).join('');ensureSupplierCalcSource(r,s);updateSupplierTierSummary(r);updateSupplierTierUnitDisplays(r);syncSupplierMainFieldsFromTiers(r);updateSupplierDerived(r)}

function syncSupplierMainFieldsFromTiers(r){
  if(!r)return;

  const tiers=collectSupplierPriceTiers(r);
  const points=collectSupplierShippingPoints(r);
  const qtyInput=r.querySelector('.supplier-qty');
  const type=r.querySelector('.supplier-price-type')?.value==='set'?'set':'unit';
  const priceInput=r.querySelector('.supplier-price-entry');
  const shippingInput=r.querySelector('.supplier-total-shipping');
  const customsInput=r.querySelector('.supplier-customs');

  // Nur leere Hauptfelder automatisch ausfüllen.
  // Bereits manuell eingetragene Werte bleiben unangetastet.
  if(tiers.length){
    const minQty=Math.min(...tiers.map(t=>Math.max(1,num(t.minQty,1))));

    if(qtyInput && (!qtyInput.value || num(qtyInput.value)<=0)){
      qtyInput.value=minQty;
      qtyInput.dataset.autoFromTier='1';
    }

    const effectiveQty=Math.max(1,num(qtyInput?.value,minQty));

    if(type==='unit' && priceInput && (!priceInput.value || num(priceInput.value)<=0)){
      const hit=tiers.find(t=>effectiveQty>=Math.max(1,num(t.minQty,1)) && (!num(t.maxQty) || effectiveQty<=num(t.maxQty)));
      if(hit && num(hit.unitPrice)>0){
        priceInput.value=num(hit.unitPrice);
        priceInput.dataset.autoFromTier='1';
      }
    }

    const shipPoint=points.find(p=>Math.max(1,num(p.qty,1))===effectiveQty);
    if(shipPoint){
      const withCustoms=num(shipPoint.shippingWithCustoms);
      const normal=num(shipPoint.shipping);

      // Wenn Versand inkl. Zollabwicklung vorhanden ist:
      // Zoll-Haken automatisch AUS, weil bereits enthalten.
      if(withCustoms>0 && customsInput){
        customsInput.checked=false;
        customsInput.dataset.autoDisabledByShipping='1';
        customsInput.title='12 % Zoll deaktiviert, da Versand inkl. Zollabwicklung hinterlegt ist';
      }

      // Versand-Hauptfeld nur füllen, wenn es leer ist oder zuvor automatisch gesetzt wurde.
      if(shippingInput && (
        !shippingInput.value ||
        num(shippingInput.value)<=0 ||
        shippingInput.dataset.autoFromShippingPoint==='1'
      )){
        shippingInput.value=withCustoms>0 ? withCustoms : normal;
        shippingInput.dataset.autoFromShippingPoint='1';
        shippingInput.title=withCustoms>0
          ? 'Automatisch aus Versand-Kalkulationspunkt übernommen: inklusive Zollabwicklung'
          : 'Automatisch aus Versand-Kalkulationspunkt übernommen';
      }
    }
  }

  updateSupplierDerived(r);
}
function updateSupplierTierUnitDisplays(r){
  if(!r)return;
  const type=r.querySelector('.supplier-price-type')?.value==='set'?'set':'unit',
    unitIsSet=type==='unit'&&!!r.querySelector('.supplier-unit-is-set')?.checked,
    setSize=unitIsSet?Math.max(1,num(r.querySelector('.supplier-unit-set-qty')?.value,1)):1;

  r.querySelectorAll('.supplier-price-tier-row').forEach(row=>{
    const price=num(row.querySelector('.tier-price')?.value),out=row.querySelector('.tier-unit-display');
    if(row.querySelector('.tier-min'))row.querySelector('.tier-min').placeholder=unitIsSet?'Ab Sets':'Ab Menge';
    if(row.querySelector('.tier-max'))row.querySelector('.tier-max').placeholder=unitIsSet?'Bis Sets':'Bis (leer = offen)';
    if(row.querySelector('.tier-price'))row.querySelector('.tier-price').placeholder=unitIsSet?'€/Set':'€/Stück';
    if(out){out.value=price>0?euro(price/setSize):'–';out.title=unitIsSet?`Effektiver Preis/Stück: Preis pro Set ÷ ${setSize}`:'Preis/Stück dieser Staffel'}
  });

  const tiers=collectSupplierPriceTiers(r);
  r.querySelectorAll('.supplier-shipping-point-row').forEach(row=>{
    const rawQty=Math.max(1,num(row.querySelector('.ship-point-qty')?.value,1)),
      effectiveQty=rawQty*setSize,
      normal=num(row.querySelector('.ship-point-normal')?.value),
      withCustoms=num(row.querySelector('.ship-point-customs')?.value),
      out=row.querySelector('.ship-point-unit-display');
    if(row.querySelector('.ship-point-qty'))row.querySelector('.ship-point-qty').placeholder=unitIsSet?'Sets':'Menge';

    const tier=tiers.find(t=>rawQty>=Math.max(1,num(t.minQty,1))&&(!num(t.maxQty)||rawQty<=num(t.maxQty)));
    const fallbackEntry=num(r.querySelector('.supplier-price-entry')?.value),
      fallbackQty=Math.max(1,num(r.querySelector('.supplier-qty')?.value,1));
    const rawPrice=tier&&num(tier.unitPrice)>0?num(tier.unitPrice):(type==='set'?fallbackEntry/fallbackQty:fallbackEntry);
    const shipping=withCustoms>0?withCustoms:normal;
    let total=rawPrice*rawQty+shipping;
    if(withCustoms<=0&&r.querySelector('.supplier-customs')?.checked)total*=1.12;
    if(out){out.value=(rawPrice>0||shipping>0)?euro(total/effectiveQty):'–';out.title=unitIsSet?`${rawQty} Sets × ${setSize} Stück = ${effectiveQty} Stück`:'Effektiver Preis/Stück bei dieser getesteten Menge'}
  })
}
function updateSupplierTierSummary(r){const pc=r.querySelectorAll('.supplier-price-tier-row').length,sc=r.querySelectorAll('.supplier-shipping-point-row').length,el=r.querySelector('.supplier-tier-summary');if(el){const base=(pc?pc+' Preisstaffel'+(pc===1?'':'n'):'keine Preisstaffeln')+' · '+(sc?sc+' Versandpunkt'+(sc===1?'':'e'):'keine Versandpunkte');el.dataset.base=base;el.textContent=base}}
function collectSupplierPriceTiers(r){return [...r.querySelectorAll('.supplier-price-tier-row')].map(x=>({minQty:Math.max(1,num(x.querySelector('.tier-min')?.value,1)),maxQty:num(x.querySelector('.tier-max')?.value)||null,unitPrice:num(x.querySelector('.tier-price')?.value)})).filter(x=>x.unitPrice>0).sort((a,b)=>a.minQty-b.minQty)}
function collectSupplierShippingPoints(r){return [...r.querySelectorAll('.supplier-shipping-point-row')].map(x=>({qty:Math.max(1,num(x.querySelector('.ship-point-qty')?.value,1)),shipping:num(x.querySelector('.ship-point-normal')?.value),shippingWithCustoms:num(x.querySelector('.ship-point-customs')?.value)})).filter(x=>x.shipping>0||x.shippingWithCustoms>0).sort((a,b)=>a.qty-b.qty)}
function updateSupplierDerived(r){
  if(!r)return;
  const type=r.querySelector('.supplier-price-type').value==='set'?'set':'unit',
    unitIsSet=type==='unit'&&!!r.querySelector('.supplier-unit-is-set')?.checked,
    setSize=unitIsSet?Math.max(1,num(r.querySelector('.supplier-unit-set-qty')?.value,1)):1,
    setCell=r.querySelector('.supplier-unit-set-cell'),setQtyInput=r.querySelector('.supplier-unit-set-qty'),
    s=supplierDraftForDerived(r),active=supplierActiveCalcSource(s),qty=supplierCalcQty(s),order=supplierOrderCost(s),unit=qty>0?order/qty:0;

  if(setCell)setCell.classList.toggle('hidden',type!=='unit');
  if(setQtyInput)setQtyInput.classList.toggle('hidden',!unitIsSet||type!=='unit');
  const pl=r.querySelector('.supplier-price-label');if(pl)pl.textContent=type==='set'?'Setpreis':unitIsSet?'Preis/Set':'Stückpreis';
  const ql=r.querySelector('.supplier-qty-label');if(ql)ql.textContent=type==='set'?'Stück im Set':unitIsSet?'MOQ (Sets)':'Mindestbestellmenge';
  const qi=r.querySelector('.supplier-qty');if(qi)qi.placeholder=type==='set'?'Stück im Set':unitIsSet?'MOQ Sets':'MOQ';
  const uc=r.querySelector('.supplier-unit-cost');if(uc){uc.value=euro(unit);uc.title=`Aktive Kalkulation: ${active.type==='tier'?'Preisstaffel ab '+active.qty+(unitIsSet?' Sets':''):active.type==='shipping'?'Versandpunkt '+active.qty+(unitIsSet?' Sets':''):'Lieferantenzeile'}${unitIsSet?` · ${setSize} Stück/Set`:''}`}
  const oc=r.querySelector('.supplier-order-cost');if(oc){oc.value=euro(order);oc.title=`Bestellwert für aktive Kalkulationsmenge ${supplierCalcRawQty(s)}${unitIsSet?' Sets = '+qty+' Stück':' Stück'}`}
  const summary=r.querySelector('.supplier-tier-summary');if(summary){const base=summary.dataset.base||summary.textContent||'';summary.textContent=`${base.replace(/\s·\sAktiv:.+$/,'')} · Aktiv: ${active.type==='main'?'Lieferantenzeile':active.type==='tier'?'Preisstaffel ab '+active.qty+(unitIsSet?' Sets':''): 'Versandpunkt '+active.qty+(unitIsSet?' Sets':'')}`}
  applySupplierCalcSourceVisual(r)
}
function bindSupplierEvents(){$$('#supplierRows .supplier-row').forEach(r=>{const name=r.querySelector('.supplier-name'),customs=r.querySelector('.supplier-customs'),vat=r.querySelector('.supplier-vat-rate'),payment=r.querySelector('.supplier-payment-fee-pct'),vatIncluded=r.querySelector('.supplier-vat-included');if(name&&customs){let wasAlibaba=isAlibabaSupplierName(name.value);name.addEventListener('input',()=>{const nowAlibaba=isAlibabaSupplierName(name.value);if(nowAlibaba&&!wasAlibaba){customs.checked=true;if(vat)vat.value='19';if(payment)payment.value='3';if(vatIncluded)vatIncluded.checked=false}wasAlibaba=nowAlibaba;customs.disabled=false;customs.title=nowAlibaba?'Alibaba: 12 % Zoll automatisch vorausgewählt – kann ausgeschaltet werden':'12 % Zollpuffer auf Warenwert inklusive Versand';if(vat)vat.title=nowAlibaba?'Alibaba: 19 % MwSt. automatisch vorausgewählt – kann geändert werden':'MwSt.-Satz des Lieferanten';if(payment)payment.title=nowAlibaba?'Alibaba: 3 % Zahlungsgebühr automatisch vorausgewählt – kann geändert werden':'Prozentuale Zahlungsabwicklungsgebühr';updateSupplierDerived(r);updateSupplierTierUnitDisplays(r);liveCalc()});customs.disabled=false;customs.title=wasAlibaba?'Alibaba: 12 % Zoll automatisch vorausgewählt – kann ausgeschaltet werden':'12 % Zollpuffer auf Warenwert inklusive Versand';if(vat)vat.title=wasAlibaba?'Alibaba: 19 % MwSt. automatisch vorausgewählt – kann geändert werden':'MwSt.-Satz des Lieferanten';if(payment)payment.title=wasAlibaba?'Alibaba: 3 % Zahlungsgebühr automatisch vorausgewählt – kann geändert werden':'Prozentuale Zahlungsabwicklungsgebühr'}});$$('#supplierRows .supplier-row').forEach(r=>{r.querySelectorAll('input,select').forEach(el=>{el.oninput=()=>{updateSupplierDerived(r);updateSupplierTierUnitDisplays(r);liveCalc()};el.onchange=()=>{updateSupplierDerived(r);updateSupplierTierUnitDisplays(r);liveCalc()}});r.querySelector('.supplier-star').onchange=()=>{if(r.querySelector('.supplier-star').checked){const img=r.querySelector('.supplier-image').value.trim();if(img){$('#productImageUrl').value=img;draftImageData='';renderImagePreview(img)}}liveCalc()};r.querySelector('.supplier-image').onchange=()=>{const img=r.querySelector('.supplier-image').value.trim();if(r.querySelector('.supplier-star').checked&&img){$('#productImageUrl').value=img;draftImageData='';renderImagePreview(img)}liveCalc()};r.querySelector('.remove-supplier').onclick=()=>{if($$('#supplierRows .supplier-row').length<=1){alert('Mindestens ein Lieferant muss vorhanden bleiben.');return}const wasPreferred=r.querySelector('.supplier-star').checked;r.remove();if(wasPreferred&&$$('#supplierRows .supplier-star')[0])$$('#supplierRows .supplier-star')[0].checked=true;liveCalc()};const toggle=r.querySelector('.toggle-supplier-tiers');if(toggle)toggle.onclick=()=>r.querySelector('.supplier-tier-panel')?.classList.toggle('hidden');const addTier=r.querySelector('.add-price-tier');if(addTier)addTier.onclick=()=>{r.querySelector('.supplier-price-tiers').insertAdjacentHTML('beforeend',priceTierRowHtml({minQty:1},r.dataset.id||'supplier'));bindSupplierEvents();updateSupplierTierSummary(r);updateSupplierTierUnitDisplays(r);syncSupplierMainFieldsFromTiers(r)};const addShip=r.querySelector('.add-shipping-point');if(addShip)addShip.onclick=()=>{r.querySelector('.supplier-shipping-points').insertAdjacentHTML('beforeend',shippingPointRowHtml({qty:1},r.dataset.id||'supplier'));bindSupplierEvents();updateSupplierTierSummary(r);updateSupplierTierUnitDisplays(r);syncSupplierMainFieldsFromTiers(r)};r.querySelectorAll('.remove-price-tier').forEach(b=>b.onclick=()=>{const row=b.closest('.supplier-price-tier-row'),wasActive=!!row?.querySelector('.supplier-calc-source:checked');row?.remove();if(wasActive){const fallback=r.querySelector('.tier-calc-source')||r.querySelector('.supplier-calc-main');if(fallback)fallback.checked=true}updateSupplierTierSummary(r);updateSupplierTierUnitDisplays(r);syncSupplierMainFieldsFromTiers(r);updateSupplierDerived(r);liveCalc()});r.querySelectorAll('.remove-shipping-point').forEach(b=>b.onclick=()=>{
  const shipRow=b.closest('.supplier-shipping-point-row'),wasActive=!!shipRow?.querySelector('.supplier-calc-source:checked');
  shipRow?.remove();
  if(wasActive){const fallback=r.querySelector('.tier-calc-source')||r.querySelector('.supplier-calc-main');if(fallback)fallback.checked=true}
  const customs=r.querySelector('.supplier-customs');
  const anyIncluded=[...r.querySelectorAll('.ship-point-customs')].some(x=>num(x.value)>0);
  if(customs && !anyIncluded){
    delete customs.dataset.autoDisabledByShipping;
    customs.title=isAlibabaSupplierName(r.querySelector('.supplier-name')?.value)
      ? 'Alibaba: 12 % Zoll automatisch vorausgewählt – kann ausgeschaltet werden'
      : '12 % Zollpuffer auf Warenwert inklusive Versand';
  }
  updateSupplierTierSummary(r);
  updateSupplierTierUnitDisplays(r);
  syncSupplierMainFieldsFromTiers(r);
  liveCalc()
});r.querySelectorAll('.supplier-price-tier-row input,.supplier-shipping-point-row input').forEach(el=>el.oninput=()=>{
  if(el.classList.contains('ship-point-customs') && num(el.value)>0){
    const customs=r.querySelector('.supplier-customs');
    if(customs){
      customs.checked=false;
      customs.dataset.autoDisabledByShipping='1';
      customs.title='12 % Zoll deaktiviert, da Versand inkl. Zollabwicklung hinterlegt ist';
    }
  }
  const parent=el.closest('.supplier-price-tier-row,.supplier-shipping-point-row');
  if(parent){
    const radio=parent.querySelector('.supplier-calc-source');
    if(radio){
      radio.dataset.qty=parent.classList.contains('supplier-price-tier-row')
        ? Math.max(1,num(parent.querySelector('.tier-min')?.value,1))
        : Math.max(1,num(parent.querySelector('.ship-point-qty')?.value,1))
    }
  }
  updateSupplierTierSummary(r);
  updateSupplierTierUnitDisplays(r);
  syncSupplierMainFieldsFromTiers(r);
  updateSupplierDerived(r);
  liveCalc()
});
r.querySelectorAll('.supplier-calc-source').forEach(src=>src.onchange=()=>{
  if(src.checked){applySupplierCalcSourceVisual(r);updateSupplierDerived(r);liveCalc()}
})})}
function preferredSupplier(){return collectSuppliers().find(s=>s.preferred)||collectSuppliers()[0]}
function liveCalc(){const p=collectProductDraft(),c=calcProduct(p);$('#liveCost').textContent=euro(c.costs);$('#liveFees').textContent=euro(c.fees);$('#liveProfit').textContent=euro(c.profit);$('#liveProfit').className=c.profit>=0?'positive':'negative';$('#liveMargin').textContent=pct(c.margin);$('#recommendedPrice').textContent=euro(c.recommended)}
function renderImagePreview(src){const w=$('#imagePreviewWrap');if(src){w.className='';w.innerHTML=`<img class="preview" src="${esc(src)}" alt="Produktbild" onerror="this.parentElement.className='preview emptyimg';this.parentElement.textContent='Bild konnte nicht geladen werden'">`}else{w.className='preview emptyimg';w.textContent='Noch kein Bild'}}
async function resizeImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.82))};img.onerror=reject;img.src=reader.result};reader.readAsDataURL(file)})}
async function tryAutoImage(){const s=preferredSupplier();if(!s?.url){alert('Markiere zuerst einen Lieferanten mit Produkt-URL als bevorzugt.');return}if(s.imageUrl){$('#productImageUrl').value=s.imageUrl;draftImageData='';renderImagePreview(s.imageUrl);return}try{const res=await fetch(s.url,{mode:'cors'});if(!res.ok)throw Error();const html=await res.text(),doc=new DOMParser().parseFromString(html,'text/html'),meta=doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]'),src=meta?.content;if(!src)throw Error();const absolute=new URL(src,s.url).href;$('#productImageUrl').value=absolute;draftImageData='';renderImagePreview(absolute)}catch{alert('Diese Website blockiert das automatische Auslesen im Browser. Nutze stattdessen „Bild-URL“ oder lade das Bild direkt hoch – beides funktioniert zuverlässig.')}}
