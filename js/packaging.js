
function packagingSupplierRowHtml(s){
  const type=s.priceType==='consumable'?'consumable':(s.priceType==='set'?'set':'unit'),
    qty=type==='consumable'?Math.max(1,num(s.packageCount,1)):(type==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))),
    entry=type==='consumable'?num(s.purchasePrice):(type==='set'?num(s.setPrice):num(s.price)),
    unit=supplierLandedUnitCost(s),order=supplierOrderCost(s),
    amount=Math.max(0.0001,num(s.amountPerPackage,1)),cunit=s.consumptionUnit||'m';
  return `<div class="packaging-supplier-row" data-id="${esc(s.id||crypto.randomUUID())}">
    <div class="supplier-grid">
      <div class="supplier-cell"><span class="supplier-mini-label">Lieferant</span><input class="packaging-supplier-name" value="${esc(s.name||'')}" placeholder="Lieferant"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">URL</span><input class="packaging-supplier-url" type="url" value="${esc(s.url||'')}" placeholder="https://…"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Preisart</span><select class="packaging-supplier-price-type"><option value="unit" ${type==='unit'?'selected':''}>Stückpreis</option><option value="set" ${type==='set'?'selected':''}>Setpreis</option><option value="consumable" ${type==='consumable'?'selected':''}>Verbrauch</option></select></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-price-label">${type==='consumable'?'Kaufpreis':(type==='set'?'Setpreis':'Stückpreis')}</span><input class="packaging-supplier-price-entry" type="number" min="0" step="0.0001" value="${entry}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-qty-label">${type==='consumable'?'Anzahl Gebinde':(type==='set'?'Stück im Set':'Mindestbestellmenge')}</span><input class="packaging-supplier-qty" type="number" min="1" step="1" value="${qty}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Versandkosten</span><input class="packaging-supplier-total-shipping" type="number" min="0" step="0.01" value="${num(s.totalShipping)}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-unit-cost-label">${type==='consumable'?'Preis/Einheit':'Preis/Stück'}</span><input class="packaging-supplier-unit-cost" value="${euro(unit)}" readonly></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Bestellwert</span><input class="packaging-supplier-order-cost" value="${euro(order)}" readonly></div>
      <div class="supplier-cell supplier-image-cell"><span class="supplier-mini-label">Bild-URL</span><input class="packaging-supplier-image" type="url" value="${esc(s.imageUrl||'')}" placeholder="https://…"></div>
      <div class="supplier-cell customs-cell"><span class="supplier-mini-label">Zoll</span><label class="supplier-toggle" title="12 % Zollpuffer"><input class="packaging-supplier-customs" type="checkbox" ${s.customs?'checked':''}><span>12 %</span></label></div>
      <div class="supplier-cell preferred-cell"><span class="supplier-mini-label">Bevorzugt</span><label class="supplier-preferred"><input class="packaging-supplier-star" type="radio" name="preferredPackagingSupplier" ${s.preferred?'checked':''}><span>⭐</span></label></div>
      <div class="supplier-remove-cell"><span class="supplier-mini-label">&nbsp;</span><button type="button" class="iconbtn remove-packaging-supplier">✕</button></div>
    </div>
    <div class="packaging-consumption-fields ${type==='consumable'?'':'hidden'}">
      <div><span class="supplier-mini-label">Menge je Gebinde</span><input class="packaging-amount-per-package" type="number" min="0.0001" step="0.01" value="${amount}"></div>
      <div><span class="supplier-mini-label">Einheit</span><select class="packaging-consumption-unit"><option value="m" ${cunit==='m'?'selected':''}>m</option><option value="cm" ${cunit==='cm'?'selected':''}>cm</option><option value="g" ${cunit==='g'?'selected':''}>g</option><option value="kg" ${cunit==='kg'?'selected':''}>kg</option><option value="ml" ${cunit==='ml'?'selected':''}>ml</option><option value="l" ${cunit==='l'?'selected':''}>l</option><option value="Bogen" ${cunit==='Bogen'?'selected':''}>Bogen</option><option value="Stück" ${cunit==='Stück'?'selected':''}>Stück</option></select></div>
      <div><span class="supplier-mini-label">Gesamtmenge</span><input class="packaging-total-consumption" readonly></div>
      <div><span class="supplier-mini-label">Preis je Einheit</span><input class="packaging-unit-consumption-cost" readonly></div>
    </div>
    <div class="packaging-tier-actions">
      <button type="button" class="btn small toggle-packaging-tiers">Staffeln & Versand</button>
      <span class="tiny packaging-tier-summary"></span>
    </div>
    <div class="packaging-tier-panel hidden">
      <div class="packaging-tier-section">
        <div class="packaging-tier-header">
  <div class="packaging-tier-header-top">
    <strong>Preisstaffeln</strong>
    <button type="button" class="btn small add-packaging-price-tier">+ Preisstaffel</button>
  </div>
  <div class="packaging-tier-type-control">
    <span class="supplier-mini-label">Preisart</span>
    <select class="packaging-tier-type">
      <option value="unit">Stückpreis</option>
      <option value="set">Setpreis</option>
    </select>
  </div>
</div>
        <div class="packaging-price-tiers"></div>
        <div class="tiny">Preisstaffeln dieses Verpackungs-Lieferanten.</div>
      </div>
      <div class="packaging-tier-section">
        <div class="toolbar compact"><strong>Versand-Kalkulationspunkte</strong><button type="button" class="btn small add-packaging-shipping-point">+ Versandpunkt</button></div>
        <div class="packaging-shipping-points"></div>
        <div class="tiny">Tatsächlich abgefragte Versandpreise je Bestellmenge.</div>
        <div class="tiny auto-note">Wenn „Versand inkl. Zollabwicklung“ hinterlegt ist, wird der 12-%-Zollhaken automatisch deaktiviert.</div>
      </div>
    </div>
  </div>`}
function packagingSupplierFromRow(r,i){
  const rawType=r.querySelector('.packaging-supplier-price-type').value,
    type=rawType==='consumable'?'consumable':(rawType==='set'?'set':'unit'),
    entry=num(r.querySelector('.packaging-supplier-price-entry').value),
    qty=Math.max(1,num(r.querySelector('.packaging-supplier-qty').value,1)),
    amountPerPackage=Math.max(0.0001,num(r.querySelector('.packaging-amount-per-package')?.value,1)),
    consumptionUnit=r.querySelector('.packaging-consumption-unit')?.value||'m';
  return {id:r.dataset.id||crypto.randomUUID(),name:r.querySelector('.packaging-supplier-name').value.trim()||'Lieferant '+(i+1),
    url:r.querySelector('.packaging-supplier-url').value.trim(),priceType:type,
    price:type==='set'?entry/qty:(type==='consumable'?0:entry),minOrderQty:type==='unit'?qty:1,
    setPrice:type==='set'?entry:0,setQty:type==='set'?qty:1,purchasePrice:type==='consumable'?entry:0,
    packageCount:type==='consumable'?qty:1,amountPerPackage:type==='consumable'?amountPerPackage:1,
    consumptionUnit:type==='consumable'?consumptionUnit:'Stück',
    totalShipping:num(r.querySelector('.packaging-supplier-total-shipping').value),
    imageUrl:r.querySelector('.packaging-supplier-image').value.trim(),
    customs:r.querySelector('.packaging-supplier-customs').checked,
    preferred:r.querySelector('.packaging-supplier-star').checked,
    priceTiers:collectPackagingPriceTiers(r),
    shippingPoints:collectPackagingShippingPoints(r)};
}
function collectPackagingSuppliers(){return $$('.packaging-supplier-row').map(packagingSupplierFromRow)}
function packagingPreferredSupplierFromDraft(){const a=collectPackagingSuppliers();return a.find(x=>x.preferred)||a[0]}

function packagingPriceTierRowHtml(t={},forcedType=null){
  const type=forcedType||(t.priceType==='set'?'set':'unit'),
    setQty=Math.max(1,num(t.setQty,num(t.minQty,1))),
    setPrice=num(t.setPrice),
    unit=type==='set'?(setPrice/setQty):num(t.unitPrice),
    minQty=Math.max(1,num(t.minQty,1)),
    maxQty=num(t.maxQty)||'';

  if(type==='set'){
    return `<div class="packaging-price-tier-row set-tier-row" data-price-type="set">
      <div class="pack-tier-field">
        <span class="supplier-mini-label">Setpreis</span>
        <input class="pack-tier-price" type="number" min="0" step="0.0001" value="${setPrice||''}" placeholder="z. B. 14,99">
      </div>
      <div class="pack-tier-field pack-tier-set-field">
        <span class="supplier-mini-label">Stück im Set</span>
        <input class="pack-tier-set-qty" type="number" min="1" step="1" value="${setQty}" placeholder="z. B. 25">
      </div>
      <div class="pack-tier-field">
        <span class="supplier-mini-label">Preis/Stück</span>
        <input class="pack-tier-unit-display" type="text" value="${unit?euro(unit):'–'}" readonly>
      </div>
      <div class="pack-tier-remove"><button type="button" class="iconbtn remove-packaging-price-tier">✕</button></div>
    </div>`
  }

  return `<div class="packaging-price-tier-row unit-tier-row" data-price-type="unit">
    <div class="pack-tier-field pack-tier-range-field">
      <span class="supplier-mini-label">Ab Menge</span>
      <input class="pack-tier-min" type="number" min="1" step="1" value="${minQty}" placeholder="z. B. 10">
    </div>
    <div class="pack-tier-field pack-tier-range-field">
      <span class="supplier-mini-label">Bis Menge</span>
      <input class="pack-tier-max" type="number" min="1" step="1" value="${maxQty}" placeholder="leer = offen">
    </div>
    <div class="pack-tier-field">
      <span class="supplier-mini-label">Stückpreis</span>
      <input class="pack-tier-price" type="number" min="0" step="0.0001" value="${num(t.unitPrice)||''}" placeholder="€/Stück">
    </div>
    <div class="pack-tier-field">
      <span class="supplier-mini-label">Preis/Stück</span>
      <input class="pack-tier-unit-display" type="text" value="${unit?euro(unit):'–'}" readonly>
    </div>
    <div class="pack-tier-remove"><button type="button" class="iconbtn remove-packaging-price-tier">✕</button></div>
  </div>`
}
function packagingShippingPointRowHtml(s={}){
  return `<div class="packaging-shipping-point-row"><input class="pack-ship-qty" type="number" min="1" step="1" value="${Math.max(1,num(s.qty,1))}" placeholder="Menge"><input class="pack-ship-normal" type="number" min="0" step="0.01" value="${num(s.shipping)||''}" placeholder="Versand"><input class="pack-ship-customs" type="number" min="0" step="0.01" value="${num(s.shippingWithCustoms)||''}" placeholder="Versand inkl. Zollabwicklung"><input class="pack-ship-unit-display" type="text" value="–" readonly title="Effektiver Preis/Stück bei dieser Menge"><button type="button" class="iconbtn remove-packaging-shipping-point">✕</button></div>`
}
function collectPackagingPriceTiers(r){
  const globalType=r.querySelector('.packaging-tier-type')?.value==='set'?'set':'unit';
  return [...r.querySelectorAll('.packaging-price-tier-row')].map(x=>{
    const rawPrice=num(x.querySelector('.pack-tier-price')?.value);
    if(globalType==='set'){
      const setQty=Math.max(1,num(x.querySelector('.pack-tier-set-qty')?.value,1));
      return {minQty:setQty,maxQty:setQty,priceType:'set',unitPrice:rawPrice/setQty,setPrice:rawPrice,setQty}
    }
    return {
      minQty:Math.max(1,num(x.querySelector('.pack-tier-min')?.value,1)),
      maxQty:num(x.querySelector('.pack-tier-max')?.value)||null,
      priceType:'unit',
      unitPrice:rawPrice,
      setPrice:0,
      setQty:1
    }
  }).filter(x=>x.unitPrice>0).sort((a,b)=>a.minQty-b.minQty)
}
function collectPackagingShippingPoints(r){
  return [...r.querySelectorAll('.packaging-shipping-point-row')].map(x=>({
    qty:Math.max(1,num(x.querySelector('.pack-ship-qty')?.value,1)),
    shipping:num(x.querySelector('.pack-ship-normal')?.value),
    shippingWithCustoms:num(x.querySelector('.pack-ship-customs')?.value)
  })).filter(x=>x.shipping>0||x.shippingWithCustoms>0).sort((a,b)=>a.qty-b.qty)
}
function updatePackagingTierSummary(r){
  const pc=r.querySelectorAll('.packaging-price-tier-row').length,
    sc=r.querySelectorAll('.packaging-shipping-point-row').length,
    el=r.querySelector('.packaging-tier-summary');
  if(el)el.textContent=(pc?pc+' Preisstaffel'+(pc===1?'':'n'):'keine Preisstaffeln')+' · '+(sc?sc+' Versandpunkt'+(sc===1?'':'e'):'keine Versandpunkte')
}
function renderPackagingTierData(r,s={}){
  const tiers=s.priceTiers||[],
    tierType=tiers[0]?.priceType==='set'?'set':'unit',
    typeSelect=r.querySelector('.packaging-tier-type');
  if(typeSelect)typeSelect.value=tierType;
  r.querySelector('.packaging-price-tiers').innerHTML=tiers.map(t=>packagingPriceTierRowHtml(t,tierType)).join('');
  r.querySelector('.packaging-shipping-points').innerHTML=(s.shippingPoints||[]).map(packagingShippingPointRowHtml).join('');
  if(tiers.length||(s.shippingPoints||[]).length)r.querySelector('.packaging-tier-panel')?.classList.remove('hidden');
  updatePackagingTierSummary(r);
  updatePackagingTierUnitDisplays(r);
  syncPackagingMainFieldsFromTiers(r)
}
function syncPackagingMainFieldsFromTiers(r){
  if(!r)return;
  const tiers=collectPackagingPriceTiers(r),
    points=collectPackagingShippingPoints(r),
    supplierType=r.querySelector('.packaging-supplier-price-type'),
    qtyInput=r.querySelector('.packaging-supplier-qty'),
    priceInput=r.querySelector('.packaging-supplier-price-entry'),
    shippingInput=r.querySelector('.packaging-supplier-total-shipping'),
    customsInput=r.querySelector('.packaging-supplier-customs');

  if(tiers.length){
    const smallest=tiers.slice().sort((a,b)=>a.minQty-b.minQty)[0],
      tierType=smallest.priceType==='set'?'set':'unit';

    // Staffelpreise sind maßgeblich: kleinste Staffel IMMER in Hauptzeile spiegeln.
    if(supplierType)supplierType.value=tierType;

    if(tierType==='set'){
      if(qtyInput)qtyInput.value=Math.max(1,num(smallest.setQty,smallest.minQty));
      if(priceInput)priceInput.value=num(smallest.setPrice);
    }else{
      if(qtyInput)qtyInput.value=Math.max(1,num(smallest.minQty,1));
      if(priceInput)priceInput.value=num(smallest.unitPrice);
    }

    const effectiveQty=Math.max(1,num(qtyInput?.value,smallest.minQty)),
      sp=points.find(p=>Math.max(1,num(p.qty,1))===effectiveQty);

    if(sp){
      const inc=num(sp.shippingWithCustoms),normal=num(sp.shipping);
      if(inc>0&&customsInput){
        customsInput.checked=false;
        customsInput.dataset.autoDisabledByShipping='1';
        customsInput.title='12 % Zoll deaktiviert, da Versand inkl. Zollabwicklung hinterlegt ist'
      }
      if(shippingInput){
        shippingInput.value=inc>0?inc:normal;
        shippingInput.dataset.autoFromShippingPoint='1'
      }
    }
  }

  updatePackagingSupplierDerived(r)
}
function updatePackagingTierUnitDisplays(r){
  if(!r)return;
  const globalTierType=r.querySelector('.packaging-tier-type')?.value==='set'?'set':'unit';

  r.querySelectorAll('.packaging-price-tier-row').forEach(row=>{
    const price=num(row.querySelector('.pack-tier-price')?.value),
      setQty=Math.max(1,num(row.querySelector('.pack-tier-set-qty')?.value,1)),
      unit=globalTierType==='set'?price/setQty:price,
      out=row.querySelector('.pack-tier-unit-display');
    if(out)out.value=unit>0?euro(unit):'–'
  });

  const tiers=collectPackagingPriceTiers(r),
    type=r.querySelector('.packaging-supplier-price-type')?.value||'unit';

  r.querySelectorAll('.packaging-shipping-point-row').forEach(row=>{
    const qty=Math.max(1,num(row.querySelector('.pack-ship-qty')?.value,1)),
      normal=num(row.querySelector('.pack-ship-normal')?.value),
      inc=num(row.querySelector('.pack-ship-customs')?.value),
      out=row.querySelector('.pack-ship-unit-display'),
      hit=tiers.find(t=>qty>=Math.max(1,num(t.minQty,1))&&(!num(t.maxQty)||qty<=num(t.maxQty))),
      entry=num(r.querySelector('.packaging-supplier-price-entry')?.value),
      baseQty=Math.max(1,num(r.querySelector('.packaging-supplier-qty')?.value,1));

    let unitPrice=0;
    if(hit&&num(hit.unitPrice)>0)unitPrice=num(hit.unitPrice);
    else if(type==='set')unitPrice=entry/baseQty;
    else if(type==='unit')unitPrice=entry;
    else if(type==='consumable'){
      const amount=Math.max(.0001,num(r.querySelector('.packaging-amount-per-package')?.value,1));
      unitPrice=entry/(baseQty*amount)
    }

    const shipping=inc>0?inc:normal;
    let total=unitPrice*qty+shipping;
    if(inc<=0&&r.querySelector('.packaging-supplier-customs')?.checked)total*=1.12;
    if(out)out.value=(unitPrice>0||shipping>0)?euro(total/qty):'–'
  })
}
function updatePackagingSupplierDerived(r){
  const s=packagingSupplierFromRow(r,0),unit=supplierLandedUnitCost(s),order=supplierOrderCost(s),consumption=s.priceType==='consumable';
  r.querySelector('.packaging-supplier-price-label').textContent=consumption?'Kaufpreis':(s.priceType==='set'?'Setpreis':'Stückpreis');
  r.querySelector('.packaging-supplier-qty-label').textContent=consumption?'Anzahl Gebinde':(s.priceType==='set'?'Stück im Set':'Mindestbestellmenge');
  r.querySelector('.packaging-unit-cost-label').textContent=consumption?'Preis/Einheit':'Preis/Stück';
  r.querySelector('.packaging-supplier-unit-cost').value=euro(unit);
  r.querySelector('.packaging-supplier-order-cost').value=euro(order);
  const extra=r.querySelector('.packaging-consumption-fields');if(extra)extra.classList.toggle('hidden',!consumption);
  if(consumption){
    const total=s.packageCount*s.amountPerPackage,te=r.querySelector('.packaging-total-consumption'),ue=r.querySelector('.packaging-unit-consumption-cost');
    if(te)te.value=total.toLocaleString('de-DE',{maximumFractionDigits:3})+' '+s.consumptionUnit;
    if(ue)ue.value=euro(unit)+' / '+s.consumptionUnit;
  }
}
function bindPackagingSupplierEvents(){
  $$('.packaging-supplier-row').forEach(r=>{
    const name=r.querySelector('.packaging-supplier-name'),
      customs=r.querySelector('.packaging-supplier-customs');
    let wasAlibaba=isAlibabaSupplierName(name.value);

    name.oninput=()=>{
      const now=isAlibabaSupplierName(name.value);
      if(now&&!wasAlibaba)customs.checked=true;
      wasAlibaba=now;
      customs.title=now?'Alibaba: 12 % Zoll automatisch vorausgewählt – kann ausgeschaltet werden':'12 % Zollpuffer auf Warenwert inklusive Versand';
      updatePackagingSupplierDerived(r);
      updatePackagingTierUnitDisplays(r)
    };

    r.querySelectorAll('.supplier-grid input,.supplier-grid select,.packaging-consumption-fields input,.packaging-consumption-fields select').forEach(el=>{
      el.oninput=()=>{updatePackagingSupplierDerived(r);updatePackagingTierUnitDisplays(r)};
      el.onchange=()=>{updatePackagingSupplierDerived(r);updatePackagingTierUnitDisplays(r)}
    });

    r.querySelector('.remove-packaging-supplier').onclick=()=>{
      if($$('.packaging-supplier-row').length<=1){alert('Mindestens ein Lieferant muss vorhanden bleiben.');return}
      const preferred=r.querySelector('.packaging-supplier-star').checked;
      r.remove();
      if(preferred&&$$('.packaging-supplier-star')[0])$$('.packaging-supplier-star')[0].checked=true
    };

    const toggle=r.querySelector('.toggle-packaging-tiers');
    if(toggle)toggle.onclick=()=>r.querySelector('.packaging-tier-panel')?.classList.toggle('hidden');

    const globalTierType=r.querySelector('.packaging-tier-type');
    if(globalTierType)globalTierType.onchange=()=>{
      const targetType=globalTierType.value==='set'?'set':'unit',
        existing=[...r.querySelectorAll('.packaging-price-tier-row')].map(row=>{
          const price=num(row.querySelector('.pack-tier-price')?.value),
            oldType=row.dataset.priceType==='set'?'set':'unit',
            oldSetQty=Math.max(1,num(row.querySelector('.pack-tier-set-qty')?.value,1)),
            oldMin=Math.max(1,num(row.querySelector('.pack-tier-min')?.value,1)),
            oldMax=num(row.querySelector('.pack-tier-max')?.value)||null;
          if(oldType==='set'){
            return {priceType:'set',setPrice:price,setQty:oldSetQty,unitPrice:price/oldSetQty,minQty:oldSetQty,maxQty:oldSetQty}
          }
          return {priceType:'unit',unitPrice:price,minQty:oldMin,maxQty:oldMax,setPrice:0,setQty:1}
        });

      const normalized=existing.map(t=>{
        if(targetType==='set'){
          const qty=Math.max(1,num(t.setQty,t.minQty,1)),
            setPrice=t.priceType==='set'?num(t.setPrice):num(t.unitPrice)*qty;
          return {priceType:'set',setPrice,setQty:qty,unitPrice:setPrice/qty,minQty:qty,maxQty:qty}
        }
        return {
          priceType:'unit',
          unitPrice:t.priceType==='set'?num(t.setPrice)/Math.max(1,num(t.setQty,1)):num(t.unitPrice),
          minQty:Math.max(1,num(t.minQty,t.setQty,1)),
          maxQty:t.priceType==='set'?null:t.maxQty,
          setPrice:0,setQty:1
        }
      });

      r.querySelector('.packaging-price-tiers').innerHTML=normalized.map(t=>packagingPriceTierRowHtml(t,targetType)).join('');
      bindPackagingSupplierEvents();
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    };

    const addTier=r.querySelector('.add-packaging-price-tier');
    if(addTier)addTier.onclick=()=>{
      r.querySelector('.packaging-tier-panel')?.classList.remove('hidden');
      r.querySelector('.packaging-price-tiers').insertAdjacentHTML('beforeend',packagingPriceTierRowHtml({minQty:1},r.querySelector('.packaging-tier-type')?.value==='set'?'set':'unit'));
      bindPackagingSupplierEvents();
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    };

    const addShip=r.querySelector('.add-packaging-shipping-point');
    if(addShip)addShip.onclick=()=>{
      r.querySelector('.packaging-tier-panel')?.classList.remove('hidden');
      r.querySelector('.packaging-shipping-points').insertAdjacentHTML('beforeend',packagingShippingPointRowHtml({qty:1}));
      bindPackagingSupplierEvents();
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    };

    r.querySelectorAll('.remove-packaging-price-tier').forEach(b=>b.onclick=()=>{
      b.closest('.packaging-price-tier-row')?.remove();
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    });

    r.querySelectorAll('.remove-packaging-shipping-point').forEach(b=>b.onclick=()=>{
      b.closest('.packaging-shipping-point-row')?.remove();
      const anyIncluded=[...r.querySelectorAll('.pack-ship-customs')].some(x=>num(x.value)>0);
      if(customs&&!anyIncluded){
        delete customs.dataset.autoDisabledByShipping;
        customs.title=isAlibabaSupplierName(name.value)
          ?'Alibaba: 12 % Zoll automatisch vorausgewählt – kann ausgeschaltet werden'
          :'12 % Zollpuffer auf Warenwert inklusive Versand'
      }
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    });

    r.querySelectorAll('.packaging-price-tier-row input,.packaging-shipping-point-row input').forEach(el=>{const tierHandler=()=>{
      if(el.classList.contains('pack-ship-customs')&&num(el.value)>0){
        customs.checked=false;
        customs.dataset.autoDisabledByShipping='1';
        customs.title='12 % Zoll deaktiviert, da Versand inkl. Zollabwicklung hinterlegt ist'
      }
      updatePackagingTierSummary(r);
      updatePackagingTierUnitDisplays(r);
      syncPackagingMainFieldsFromTiers(r)
    };el.oninput=tierHandler;el.onchange=tierHandler});

    updatePackagingSupplierDerived(r);
    updatePackagingTierUnitDisplays(r)
  })
}
function renderPackagingSupplierRows(list){
  const rows=list?.length?list:[{id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',customs:false,preferred:true,priceTiers:[],shippingPoints:[]}];
  $('#packagingSupplierRows').innerHTML=rows.map(packagingSupplierRowHtml).join('');
  $$('.packaging-supplier-row').forEach((r,i)=>renderPackagingTierData(r,rows[i]||{}));
  bindPackagingSupplierEvents();
}
function collectPackagingDraft(){
  return {
    key:$('#packagingKey').value||crypto.randomUUID(),
    vid:$('#packagingVid').value,
    name:$('#packagingName').value.trim(),
    status:$('#packagingStatus').value,
    suppliers:collectPackagingSuppliers(),
    notes:$('#packagingNotes').value.trim()
  };
}
function openPackaging(key=null){
  const v=key?state.packaging.find(x=>x.key===key):null;
  $('#packagingKey').value=v?.key||'';
  $('#packagingVid').value=v?.vid||'';
  $('#packagingVidLabel').textContent=v?.vid||'VID wird beim Speichern vergeben';
  $('#packagingModalTitle').textContent=v?'Verpackungsmaterial bearbeiten':'Neues Verpackungsmaterial';
  $('#packagingName').value=v?.name||'';
  $('#packagingStatus').value=v?.status||'idea';
  renderPackagingSupplierRows(v?.suppliers||[]);
  $('#packagingNotes').value=v?.notes||'';
  $('#deletePackagingBtn').classList.toggle('hidden',!v);
  $('#packagingDialog').showModal();
}
window.openPackaging=openPackaging;
function renderPackaging(){
  const q=normalizeText($('#searchPackaging')?.value||'');
  const list=(state.packaging||[]).slice()
    .sort((a,b)=>parseIdNumber(a.vid,'VID')-parseIdNumber(b.vid,'VID'))
    .filter(v=>!q||normalizeText([v.vid,v.name,...(v.suppliers||[]).map(s=>s.name)].join(' ')).includes(q));
  const body=$('#packagingBody');
  if(!body)return;
  body.innerHTML=list.length?list.map(v=>{
    const pref=(v.suppliers||[]).find(s=>s.preferred)||(v.suppliers||[])[0],
      img=pref?.imageUrl||'',
      unit=pref?supplierLandedUnitCost(pref):0,
      order=pref?supplierOrderCost(pref):0,
      links=(v.suppliers||[]).map(s=>{
        const href=safeUrl(s.url);
        return `<div class="supplier-link-row">${s.preferred?'<span class="star">⭐</span>':''}${href==='#'?`<span>${esc(s.name)}</span>`:`<a class="link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`}<span class="price">${euro(supplierLandedUnitCost(s))}/${s.priceType==='consumable'?esc(s.consumptionUnit||'Einheit'):'Stk.'}</span></div>`
      }).join('');
    return `<tr>
      <td><span class="idchip">${esc(v.vid)}</span></td>
      <td>${img?`<img class="product-thumb" src="${esc(img)}" alt="">`:'<div class="product-thumb-empty">kein Bild</div>'}</td>
      <td><div class="name">${esc(v.name)}</div></td>
      <td><span class="badge ${v.status}">${statusLabel(v.status)}</span></td>
      <td><div class="supplier-links">${links||'<span class="muted">–</span>'}</div></td>
      <td class="money">${pref?euro(unit):'–'}</td>
      <td class="money">${pref?euro(order):'–'}</td>
      <td><button type="button" class="btn packaging-edit" data-key="${esc(v.key)}">Bearbeiten</button></td>
    </tr>`;
  }).join(''):`<tr><td colspan="8" class="empty"><strong>Noch keine Verpackungsmaterialien</strong>Lege dein erstes Verpackungsmaterial an.</td></tr>`;
  $$('.packaging-edit').forEach(b=>b.onclick=()=>openPackaging(b.dataset.key));
}
function exportPackagingCsv(){
  const h=['VID','Verpackungsmaterial','Status','Lieferant','Bevorzugt','URL','Preisart','Eingabepreis','Mindestmenge / Setmenge','Versandkosten','Preis/Stück','Bestellwert','Bild-URL','Zoll 12 %','Notizen'];
  const rows=[];
  (state.packaging||[]).forEach(v=>{
    const suppliers=v.suppliers?.length?v.suppliers:[null];
    suppliers.forEach(s=>rows.push([
      v.vid,v.name,statusLabel(v.status),
      s?.name||'',s?.preferred?'Ja':'Nein',s?.url||'',
      s?.priceType==='set'?'Set':'Stück',
      s?(s.priceType==='set'?s.setPrice:s.price):'',
      s?(s.priceType==='set'?s.setQty:s.minOrderQty):'',
      s?.totalShipping??'',
      s?supplierLandedUnitCost(s):'',
      s?supplierOrderCost(s):'',
      s?.imageUrl||'',s?.customs?'Ja':'Nein',v.notes||''
    ]));
  });
  downloadText('batchies-verpackung-'+new Date().toISOString().slice(0,10)+'.csv',[h,...rows].map(r=>r.map(csvEscape).join(';')).join('\n'),'text/csv;charset=utf-8');
}
