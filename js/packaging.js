
function packagingSupplierRowHtml(s){
  const type=s.priceType==='consumable'?'consumable':(s.priceType==='set'?'set':'unit'),
    qty=type==='consumable'?Math.max(1,num(s.packageCount,1)):(type==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))),
    entry=type==='consumable'?num(s.purchasePrice):(type==='set'?num(s.setPrice):num(s.price)),
    unit=supplierLandedUnitCost(s),order=supplierOrderCost(s),
    amount=Math.max(0.0001,num(s.amountPerPackage,1)),cunit=s.consumptionUnit||'m';
  return `<div class="packaging-supplier-row supplier-row" data-id="${esc(s.id||crypto.randomUUID())}">
    <div class="supplier-grid">
      <div class="supplier-cell"><span class="supplier-mini-label">Lieferant</span><input class="packaging-supplier-name" value="${esc(s.name||'')}" placeholder="Lieferant"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">URL</span><input class="packaging-supplier-url" type="url" value="${esc(s.url||'')}" placeholder="https://…"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Preisart</span><select class="packaging-supplier-price-type"><option value="unit" ${type==='unit'?'selected':''}>Stück</option><option value="set" ${type==='set'?'selected':''}>Set</option><option value="consumable" ${type==='consumable'?'selected':''}>Verbrauch</option></select></div>
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
    customs:r.querySelector('.packaging-supplier-customs').checked,preferred:r.querySelector('.packaging-supplier-star').checked};
}
function collectPackagingSuppliers(){return $$('.packaging-supplier-row').map(packagingSupplierFromRow)}
function packagingPreferredSupplierFromDraft(){const a=collectPackagingSuppliers();return a.find(x=>x.preferred)||a[0]}
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
    name.addEventListener('input',()=>{
      const now=isAlibabaSupplierName(name.value);
      if(now&&!wasAlibaba)customs.checked=true;
      wasAlibaba=now;
      updatePackagingSupplierDerived(r);
    });
    r.querySelectorAll('input,select').forEach(el=>{
      el.oninput=()=>updatePackagingSupplierDerived(r);
      el.onchange=()=>updatePackagingSupplierDerived(r);
    });
    r.querySelector('.remove-packaging-supplier').onclick=()=>{
      if($$('.packaging-supplier-row').length<=1){alert('Mindestens ein Lieferant muss vorhanden bleiben.');return}
      const preferred=r.querySelector('.packaging-supplier-star').checked;
      r.remove();
      if(preferred&&$$('.packaging-supplier-star')[0])$$('.packaging-supplier-star')[0].checked=true;
    };
    updatePackagingSupplierDerived(r);
  });
}
function renderPackagingSupplierRows(list){
  const rows=list?.length?list:[{id:crypto.randomUUID(),name:'',url:'',priceType:'unit',price:0,minOrderQty:1,setPrice:0,setQty:1,totalShipping:0,imageUrl:'',customs:false,preferred:true}];
  $('#packagingSupplierRows').innerHTML=rows.map(packagingSupplierRowHtml).join('');
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
