function variableFeeRate(p){const s=state.settings;let r=(s.transactionPct+s.paymentPct)/100;if(p?.useOffsite)r+=s.offsitePct/100;if(p?.useCurrency)r+=s.currencyPct/100;return r}
function fixedFees(p){const s=state.settings;let f=s.listingFee+s.paymentFixed;if(p?.useSetup&&s.setupSales>0)f+=s.setupFee/s.setupSales;return f}
function supplierQtyBase(s){if(!s)return 1;if(s.priceType==='consumable')return Math.max(0.0001,Math.max(1,num(s.packageCount,1))*Math.max(0.0001,num(s.amountPerPackage,1)));return s.priceType==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))}
function supplierUnitPrice(s){if(!s)return 0;if(s.priceType==='consumable')return num(s.purchasePrice)/supplierQtyBase(s);if(s.priceType==='set')return num(s.setPrice)/Math.max(1,num(s.setQty,1));return num(s.price)}
function supplierTierUnitPrice(s,qty=supplierQtyBase(s)){const tiers=(s?.priceTiers||[]).slice().sort((a,b)=>num(a.minQty)-num(b.minQty));const q=Math.max(1,num(qty,1));const hit=tiers.find(x=>q>=Math.max(1,num(x.minQty,1))&&(!num(x.maxQty)||q<=num(x.maxQty)));return hit&&num(hit.unitPrice)>0?num(hit.unitPrice):supplierUnitPrice(s)}
function supplierShippingForQty(s,qty=supplierQtyBase(s)){const q=Math.max(1,num(qty,1)),points=s?.shippingPoints||[],hit=points.find(x=>Math.max(1,num(x.qty,1))===q);if(hit){const actual=num(hit.shippingWithCustoms);return actual>0?{shipping:actual,includesCustoms:true}: {shipping:num(hit.shipping),includesCustoms:false}}return{shipping:num(s?.totalShipping),includesCustoms:false}}
function supplierUnitShipping(s){if(!s)return 0;const q=supplierQtyBase(s),ship=supplierShippingForQty(s,q);return ship.shipping/q}
function supplierBaseOrderCost(s){if(!s)return 0;const q=supplierQtyBase(s),ship=supplierShippingForQty(s,q);if(s.priceType==='consumable')return num(s.purchasePrice)+ship.shipping;return (s.priceType==='set'?num(s.setPrice):supplierTierUnitPrice(s,q)*q)+ship.shipping}
function supplierHasCustoms(s){return !!s&&!!s.customs}
function supplierCustomsCost(s){if(!supplierHasCustoms(s))return 0;const q=supplierQtyBase(s),ship=supplierShippingForQty(s,q);if(ship.includesCustoms)return 0;return supplierBaseOrderCost(s)*0.12}
function supplierOrderCost(s){return supplierBaseOrderCost(s)+supplierCustomsCost(s)}
function supplierLandedUnitCost(s){return s?supplierOrderCost(s)/supplierQtyBase(s):0}
function productInboundShipping(p){const s=(p.suppliers||[]).find(x=>x.preferred)||(p.suppliers||[])[0];if(!s)return 0;const ship=supplierUnitShipping(s),customs=supplierHasCustoms(s)?(num(p.basePrice)+ship)*0.12:0;return ship+customs}
function productPurchaseCost(p){return num(p.basePrice)+productInboundShipping(p)+(p.costs||[]).reduce((a,c)=>a+num(c.amount),0)}
function costTotal(p){return productPurchaseCost(p)+num(p.shippingCost)}
function calcProduct(p,overridePrice=null){const price=overridePrice===null?num(p.salePrice):num(overridePrice),shippingCharged=num(p.shippingCharged),revenue=price+shippingCharged,rate=variableFeeRate(p),baseFee=fixedFees(p),rawPlatform=baseFee+revenue*rate,feeVat=rawPlatform*(state.settings.feeVatPct/100),fees=rawPlatform+feeVat,costs=costTotal(p),profit=revenue-costs-fees,margin=revenue>0?profit/revenue*100:0,target=num(p.targetMargin,30)/100,vatMult=1+state.settings.feeVatPct/100,eVar=rate*vatMult,eFixed=baseFee*vatMult,denom=1-target-eVar;let recommended=0;if(denom>0){const needed=(costs+eFixed)/denom;recommended=Math.max(0,needed-shippingCharged);recommended=Math.ceil((recommended-1e-9)*10)/10}return{price,revenue,fees,costs,profit,margin,recommended}}
function batchCalc(b,overridePrice=null){
  let productCost=0,packagingCost=0;
  (b.items||[]).forEach(i=>{const x=state.products.find(z=>z.pid===i.pid);if(x)productCost+=productPurchaseCost(x)*Math.max(1,num(i.qty,1))});
  (b.packagingItems||[]).forEach(i=>{const v=state.packaging.find(x=>x.vid===i.vid),s=(v?.suppliers||[]).find(x=>x.preferred)||(v?.suppliers||[])[0];if(s)packagingCost+=supplierLandedUnitCost(s)*Math.max(s.priceType==='consumable'?0.001:1,num(i.qty,1))});

  const materialCost=productCost+packagingCost,
    price=overridePrice===null?num(b.salePrice):num(overridePrice),
    revenue=price,
    rate=variableFeeRate(b),baseFee=fixedFees(b),
    rawPlatform=baseFee+revenue*rate,
    feeVat=rawPlatform*(state.settings.feeVatPct/100),
    fees=rawPlatform+feeVat,
    laborCost=Math.max(0,num(b.laborMinutes))*Math.max(0,num(b.hourlyRate))/60,
    outboundShipping=Math.max(0,num(b.outboundShipping)),
    adCost=Math.max(0,num(b.adCost)),
    riskCost=materialCost*Math.max(0,num(b.riskPct))/100,
    fixedAllocation=Math.max(0,num(b.fixedAllocation)),
    db1=revenue-materialCost-fees,
    db2=db1-laborCost-outboundShipping-adCost-riskCost,
    profit=db2-fixedAllocation,
    margin=revenue>0?profit/revenue*100:0,
    target=num(b.targetMargin,30)/100,
    vatMult=1+state.settings.feeVatPct/100,
    eVar=rate*vatMult,eFixed=baseFee*vatMult,
    nonPlatformCosts=materialCost+laborCost+outboundShipping+adCost+riskCost+fixedAllocation,
    denom=1-target-eVar;

  let recommended=0;
  if(denom>0){
    recommended=(nonPlatformCosts+eFixed)/denom;
    recommended=Math.ceil((recommended-1e-9)*10)/10
  }
  return{
    productCost,packagingCost,extra:packagingCost,total:materialCost,costs:materialCost,
    price,revenue,fees,laborCost,outboundShipping,adCost,riskCost,fixedAllocation,
    db1,db2,profit,margin,recommended
  }
}
