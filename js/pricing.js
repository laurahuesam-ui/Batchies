function variableFeeRate(p){const s=state.settings;let r=(s.transactionPct+s.paymentPct)/100;if(p?.useOffsite)r+=s.offsitePct/100;if(p?.useCurrency)r+=s.currencyPct/100;return r}
function fixedFees(p){const s=state.settings;let f=s.listingFee+s.paymentFixed;if(p?.useSetup&&s.setupSales>0)f+=s.setupFee/s.setupSales;return f}
function supplierUnitSetSize(s){return s?.priceType==='unit'&&s?.unitIsSet?Math.max(1,num(s.unitSetQty,1)):1}
function supplierRawQtyToPieces(s,rawQty){const q=Math.max(0,num(rawQty));return s?.priceType==='unit'?q*supplierUnitSetSize(s):q}
function supplierPiecesToRawQty(s,pieces){const q=Math.max(0,num(pieces));return s?.priceType==='unit'?Math.ceil(q/supplierUnitSetSize(s)-1e-9):q}
function supplierActiveCalcSource(s){
  if(!s)return{type:'main',qty:null};
  const src=s.activeCalcSource;
  if(src&&typeof src==='object'&&['main','tier','shipping'].includes(src.type)){
    if(src.type==='main')return{type:'main',qty:null};
    const q=Math.max(1,num(src.qty,1));
    if(src.type==='tier'&&(s.priceTiers||[]).some(t=>Math.max(1,num(t.minQty,1))===q))return{type:'tier',qty:q};
    if(src.type==='shipping'&&(s.shippingPoints||[]).some(p=>Math.max(1,num(p.qty,1))===q))return{type:'shipping',qty:q}
  }
  const tiers=(s.priceTiers||[]).slice().sort((a,b)=>num(a.minQty)-num(b.minQty));
  return tiers.length?{type:'tier',qty:Math.max(1,num(tiers[0].minQty,1))}:{type:'main',qty:null}
}
function supplierCalcRawQty(s){
  if(!s)return 1;
  if(s.priceType==='set'||s.priceType==='consumable')return supplierQtyBase(s);
  const src=supplierActiveCalcSource(s),moq=Math.max(1,num(s.minOrderQty,1));
  return src.type==='main'?moq:Math.max(moq,Math.max(1,num(src.qty,1)))
}
function supplierCalcQty(s){
  if(!s)return 1;
  if(s.priceType==='set'||s.priceType==='consumable')return supplierQtyBase(s);
  return supplierRawQtyToPieces(s,supplierCalcRawQty(s))
}
function supplierCalcUnitPrice(s){
  if(!s)return 0;
  if(s.priceType==='set'||s.priceType==='consumable')return supplierUnitPrice(s);
  const src=supplierActiveCalcSource(s),factor=supplierUnitSetSize(s);
  if(src.type==='tier'){
    const hit=(s.priceTiers||[]).find(t=>Math.max(1,num(t.minQty,1))===src.qty);
    if(hit&&num(hit.unitPrice)>0)return num(hit.unitPrice)/factor
  }
  return supplierTierUnitPrice(s,supplierCalcQty(s))
}
function supplierCalcShipping(s){
  if(!s)return{shipping:0,includesCustoms:false};
  const src=supplierActiveCalcSource(s);
  if(src.type==='shipping'){
    const hit=(s.shippingPoints||[]).find(p=>Math.max(1,num(p.qty,1))===src.qty);
    if(hit){
      const incl=num(hit.shippingWithCustoms);
      return incl>0?{shipping:incl,includesCustoms:true}:{shipping:num(hit.shipping),includesCustoms:false}
    }
  }
  return supplierShippingForQty(s,supplierCalcQty(s))
}
function supplierQtyBase(s){if(!s)return 1;if(s.priceType==='consumable')return Math.max(0.0001,Math.max(1,num(s.packageCount,1))*Math.max(0.0001,num(s.amountPerPackage,1)));if(s.priceType==='set')return Math.max(1,num(s.setQty,1));return supplierRawQtyToPieces(s,Math.max(1,num(s.minOrderQty,1)))}
function supplierUnitPrice(s){if(!s)return 0;if(s.priceType==='consumable')return num(s.purchasePrice)/supplierQtyBase(s);if(s.priceType==='set')return num(s.setPrice)/Math.max(1,num(s.setQty,1));return num(s.price)/supplierUnitSetSize(s)}
function supplierTierUnitPrice(s,qty=supplierQtyBase(s)){const tiers=(s?.priceTiers||[]).slice().sort((a,b)=>num(a.minQty)-num(b.minQty)),raw=Math.max(1,supplierPiecesToRawQty(s,qty)),factor=supplierUnitSetSize(s);const hit=tiers.find(x=>raw>=Math.max(1,num(x.minQty,1))&&(!num(x.maxQty)||raw<=num(x.maxQty)));return hit&&num(hit.unitPrice)>0?num(hit.unitPrice)/factor:supplierUnitPrice(s)}
function supplierShippingForQty(s,qty=supplierQtyBase(s)){const raw=Math.max(1,supplierPiecesToRawQty(s,qty)),points=s?.shippingPoints||[],hit=points.find(x=>Math.max(1,num(x.qty,1))===raw);if(hit){const actual=num(hit.shippingWithCustoms);return actual>0?{shipping:actual,includesCustoms:true}:{shipping:num(hit.shipping),includesCustoms:false}}return{shipping:num(s?.totalShipping),includesCustoms:false}}
function supplierUnitShipping(s){if(!s)return 0;const q=supplierCalcQty(s),ship=supplierCalcShipping(s);return ship.shipping/q}
function supplierBaseOrderCost(s){if(!s)return 0;const q=supplierCalcQty(s),ship=supplierCalcShipping(s);if(s.priceType==='consumable')return num(s.purchasePrice)+ship.shipping;return (s.priceType==='set'?num(s.setPrice):supplierCalcUnitPrice(s)*q)+ship.shipping}
function supplierVatRate(s){return Math.max(0,num(s?.vatRate,0))/100}
function supplierVatIncluded(s){return !!s?.vatIncluded}
function supplierVatAddon(s,amount){return supplierVatIncluded(s)?0:Math.max(0,num(amount))*supplierVatRate(s)}
function supplierHasCustoms(s){return !!s&&!!s.customs}
function supplierCustomsCost(s){if(!supplierHasCustoms(s))return 0;const ship=supplierCalcShipping(s);if(ship.includesCustoms)return 0;return supplierBaseOrderCost(s)*0.12}
function supplierOrderCost(s){const subtotal=supplierBaseOrderCost(s)+supplierCustomsCost(s);return subtotal+supplierVatAddon(s,subtotal)}
function supplierLandedUnitCost(s){return s?supplierOrderCost(s)/supplierCalcQty(s):0}
function productInboundShipping(p){const s=(p.suppliers||[]).find(x=>x.preferred)||(p.suppliers||[])[0];if(!s)return 0;const ship=supplierUnitShipping(s),customs=supplierHasCustoms(s)?(num(p.basePrice)+ship)*0.12:0,subtotal=num(p.basePrice)+ship+customs,vat=supplierVatAddon(s,subtotal);return ship+customs+vat}
function productPurchaseCost(p){return num(p.basePrice)+productInboundShipping(p)+(p.costs||[]).reduce((a,c)=>a+num(c.amount),0)}
function costTotal(p){return productPurchaseCost(p)+num(p.shippingCost)}
function calcProduct(p,overridePrice=null){const price=overridePrice===null?num(p.salePrice):num(overridePrice),shippingCharged=num(p.shippingCharged),revenue=price+shippingCharged,rate=variableFeeRate(p),baseFee=fixedFees(p),rawPlatform=baseFee+revenue*rate,feeVat=rawPlatform*(state.settings.feeVatPct/100),fees=rawPlatform+feeVat,costs=costTotal(p),profit=revenue-costs-fees,margin=revenue>0?profit/revenue*100:0,target=num(p.targetMargin,30)/100,vatMult=1+state.settings.feeVatPct/100,eVar=rate*vatMult,eFixed=baseFee*vatMult,denom=1-target-eVar;let recommended=0;if(denom>0){const needed=(costs+eFixed)/denom;recommended=Math.max(0,needed-shippingCharged);recommended=Math.ceil((recommended-1e-9)*10)/10}return{price,revenue,fees,costs,profit,margin,recommended}}
function batchTargetProfitRecommendation(b,nonPlatformCosts,eVar,eFixed){
  const manual=Math.max(0,num(b.targetProfit,5));
  if(b.autoTargetProfit===false){
    const denom=1-eVar;
    const price=denom>0?(nonPlatformCosts+eFixed+manual)/denom:0;
    return {recommended:price,targetProfit:manual,targetMode:'manual'}
  }
  // Automatisches Gewinnziel: 25 % des empfohlenen VK, mindestens 2,50 €.
  // Zuerst prüfen, ob der Mindestgewinn zu einem VK bis 10 € führt.
  const minProfit=2.5,minDenom=1-eVar,
    minPrice=minDenom>0?(nonPlatformCosts+eFixed+minProfit)/minDenom:0;
  if(minPrice<=10+1e-9){
    return {recommended:minPrice,targetProfit:minProfit,targetMode:'auto',targetLabel:'25 % des VK · mindestens 2,50 €'}
  }
  const targetRate=.25,denom=1-eVar-targetRate,
    price=denom>0?(nonPlatformCosts+eFixed)/denom:0;
  return {recommended:price,targetProfit:price*targetRate,targetMode:'auto',targetLabel:'25 % des VK'}
}
function automaticTargetProfitForPrice(price){
  const vk=Math.max(0,num(price));
  return Math.max(2.5,vk*.25)
}
function batchCalc(b,overridePrice=null){
  let productCost=0,packagingCost=0;
  (b.items||[]).forEach(i=>{const x=state.products.find(z=>z.pid===i.pid);if(x)productCost+=productPurchaseCost(x)*Math.max(1,num(i.qty,1))});
  (b.packagingItems||[]).forEach(i=>{const v=state.packaging.find(x=>x.vid===i.vid),s=(v?.suppliers||[]).find(x=>x.preferred)||(v?.suppliers||[])[0];if(s)packagingCost+=supplierLandedUnitCost(s)*Math.max(s.priceType==='consumable'?0.001:1,num(i.qty,1))});
  const materialCost=productCost+packagingCost,
    price=overridePrice===null?num(b.salePrice):num(overridePrice),revenue=price,
    rate=variableFeeRate(b),baseFee=fixedFees(b),rawPlatform=baseFee+revenue*rate,
    feeVat=rawPlatform*(state.settings.feeVatPct/100),fees=rawPlatform+feeVat,
    laborCost=Math.max(0,num(b.laborMinutes))*Math.max(0,num(b.hourlyRate))/60,
    outboundShipping=Math.max(0,num(b.outboundShipping)),adCost=Math.max(0,num(b.adCost)),
    riskCost=materialCost*Math.max(0,num(b.riskPct))/100,
    returnsCost=revenue*Math.max(0,num(b.returnsPct))/100,discountCost=revenue*Math.max(0,num(b.discountPct))/100,
    postTripDistanceOneWay=5,postTripKmCost=.30,postTripShare=Math.max(0,num(b.postTripShare,1)),
    postTripCost=postTripDistanceOneWay*2*postTripKmCost*postTripShare,
    fixedAllocation=Math.max(0,num(b.fixedAllocation)),
    db1=revenue-materialCost-fees,db2=db1-laborCost-outboundShipping-adCost-riskCost-returnsCost-discountCost-postTripCost,
    profit=db2-fixedAllocation,margin=revenue>0?profit/revenue*100:0,
    vatMult=1+state.settings.feeVatPct/100,eVar=rate*vatMult,eFixed=baseFee*vatMult,
    nonPlatformCosts=materialCost+laborCost+outboundShipping+adCost+riskCost+returnsCost+discountCost+postTripCost+fixedAllocation,
    target=batchTargetProfitRecommendation(b,nonPlatformCosts,eVar,eFixed);
  let recommended=Math.ceil((Math.max(0,target.recommended)-1e-9)*10)/10;
  // Nach Rundung Zielgewinn auf Basis des endgültigen empfohlenen VK anzeigen.
  const targetProfit=target.targetMode==='auto'?Math.max(2.5,recommended*.25):target.targetProfit;
  return{productCost,packagingCost,extra:packagingCost,total:materialCost,costs:materialCost,
    price,revenue,fees,laborCost,outboundShipping,adCost,riskCost,returnsCost,discountCost,postTripDistanceOneWay,postTripKmCost,postTripShare,postTripCost,fixedAllocation,db1,db2,profit,margin,
    recommended,targetProfit,targetMode:target.targetMode,targetLabel:target.targetLabel||'eigener Zielgewinn'}
}
