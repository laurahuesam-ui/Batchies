
function ensureRealWarehouse(){
  if(!Array.isArray(state.realWarehouse))state.realWarehouse=[]
  if(!Array.isArray(state.salesHistory))state.salesHistory=[]
}
function warehouseItemObject(kind,id){
  return kind==='VID'?state.packaging.find(x=>x.vid===id):state.products.find(x=>x.pid===id)
}
function warehouseItemName(kind,id){return warehouseItemObject(kind,id)?.name||id}
function warehouseUnitLabel(kind,id){
  if(kind==='VID'){
    const v=warehouseItemObject(kind,id),s=preferredPackagingSupplier(v);
    if(s?.priceType==='consumable')return s.consumptionUnit||'Einheit'
  }
  return 'Stk.'
}
function warehouseColorOptionsFor(kind,id,includeAll=true){
  const obj=warehouseItemObject(kind,id);
  const defined=normalizeProductColors(obj?.colors);
  const stockColors=[...new Set((state.realWarehouse||[]).filter(x=>x.kind===kind&&x.itemId===id&&x.color).map(x=>x.color))];
  const list=[...new Set([...defined,...stockColors])];
  return includeAll?['',...list]:list
}
function warehouseColorLabel(color){return color||'Ohne Farbe'}
function warehouseColorChip(color){
  if(!color)return'<span class="warehouse-color-chip"><span class="dot"></span>Ohne Farbe</span>';
  const c=PRODUCT_COLOR_MAP[color];
  return `<span class="warehouse-color-chip"><span class="dot" style="--dot:${c?.hex||'#ddd'}"></span>${esc(color)}</span>`
}
function warehouseEntryUnitCost(x){return num(x.qty)>0?num(x.paidTotal)/num(x.qty):0}
function warehouseTotalValue(){return (state.realWarehouse||[]).reduce((a,x)=>a+num(x.paidTotal),0)}
function warehouseAggregate(){
  const map=new Map();
  (state.realWarehouse||[]).forEach(x=>{
    const k=x.kind+'|'+x.itemId+'|'+(x.color||'');
    if(!map.has(k))map.set(k,{kind:x.kind,itemId:x.itemId,color:x.color||'',qty:0,value:0});
    const a=map.get(k);a.qty+=num(x.qty);a.value+=num(x.paidTotal)
  });
  return [...map.values()]
}
function realStockQty(kind,id,color=null,strictColor=false){
  ensureRealWarehouse();
  return state.realWarehouse.reduce((sum,x)=>{
    if(x.kind!==kind||x.itemId!==id)return sum;
    if(strictColor){
      if((x.color||'')!==(color||''))return sum
    }else if(color){
      // colored batch may use exact-color lots plus neutral lots.
      if(x.color && x.color!==color)return sum
    }
    return sum+num(x.qty)
  },0)
}
function renderWarehouse(){
  const el=$('#warehouseTable');if(!el)return;
  ensureRealWarehouse();
  const q=($('#warehouseSearch')?.value||'').toLowerCase().trim(),
    type=$('#warehouseTypeFilter')?.value||'',
    rows=state.realWarehouse.filter(x=>(!type||x.kind===type)&&(!q||(x.itemId+' '+warehouseItemName(x.kind,x.itemId)+' '+warehouseColorLabel(x.color)+' '+(x.note||'')).toLowerCase().includes(q)));

  const agg=warehouseAggregate(),pidQty=agg.filter(x=>x.kind==='PID').reduce((a,x)=>a+x.qty,0),vidQty=agg.filter(x=>x.kind==='VID').reduce((a,x)=>a+x.qty,0);
  const summary=$('#warehouseSummary');
  if(summary)summary.innerHTML=`
    <div class="production-kpi"><div class="label">Lagerwert tatsächlich</div><div class="value">${euro(warehouseTotalValue())}</div></div>
    <div class="production-kpi"><div class="label">Lagerlose</div><div class="value">${state.realWarehouse.length}</div></div>
    <div class="production-kpi"><div class="label">PID-Menge</div><div class="value">${pidQty.toLocaleString('de-DE')}</div></div>
    <div class="production-kpi"><div class="label">VID-Menge</div><div class="value">${vidQty.toLocaleString('de-DE')}</div></div>`;

  if(!rows.length){el.innerHTML='<div class="empty"><strong>Noch keine passenden Lagerpositionen</strong>Lege deinen tatsächlichen Bestand über „+ Lagerposition“ an.</div>';return}
  el.innerHTML=`<div class="table-wrap"><table class="warehouse-table"><thead><tr><th>Art</th><th>ID</th><th>Artikel</th><th>Farbe</th><th>Menge</th><th>Tatsächlich gezahlt</th><th>Preis/Einheit</th><th>Notiz</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr>
    <td><span class="badge">${x.kind}</span></td><td><span class="idchip">${esc(x.itemId)}</span></td><td><div class="name">${esc(warehouseItemName(x.kind,x.itemId))}</div></td>
    <td>${warehouseColorChip(x.color)}</td><td>${num(x.qty).toLocaleString('de-DE')} ${esc(warehouseUnitLabel(x.kind,x.itemId))}</td>
    <td class="money">${euro(x.paidTotal)}</td><td class="money">${euro(warehouseEntryUnitCost(x))}</td><td>${esc(x.note||'–')}</td>
    <td><div class="inline"><button type="button" class="iconbtn warehouse-edit" data-key="${esc(x.key)}">✎</button><button type="button" class="iconbtn warehouse-delete" data-key="${esc(x.key)}">✕</button></div></td>
  </tr>`).join('')}</tbody></table></div>`;

  $$('.warehouse-edit').forEach(btn=>btn.onclick=()=>openWarehouseEntry(btn.dataset.key));
  $$('.warehouse-delete').forEach(btn=>btn.onclick=()=>{
    state.realWarehouse=state.realWarehouse.filter(x=>x.key!==btn.dataset.key);saveState()
  })
}
function warehouseFillItemOptions(selected=''){
  const kind=$('#warehouseKind')?.value==='VID'?'VID':'PID',el=$('#warehouseItem');if(!el)return;
  const list=kind==='VID'?state.packaging:state.products;
  el.innerHTML=list.map(x=>`<option value="${esc(kind==='VID'?x.vid:x.pid)}">${esc(kind==='VID'?x.vid:x.pid)} · ${esc(x.name)}</option>`).join('');
  if(list.some(x=>(kind==='VID'?x.vid:x.pid)===selected))el.value=selected;
  warehouseFillColorOptions()
}
function warehouseFillColorOptions(selected=null){
  const el=$('#warehouseColor');if(!el)return;
  const kind=$('#warehouseKind')?.value==='VID'?'VID':'PID',id=$('#warehouseItem')?.value||'';
  const defined=normalizeProductColors(warehouseItemObject(kind,id)?.colors);
  const all=defined.length?defined:PRODUCT_COLORS.map(c=>c.name);
  el.innerHTML='<option value="">Ohne Farbe</option>'+all.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(selected!==null&&[...el.options].some(o=>o.value===selected))el.value=selected
}
function warehouseUpdateUnitPreview(){
  const q=Math.max(0,num($('#warehouseQty')?.value)),t=Math.max(0,num($('#warehousePaidTotal')?.value));
  const el=$('#warehousePaidUnit');if(el)el.value=q>0?euro(t/q):'0,00 €'
}
function openWarehouseEntry(key=''){
  ensureRealWarehouse();
  const x=state.realWarehouse.find(x=>x.key===key);
  $('#warehouseEntryKey').value=x?.key||'';
  $('#warehouseKind').value=x?.kind||'PID';
  warehouseFillItemOptions(x?.itemId||'');
  warehouseFillColorOptions(x?.color||'');
  $('#warehouseQty').value=x?.qty??1;
  $('#warehousePaidTotal').value=x?.paidTotal??0;
  $('#warehouseNote').value=x?.note||'';
  $('#warehouseModalTitle').textContent=x?'Lagerposition bearbeiten':'Lagerposition hinzufügen';
  warehouseUpdateUnitPreview();
  $('#warehouseDialog').showModal()
}
function saveWarehouseEntry(){
  ensureRealWarehouse();
  const key=$('#warehouseEntryKey').value||crypto.randomUUID(),
    kind=$('#warehouseKind').value==='VID'?'VID':'PID',
    itemId=$('#warehouseItem').value,
    color=$('#warehouseColor').value||'',
    qty=Math.max(0,num($('#warehouseQty').value)),
    paidTotal=Math.max(0,num($('#warehousePaidTotal').value)),
    note=$('#warehouseNote').value.trim();
  if(!itemId||qty<=0){alert('Bitte Artikel und eine Menge größer 0 eintragen.');return}
  const old=state.realWarehouse.find(x=>x.key===key);
  const obj={key,kind,itemId,color,qty,paidTotal,note,createdAt:old?.createdAt||new Date().toISOString()};
  const idx=state.realWarehouse.findIndex(x=>x.key===key);
  if(idx>=0)state.realWarehouse[idx]=obj;else state.realWarehouse.push(obj);
  $('#warehouseDialog').close();saveState()
}
function bindWarehouseUi(){
  const add=$('#warehouseAddBtn'),dlg=$('#warehouseDialog');if(!add||!dlg)return;
  add.onclick=()=>openWarehouseEntry();
  $('#warehouseCloseBtn').onclick=()=>dlg.close();$('#warehouseCancelBtn').onclick=()=>dlg.close();$('#warehouseSaveBtn').onclick=saveWarehouseEntry;
  $('#warehouseKind').onchange=()=>warehouseFillItemOptions();
  $('#warehouseItem').onchange=()=>warehouseFillColorOptions();
  $('#warehouseQty').oninput=warehouseUpdateUnitPreview;$('#warehousePaidTotal').oninput=warehouseUpdateUnitPreview;
  $('#warehouseSearch').oninput=renderWarehouse;$('#warehouseTypeFilter').onchange=renderWarehouse
}
