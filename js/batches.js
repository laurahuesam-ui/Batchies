

function preferredPackagingSupplier(v){return (v?.suppliers||[]).find(s=>s.preferred)||(v?.suppliers||[])[0]||null}
function packagingPurchaseCost(v){const s=preferredPackagingSupplier(v);return s?supplierLandedUnitCost(s):0}
function sortBatchItemsByPid(items){return [...(items||[])].sort((a,b)=>parseIdNumber(a.pid,'PID')-parseIdNumber(b.pid,'PID')||String(a.pid).localeCompare(String(b.pid),'de',{numeric:true}))}
function sortBatchPackagingByVid(items){return [...(items||[])].sort((a,b)=>parseIdNumber(a.vid,'VID')-parseIdNumber(b.vid,'VID')||String(a.vid).localeCompare(String(b.vid),'de',{numeric:true}))}

function batchProductionPlan(b){
  const pg=new Map(),vg=new Map();
  (b.items||[]).forEach(i=>{if(i.pid)pg.set(i.pid,(pg.get(i.pid)||0)+Math.max(1,num(i.qty,1)))});
  (b.packagingItems||[]).forEach(i=>{if(i.vid)vg.set(i.vid,(vg.get(i.vid)||0)+Math.max(1,num(i.qty,1)))});
  const productLines=[],packagingLines=[];let firstOrderCost=0,possible=Infinity,missing=false;
  pg.forEach((qty,id)=>{const x=state.products.find(p=>p.pid===id),s=(x?.suppliers||[]).find(z=>z.preferred)||(x?.suppliers||[])[0];if(!x||!s){missing=true;productLines.push({id,name:x?.name||'Produkt fehlt',qty,available:0,orderCost:0,batches:0,missing:true});possible=0;return}const available=supplierQtyBase(s),orderCost=supplierOrderCost(s),count=Math.floor(available/qty);firstOrderCost+=orderCost;possible=Math.min(possible,count);productLines.push({id,name:x.name,qty,available,orderCost,batches:count,missing:false})});
  vg.forEach((qty,id)=>{const x=state.packaging.find(v=>v.vid===id),s=preferredPackagingSupplier(x);if(!x||!s){missing=true;packagingLines.push({id,name:x?.name||'Verpackung fehlt',qty,available:0,orderCost:0,batches:0,missing:true});possible=0;return}const available=supplierQtyBase(s),orderCost=supplierOrderCost(s),count=Math.floor(available/qty);firstOrderCost+=orderCost;possible=Math.min(possible,count);packagingLines.push({id,name:x.name,qty,available,orderCost,batches:count,missing:false})});
  const lines=[...productLines,...packagingLines];if(possible===Infinity)possible=0;const limiter=lines.filter(x=>x.batches===possible&&!x.missing);
  return{productLines,packagingLines,lines,firstOrderCost,possible,limiter,totalInvestment:firstOrderCost,unitBatchCost:batchCalc(b).total,missing};
}
function productionLinesHtml(lines,label){if(!lines.length)return'';return`<div class="tiny" style="font-weight:800;margin:12px 0 5px">${esc(label)}</div><div class="production-lines"><div class="production-line head"><span>ID · Position</span><span>Bedarf/Batch</span><span>1. Bestellung</span><span>Reicht für</span></div>${lines.map(x=>`<div class="production-line"><span><b>${esc(x.id)}</b> · ${esc(x.name)}</span><span>${x.qty} Stk.</span><span>${x.missing?'–':x.available+' Stk. · '+euro(x.orderCost)}</span><span>${x.missing?'–':x.batches+' Batches'}</span></div>`).join('')}</div>`}
function renderBatchProductionPlan(b){const el=$('#batchProductionContent');if(!el)return;const p=batchProductionPlan(b);if(!p.lines.length){el.innerHTML='<div class="assistant-empty" style="margin-top:10px">Füge Produkte oder Verpackungsmaterialien hinzu, um die Herstellungsplanung zu berechnen.</div>';return}const limiter=p.limiter.length?p.limiter.map(x=>esc(x.id+' · '+x.name)).join(', '):(p.missing?'Lieferantendaten fehlen':'–');el.innerHTML=`<div class="production-kpis"><div class="production-kpi"><div class="label">1. AK</div><div class="value">${euro(p.firstOrderCost)}</div></div><div class="production-kpi"><div class="label">Mögliche vollständige Batches</div><div class="value">${p.possible}</div></div><div class="production-kpi"><div class="label">Engpass</div><div class="value" style="font-size:12px">${limiter}</div></div><div class="production-kpi"><div class="label">Material-EK pro Batch</div><div class="value">${euro(p.unitBatchCost)}</div></div></div><div class="tiny" style="margin-top:7px">Die 1. AK berücksichtigt PIDs und VIDs jeweils mit MOQ bzw. Set, Versand und aktiviertem Zoll.${p.missing?' Für mindestens eine Position fehlen Lieferantendaten.':''}</div>${productionLinesHtml(p.productLines,'Produkte (PID)')}${productionLinesHtml(p.packagingLines,'Verpackung (VID)')}`}

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
    '<th class="batch-margin-col">Marge</th>'+
    '<th class="batch-action-col"></th>'+
    '</tr></thead><tbody>'+
    bs.map(b=>{
      const c=batchCalc(b),prod=batchProductionPlan(b);
      return `<tr>
        <td class="batch-id-col"><span class="idchip">${esc(b.bid)}</span></td>
        <td class="batch-name-col"><div class="name">${esc(b.name)}</div></td>
        <td class="batch-status-col"><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
        <td class="batch-products-col"><div class="batch-products-list">${(b.items||[]).map(i=>esc(i.pid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="batch-vid-col"><div class="batch-vid-list">${(b.packagingItems||[]).map(i=>esc(i.vid)+' × '+num(i.qty,1)).join(', ')||'–'}</div></td>
        <td class="money batch-first-order-col">${euro(prod.firstOrderCost)}</td>
        <td class="money batch-ek-col">${euro(c.total)}</td>
        <td class="money positive batch-rec-col">${euro(c.recommended)}</td>
        <td class="money batch-vk-col">${euro(b.salePrice)}</td>
        <td class="batch-margin-col ${c.margin>=num(b.targetMargin,30)?'positive':'negative'}">${pct(c.margin)}</td>
        <td class="batch-action-col"><button type="button" class="iconbtn batch-edit-btn" data-key="${esc(b.key)}" title="Batch bearbeiten">✎</button></td>
      </tr>`
    }).join('')+
    '</tbody></table></div>';

}
function renderBatchItemRows(items){items=sortBatchItemsByPid(items);const opts='<option value="">Produkt wählen …</option>'+state.products.map(p=>`<option value="${esc(p.pid)}">${esc(p.pid)} · ${esc(p.name)}</option>`).join('');$('#batchItemRows').innerHTML=(items.length?items:[{pid:'',qty:1}]).map(i=>`<div class="batch-item-row"><select class="batch-product">${opts}</select><input class="batch-qty" type="number" min="1" step="1" value="${Math.max(1,num(i.qty,1))}"><div class="money batch-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-item">✕</button></div>`).join('');$$('#batchItemRows .batch-item-row').forEach((r,idx)=>{r.querySelector('.batch-product').value=items[idx]?.pid||''});bindBatchItemEvents()}
function bindBatchItemEvents(){$$('#batchItemRows .batch-product,#batchItemRows .batch-qty').forEach(e=>e.addEventListener('input',liveBatchCalc));$$('#batchItemRows .remove-batch-item').forEach(b=>b.addEventListener('click',()=>{b.closest('.batch-item-row').remove();liveBatchCalc()}))}
function renderBatchPackagingRows(items){items=sortBatchPackagingByVid(items);const opts='<option value="">Verpackung wählen …</option>'+state.packaging.map(v=>`<option value="${esc(v.vid)}">${esc(v.vid)} · ${esc(v.name)}</option>`).join('');$('#batchPackagingRows').innerHTML=(items.length?items:[{vid:'',qty:1}]).map(i=>`<div class="batch-item-row batch-packaging-row"><select class="batch-packaging">${opts}</select><input class="batch-packaging-qty" type="number" min="1" step="1" value="${Math.max(1,num(i.qty,1))}"><div class="money batch-packaging-line-cost">0,00 €</div><button type="button" class="iconbtn remove-batch-packaging">✕</button></div>`).join('');$$('#batchPackagingRows .batch-packaging-row').forEach((r,idx)=>{r.querySelector('.batch-packaging').value=items[idx]?.vid||''});bindBatchPackagingEvents()}
function bindBatchPackagingEvents(){$$('#batchPackagingRows .batch-packaging,#batchPackagingRows .batch-packaging-qty').forEach(e=>e.addEventListener('input',liveBatchCalc));$$('#batchPackagingRows .remove-batch-packaging').forEach(b=>b.addEventListener('click',()=>{b.closest('.batch-packaging-row').remove();liveBatchCalc()}))}

function collectBatchDraft(){return{key:$('#batchKey').value||crypto.randomUUID(),bid:$('#batchBid').value,name:$('#batchName').value.trim(),status:$('#batchStatus').value,items:$$('#batchItemRows .batch-item-row').map(r=>({pid:r.querySelector('.batch-product').value,qty:Math.max(1,num(r.querySelector('.batch-qty').value,1))})).filter(i=>i.pid),packagingItems:$$('#batchPackagingRows .batch-packaging-row').map(r=>({vid:r.querySelector('.batch-packaging').value,qty:Math.max(1,num(r.querySelector('.batch-packaging-qty').value,1))})).filter(i=>i.vid),targetMargin:num($('#batchTargetMargin').value,30),salePrice:num($('#batchSalePrice').value),useOffsite:$('#batchUseOffsite').checked,useCurrency:$('#batchUseCurrency').checked,useSetup:$('#batchUseSetup').checked,notes:$('#batchNotes').value.trim()}}
function liveBatchCalc(){const b=collectBatchDraft(),c=batchCalc(b);$$('#batchItemRows .batch-item-row').forEach(r=>{const x=state.products.find(p=>p.pid===r.querySelector('.batch-product').value),q=Math.max(1,num(r.querySelector('.batch-qty').value,1));r.querySelector('.batch-line-cost').textContent=euro(x?productPurchaseCost(x)*q:0)});$$('#batchPackagingRows .batch-packaging-row').forEach(r=>{const x=state.packaging.find(v=>v.vid===r.querySelector('.batch-packaging').value),q=Math.max(1,num(r.querySelector('.batch-packaging-qty').value,1));r.querySelector('.batch-packaging-line-cost').textContent=euro(x?packagingPurchaseCost(x)*q:0)});$('#batchProductsCost').textContent=euro(c.productCost);$('#batchPackagingCostLive').textContent=euro(c.packagingCost);$('#batchTotalCost').textContent=euro(c.total);$('#batchFeesLive').textContent=euro(c.fees);$('#batchProfitLive').textContent=euro(c.profit);$('#batchMarginLive').textContent=pct(c.margin);$('#batchRecommended').textContent=euro(c.recommended);renderBatchProductionPlan(b);if($('#batchKey').value&&typeof renderBatchAssistant==='function')renderBatchAssistant(b)}
function openBatch(key=null){
  const dlg=$('#batchDialog');
  const b=key?state.batches.find(x=>x.key===key):null;
  if(key&&!b)return false;
  if(dlg.open)dlg.close();
  $('#batchKey').value=b?.key||'';$('#batchBid').value=b?.bid||'';$('#batchBidLabel').textContent=b?.bid||'BID wird beim Speichern vergeben';$('#batchModalTitle').textContent=b?'Batch bearbeiten':'Neuer Batch';$('#batchName').value=b?.name||'';$('#batchStatus').value=b?.status||'idea';renderBatchItemRows(b?.items||[]);renderBatchPackagingRows(b?.packagingItems||[]);$('#batchTargetMargin').value=b?.targetMargin??30;$('#batchSalePrice').value=b?.salePrice??0;$('#batchUseOffsite').checked=!!b?.useOffsite;$('#batchUseCurrency').checked=!!b?.useCurrency;$('#batchUseSetup').checked=!!b?.useSetup;$('#batchNotes').value=b?.notes||'';$('#deleteBatchBtn').classList.toggle('hidden',!b);
  liveBatchCalc();
  dlg.showModal();
  if(b&&typeof renderBatchAssistant==='function'){try{renderBatchAssistant(b)}catch(err){console.error('Batch-Assistent:',err)}}
  return true;
}
window.openBatch=openBatch;
