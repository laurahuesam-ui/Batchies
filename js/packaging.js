
function packagingSupplierRowHtml(s){
  const type=s.priceType==='consumable'?'consumable':(s.priceType==='set'?'set':'unit'),
    qty=type==='consumable'?Math.max(1,num(s.packageCount,1)):(type==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))),
    entry=type==='consumable'?num(s.purchasePrice,num(s.setPrice,num(s.price))):(type==='set'?num(s.setPrice):num(s.price)),
    unit=supplierLandedUnitCost(s),
    order=supplierOrderCost(s),
    amount=Math.max(0.0001,num(s.amountPerPackage,1)),
    cunit=s.consumptionUnit||'m';
  return `<div class="packaging-supplier-row supplier-row" data-id="${esc(s.id||crypto.randomUUID())}">
    <div class="supplier-grid">
      <div class="supplier-cell"><span class="supplier-mini-label">Lieferant</span><input class="packaging-supplier-name" value="${esc(s.name||'')}" placeholder="Lieferant"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">URL</span><input class="packaging-supplier-url" type="url" value="${esc(s.url||'')}" placeholder="https://…"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Preisart</span><select class="packaging-supplier-price-type"><option value="unit" ${type==='unit'?'selected':''}>Stück</option><option value="set" ${type==='set'?'selected':''}>Set</option><option value="consumable" ${type==='consumable'?'selected':''}>Verbrauch</option></select></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-price-label">${type==='consumable'?'Kaufpreis':(type==='set'?'Setpreis':'Stückpreis')}</span><input class="packaging-supplier-price-entry" type="number" min="0" step="0.0001" value="${entry}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-qty-label">${type==='consumable'?'Anzahl Gebinde':(type==='set'?'Stück im Set':'Mindestbestellmenge')}</span><input class="packaging-supplier-qty" type="number" min="1" step="1" value="${qty}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Versandkosten</span><input class="packaging-supplier-total-shipping" type="number" min="0" step="0.01" value="${num(s.totalShipping)}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">${type==='consumable'?'Preis/Einheit':'Preis/Stück'}</span><input class="packaging-supplier-unit-cost" value="${euro(unit)}" readonly></div>
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
  </div>`}
function packagingSupplierFromRow(r,i){
  const rawType=r.querySelector('.packaging-supplier-price-type').value,
    type=rawType==='consumable'?'consumable':(rawType==='set'?'set':'unit'),
    entry=num(r.querySelector('.packaging-supplier-price-entry').value),
    qty=Math.max(1,num(r.querySelector('.packaging-supplier-qty').value,1)),
    amountPerPackage=Math.max(0.0001,num(r.querySelector('.packaging-amount-per-package')?.value,1)),
    consumptionUnit=r.querySelector('.packaging-consumption-unit')?.value||'m';
  return {
    id:r.dataset.id||crypto.randomUUID(),
    name:r.querySelector('.packaging-supplier-name').value.trim()||'Lieferant '+(i+1),
    url:r.querySelector('.packaging-supplier-url').value.trim(),
    priceType:type,
    price:type==='set'?entry/qty:(type==='consumable'?0:entry),
    minOrderQty:type==='unit'?qty:1,
    setPrice:type==='set'?entry:0,
    setQty:type==='set'?qty:1,
    purchasePrice:type==='consumable'?entry:0,
    packageCount:type==='consumable'?qty:1,
    amountPerPackage:type==='consumable'?amountPerPackage:1,
    consumptionUnit:type==='consumable'?consumptionUnit:'Stück',
    totalShipping:num(r.querySelector('.packaging-supplier-total-shipping').value),
    imageUrl:r.querySelector('.packaging-supplier-image').value.trim(),
    customs:r.querySelector('.packaging-supplier-customs').checked,
    preferred:r.querySelector('.packaging-supplier-star').checked
  };
}
function updatePackagingSupplierDerived(r){
  const s=packagingSupplierFromRow(r,0),
    unit=supplierLandedUnitCost(s),
    order=supplierOrderCost(s),
    type=s.priceType,
    consumption=type==='consumable';
  r.querySelector('.packaging-supplier-price-label').textContent=consumption?'Kaufpreis':(type==='set'?'Setpreis':'Stückpreis');
  r.querySelector('.packaging-supplier-qty-label').textContent=consumption?'Anzahl Gebinde':(type==='set'?'Stück im Set':'Mindestbestellmenge');
  r.querySelector('.packaging-supplier-unit-cost').value=euro(unit);
  r.querySelector('.packaging-supplier-unit-cost').previousElementSibling.textContent=consumption?'Preis/Einheit':'Preis/Stück';
  r.querySelector('.packaging-supplier-order-cost').value=euro(order);
  r.querySelector('.packaging-consumption-fields')?.classList.toggle('hidden',!consumption);
  if(consumption){
    const total=s.packageCount*s.amountPerPackage;
    const totalEl=r.querySelector('.packaging-total-consumption');
    const unitEl=r.querySelector('.packaging-unit-consumption-cost');
    if(totalEl)totalEl.value=total.toLocaleString('de-DE',{maximumFractionDigits:3})+' '+s.consumptionUnit;
    if(unitEl)unitEl.value=euro(unit)+' / '+s.consumptionUnit;
  }
}
