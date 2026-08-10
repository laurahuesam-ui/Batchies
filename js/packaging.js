
function packagingSupplierRowHtml(s){
  const entry=s.priceType==='set'?num(s.setPrice):num(s.price),
    qty=s.priceType==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1)),
    unit=supplierLandedUnitCost(s),
    order=supplierOrderCost(s);
  return `<div class="packaging-supplier-row supplier-row" data-id="${esc(s.id||crypto.randomUUID())}">
    <div class="supplier-grid">
      <div class="supplier-cell"><span class="supplier-mini-label">Lieferant</span><input class="packaging-supplier-name" value="${esc(s.name||'')}" placeholder="Lieferant"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">URL</span><input class="packaging-supplier-url" type="url" value="${esc(s.url||'')}" placeholder="https://…"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Preisart</span><select class="packaging-supplier-price-type"><option value="unit" ${s.priceType!=='set'?'selected':''}>Stück</option><option value="set" ${s.priceType==='set'?'selected':''}>Set</option></select></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-price-label">${s.priceType==='set'?'Setpreis':'Stückpreis'}</span><input class="packaging-supplier-price-entry" type="number" min="0" step="0.0001" value="${entry}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label packaging-supplier-qty-label">${s.priceType==='set'?'Stück im Set':'Mindestbestellmenge'}</span><input class="packaging-supplier-qty" type="number" min="1" step="1" value="${qty}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Versandkosten</span><input class="packaging-supplier-total-shipping" type="number" min="0" step="0.01" value="${num(s.totalShipping)}"></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Preis/Stück</span><input class="packaging-supplier-unit-cost" value="${euro(unit)}" readonly></div>
      <div class="supplier-cell"><span class="supplier-mini-label">Bestellwert</span><input class="packaging-supplier-order-cost" value="${euro(order)}" readonly></div>
      <div class="supplier-cell supplier-image-cell"><span class="supplier-mini-label">Bild-URL</span><input class="packaging-supplier-image" type="url" value="${esc(s.imageUrl||'')}" placeholder="https://…"></div>
      <div class="supplier-cell customs-cell"><span class="supplier-mini-label">Zoll</span><label class="supplier-toggle" title="12 % Zollpuffer"><input class="packaging-supplier-customs" type="checkbox" ${s.customs?'checked':''}><span>12 %</span></label></div>
      <div class="supplier-cell preferred-cell"><span class="supplier-mini-label">Bevorzugt</span><label class="supplier-preferred" title="Bevorzugter Lieferant"><input class="packaging-supplier-star" type="radio" name="preferredPackagingSupplier" ${s.preferred?'checked':''}><span>⭐</span></label></div>
      <div class="supplier-remove-cell"><span class="supplier-mini-label">&nbsp;</span><button type="button" class="iconbtn remove-packaging-supplier" title="Lieferant entfernen">✕</button></div>
    </div>
  </div>`;
}
function packagingSupplierFromRow(r,i){
  const type=r.querySelector('.packaging-supplier-price-type').value==='set'?'set':'unit',
    entry=num(r.querySelector('.packaging-supplier-price-entry').value),
    qty=Math.max(1,num(r.querySelector('.packaging-supplier-qty').value,1));
  return {
    id:r.dataset.id||crypto.randomUUID(),
    name:r.querySelector('.packaging-supplier-name').value.trim()||'Lieferant '+(i+1),
    url:r.querySelector('.packaging-supplier-url').value.trim(),
    priceType:type,
    price:type==='set'?entry/qty:entry,
    minOrderQty:type==='unit'?qty:1,
    setPrice:type==='set'?entry:0,
    setQty:type==='set'?qty:1,
    totalShipping:num(r.querySelector('.packaging-supplier-total-shipping').value),
    imageUrl:r.querySelector('.packaging-supplier-image').value.trim(),
    customs:r.querySelector('.packaging-supplier-customs').checked,
    preferred:r.querySelector('.packaging-supplier-star').checked
  };
}
function collectPackagingSuppliers(){return $$('.packaging-supplier-row').map(packagingSupplierFromRow)}
function packagingPreferredSupplierFromDraft(){const a=collectPackagingSuppliers();return a.find(x=>x.preferred)||a[0]}
function updatePackagingSupplierDerived(r){
  const s=packagingSupplierFromRow(r,0),
    unit=supplierLandedUnitCost(s),
    order=supplierOrderCost(s),
    type=s.priceType;
  r.querySelector('.packaging-supplier-price-label').textContent=type==='set'?'Setpreis':'Stückpreis';
  r.querySelector('.packaging-supplier-qty-label').textContent=type==='set'?'Stück im Set':'Mindestbestellmenge';
  r.querySelector('.packaging-supplier-unit-cost').value=euro(unit);
  r.querySelector('.packaging-supplier-order-cost').value=euro(order);
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
        return `<div class="supplier-link-row">${s.preferred?'<span class="star">⭐</span>':''}${href==='#'?`<span>${esc(s.name)}</span>`:`<a class="link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`}<span class="price">${euro(supplierLandedUnitCost(s))}/Stk.</span></div>`
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
