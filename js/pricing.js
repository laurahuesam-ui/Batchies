function variableFeeRate(p){const s=state.settings;let r=(s.transactionPct+s.paymentPct)/100;if(p?.useOffsite)r+=s.offsitePct/100;if(p?.useCurrency)r+=s.currencyPct/100;return r}
function fixedFees(p){const s=state.settings;let f=s.listingFee+s.paymentFixed;if(p?.useSetup&&s.setupSales>0)f+=s.setupFee/s.setupSales;return f}
function supplierQtyBase(s){if(!s)return 1;return s.priceType==='set'?Math.max(1,num(s.setQty,1)):Math.max(1,num(s.minOrderQty,1))}
function supplierUnitPrice(s){if(!s)return 0;if(s.priceType==='set')return num(s.setPrice)/Math.max(1,num(s.setQty,1));return num(s.price)}
function supplierUnitShipping(s){return s?num(s.totalShipping)/supplierQtyBase(s):0}
function supplierBaseOrderCost(s){if(!s)return 0;return s.priceType==='set'?num(s.setPrice)+num(s.totalShipping):supplierUnitPrice(s)*Math.max(1,num(s.minOrderQty,1))+num(s.totalShipping)}
function supplierHasCustoms(s){return !!s&&!!s.customs}
function supplierCustomsCost(s){return supplierHasCustoms(s)?supplierBaseOrderCost(s)*0.12:0}
function supplierOrderCost(s){return supplierBaseOrderCost(s)+supplierCustomsCost(s)}
function supplierLandedUnitCost(s){return s?supplierOrderCost(s)/supplierQtyBase(s):0}
function productInboundShipping(p){const s=(p.suppliers||[]).find(x=>x.preferred)||(p.suppliers||[])[0];if(!s)return 0;const ship=supplierUnitShipping(s),customs=supplierHasCustoms(s)?(num(p.basePrice)+ship)*0.12:0;return ship+customs}
function productPurchaseCost(p){return num(p.basePrice)+productInboundShipping(p)+(p.costs||[]).reduce((a,c)=>a+num(c.amount),0)}
function costTotal(p){return productPurchaseCost(p)+num(p.shippingCost)}
function calcProduct(p,overridePrice=null){const price=overridePrice===null?num(p.salePrice):num(overridePrice),shippingCharged=num(p.shippingCharged),revenue=price+shippingCharged,rate=variableFeeRate(p),baseFee=fixedFees(p),rawPlatform=baseFee+revenue*rate,feeVat=rawPlatform*(state.settings.feeVatPct/100),fees=rawPlatform+feeVat,costs=costTotal(p),profit=revenue-costs-fees,margin=revenue>0?profit/revenue*100:0,target=num(p.targetMargin,30)/100,vatMult=1+state.settings.feeVatPct/100,eVar=rate*vatMult,eFixed=baseFee*vatMult,denom=1-target-eVar;let recommended=0;if(denom>0){const needed=(costs+eFixed)/denom;recommended=Math.max(0,needed-shippingCharged);recommended=Math.ceil((recommended-1e-9)*10)/10}return{price,revenue,fees,costs,profit,margin,recommended}}
function batchCalc(b,overridePrice=null){
  let productCost=0;
  (b.items||[]).forEach(i=>{const p=state.products.find(x=>x.pid===i.pid);if(p)productCost+=productPurchaseCost(p)*Math.max(1,num(i.qty,1))});
  const extra=num(b.extraCost),costs=productCost+extra,price=overridePrice===null?num(b.salePrice):num(overridePrice),revenue=price;
  const rate=variableFeeRate(b),baseFee=fixedFees(b),rawPlatform=baseFee+revenue*rate,feeVat=rawPlatform*(state.settings.feeVatPct/100),fees=rawPlatform+feeVat;
  const profit=revenue-costs-fees,margin=revenue>0?profit/revenue*100:0,target=num(b.targetMargin,30)/100,vatMult=1+state.settings.feeVatPct/100,eVar=rate*vatMult,eFixed=baseFee*vatMult,denom=1-target-eVar;
  let recommended=0;if(denom>0){recommended=(costs+eFixed)/denom;recommended=Math.ceil((recommended-1e-9)*10)/10}
  return{productCost,extra,total:costs,costs,price,revenue,fees,profit,margin,recommended}
}
