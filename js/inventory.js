// Mainteno Next — Stock industriel V2, vendors and purchasing.

const STOCK_STATE = window.__maintenoStockV2 || (window.__maintenoStockV2={
  view:'stock',
  search:'',
  status:'all',
  critical:'all'
});

function stockV2Styles(){
  if(document.getElementById('stockV2Styles'))return;
  const s=document.createElement('style');
  s.id='stockV2Styles';
  s.textContent=`
    .stkTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
    .stkToolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .stkToolbar .btn.on{background:#111827;color:#fff}
    .stkKpis{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:14px 0}
    .stkKpi{background:#fff;border:1px solid var(--line);border-radius:13px;padding:12px}
    .stkKpi b{display:block;font-size:22px}.stkKpi span{font-size:9px;color:var(--mut);font-weight:850;text-transform:uppercase}
    .stkKpi.hot{border-color:#fecaca;background:#fff7f7}.stkKpi.hot b{color:#b91c1c}
    .stkKpi.warn{border-color:#fed7aa;background:#fffaf5}.stkKpi.warn b{color:#c2410c}
    .stkFilters{display:grid;grid-template-columns:minmax(220px,1fr) 180px 180px;gap:9px;margin:12px 0}
    .stkFilters input,.stkFilters select{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:10px;background:#fff}
    .stkGrid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}
    .stkTable{width:100%;border-collapse:collapse}.stkTable th,.stkTable td{padding:9px 7px;border-bottom:1px solid var(--line);font-size:11px;text-align:left;vertical-align:top}.stkTable th{font-size:9px;color:var(--mut);text-transform:uppercase}
    .stkRisk{font-weight:900;color:#b91c1c}.stkWarn{font-weight:850;color:#c2410c}.stkOk{font-weight:850;color:#047857}
    .stkLoc{font-size:10px;color:var(--mut);margin-top:3px}.stkRef{font-weight:900}.stkBadRow{background:#fffafa}.stkCriticalRow{box-shadow:inset 3px 0 0 #dc2626}
    .stkCoverage{display:flex;align-items:center;gap:6px}.stkCoverageBar{height:6px;min-width:70px;flex:1;background:#e5e7eb;border-radius:999px;overflow:hidden}.stkCoverageBar i{display:block;height:100%;background:#2563eb}.stkCoverageBar.hot i{background:#dc2626}.stkCoverageBar.warn i{background:#f59e0b}
    .stkSectionTitle{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.stkSectionTitle h3{margin:0}
    .stkMini{padding:9px 0;border-bottom:1px solid var(--line)}.stkMini:last-child{border-bottom:0}.stkMini small{display:block;color:var(--mut);margin-top:3px}
    .stkBadge{display:inline-block;border-radius:999px;background:#f3f4f6;padding:4px 7px;font-size:9px;font-weight:850;margin:2px}
    .stkActionCell .stack{justify-content:flex-start}
    @media(max-width:1000px){.stkKpis{grid-template-columns:repeat(3,1fr)}.stkGrid{grid-template-columns:1fr}}
    @media(max-width:700px){.stkFilters{grid-template-columns:1fr}.stkKpis{grid-template-columns:1fr 1fr}.stkTop{display:block}.stkToolbar{margin-top:10px}.stkTable th:nth-child(5),.stkTable td:nth-child(5){display:none}}
  `;
  document.head.appendChild(s);
}

function sNum(v){let n=Number(v||0);return Number.isFinite(n)?n:0}
function sWoDate(w){let v=w.completed_at||w.started_at||w.requested_at||w.created_at||w.updated_at,d=v?new Date(v):null;return d&&!Number.isNaN(d.getTime())?d:null}
function sLocation(p){let l=S.locations.find(x=>x.id===p.location_id);return l?.path||l?.name||'Non défini'}
function sVendor(p){return S.vendors.find(v=>v.id===p.vendor_id)}
function sOpenPoQty(partId){
  let activePo=new Set(S.pos.filter(po=>['approved','partially_fulfilled'].includes(po.status)).map(po=>po.id));
  return S.polines.filter(l=>l.part_id===partId&&activePo.has(l.purchase_order_id))
    .reduce((sum,l)=>sum+Math.max(0,sNum(l.quantity_ordered)-sNum(l.quantity_received)),0)
}
function sUsage(partId,days=90){
  let start=Date.now()-days*86400000,woMap=new Map(S.wo.map(w=>[w.id,w]));
  let rows=S.woParts.filter(x=>x.part_id===partId).filter(x=>{
    let w=woMap.get(x.work_order_id),d=w?sWoDate(w):null;
    return d&&d.getTime()>=start;
  });
  return {
    qty:rows.reduce((s,x)=>s+sNum(x.quantity),0),
    lines:rows.length,
    wo:new Set(rows.map(x=>x.work_order_id)).size
  }
}
function sPartMachines(partId){
  let usage=S.woParts.filter(x=>x.part_id===partId),woMap=new Map(S.wo.map(w=>[w.id,w])),m=new Map();
  usage.forEach(x=>{
    let w=woMap.get(x.work_order_id);if(!w?.asset_id)return;
    let a=S.assets.find(a=>a.id===w.asset_id);if(!a)return;
    let r=m.get(a.id)||{asset:a,qty:0,lines:0};
    r.qty+=sNum(x.quantity);r.lines++;m.set(a.id,r)
  });
  return [...m.values()].sort((a,b)=>b.qty-a.qty||b.lines-a.lines)
}
function sCoverageDays(p){
  let u=sUsage(p.id,90).qty;
  if(u<=0)return null;
  return sNum(p.quantity_on_hand)/(u/90)
}
function sReorderQty(p){
  let q=sNum(p.quantity_on_hand),min=sNum(p.minimum_stock),max=p.maximum_stock==null?null:sNum(p.maximum_stock),preset=sNum(p.reorder_quantity);
  if(q>min)return 0;
  let target=max!=null&&max>min?max:min+preset;
  let need=Math.max(0,target-q);
  return Math.max(need,preset||Math.max(0,min-q))
}
function sStatus(p){
  let q=sNum(p.quantity_on_hand),min=sNum(p.minimum_stock),incoming=sOpenPoQty(p.id),projected=q+incoming,cov=sCoverageDays(p);
  if(q<=0)return 'rupture';
  if(q<=min)return 'bas';
  if(cov!=null&&cov<30)return 'risque';
  if(projected<=min)return 'risque';
  return 'ok'
}
function sCoverageLabel(days){
  if(days==null)return 'Pas de conso 90 j';
  if(days<1)return '< 1 j';
  if(days<60)return days.toFixed(0)+' j';
  return (days/30).toFixed(1)+' mois'
}
function sCoveragePct(days){
  if(days==null)return 100;
  return Math.max(3,Math.min(100,days/90*100))
}
function sFilteredParts(){
  let q=(STOCK_STATE.search||'').trim().toLowerCase();
  return S.parts.filter(p=>p.active!==false).filter(p=>{
    if(STOCK_STATE.status!=='all'&&sStatus(p)!==STOCK_STATE.status)return false;
    if(STOCK_STATE.critical==='critical'&&!p.critical)return false;
    if(STOCK_STATE.critical==='normal'&&p.critical)return false;
    if(!q)return true;
    let v=sVendor(p);
    return [p.reference,p.name,p.category,p.barcode,p.bin_location,sLocation(p),v?.name].some(x=>String(x||'').toLowerCase().includes(q))
  })
}
function sTopConsumers(){
  let woMap=new Map(S.wo.map(w=>[w.id,w])),m=new Map();
  S.woParts.forEach(x=>{
    let w=woMap.get(x.work_order_id);if(!w?.asset_id)return;
    let a=S.assets.find(a=>a.id===w.asset_id);if(!a)return;
    let p=S.parts.find(p=>p.id===x.part_id),cost=sNum(x.quantity)*sNum(p?.unit_cost_mad);
    let r=m.get(a.id)||{asset:a,qty:0,cost:0,lines:0};
    r.qty+=sNum(x.quantity);r.cost+=cost;r.lines++;m.set(a.id,r)
  });
  return [...m.values()].sort((a,b)=>b.cost-a.cost||b.qty-a.qty).slice(0,8)
}
function sRiskParts(){
  return S.parts.filter(p=>p.active!==false).map(p=>({
    p,status:sStatus(p),incoming:sOpenPoQty(p.id),usage:sUsage(p.id,90),coverage:sCoverageDays(p),reorder:sReorderQty(p)
  })).filter(x=>x.status!=='ok'||x.p.critical&&x.coverage!=null&&x.coverage<90)
    .sort((a,b)=>{
      let rank={rupture:0,bas:1,risque:2,ok:3};
      return rank[a.status]-rank[b.status]||Number(b.p.critical)-Number(a.p.critical)||a.coverage-b.coverage
    })
}
function sStatusLabel(v){return({rupture:'Rupture',bas:'Stock bas',risque:'Risque',ok:'OK'})[v]||v}
function sStatusClass(v){return v==='rupture'?'stkRisk':v==='bas'||v==='risque'?'stkWarn':'stkOk'}

function inventory(){
  stockV2Styles();
  let parts=sFilteredParts(),all=S.parts.filter(p=>p.active!==false),low=all.filter(p=>sNum(p.quantity_on_hand)<=sNum(p.minimum_stock)),out=all.filter(p=>sNum(p.quantity_on_hand)<=0),critical=all.filter(p=>p.critical),risk=sRiskParts(),value=all.reduce((s,p)=>s+sNum(p.quantity_on_hand)*sNum(p.unit_cost_mad),0),incoming=all.reduce((s,p)=>s+sOpenPoQty(p.id)*sNum(p.unit_cost_mad),0);
  let top=sTopConsumers();
  let tableRows=parts.map(p=>{
    let st=sStatus(p),u=sUsage(p.id,90),cov=sCoverageDays(p),inc=sOpenPoQty(p.id),vendor=sVendor(p),machines=sPartMachines(p.id).slice(0,2);
    return `<tr class="${st==='rupture'||st==='bas'?'stkBadRow':''} ${p.critical?'stkCriticalRow':''}">
      <td><div class="stkRef">${e(p.reference||'—')}</div>${p.critical?'<span class="stkBadge">CRITIQUE</span>':''}</td>
      <td><b>${e(p.name)}</b><div class="stkLoc">${e(p.category||'Sans catégorie')} · ${e(sLocation(p))}${p.bin_location?' · '+e(p.bin_location):''}</div>${machines.length?`<div class="stkLoc">Machines: ${machines.map(x=>e(x.asset.code||x.asset.name)).join(', ')}</div>`:''}</td>
      <td><b>${e(p.quantity_on_hand)}</b><div class="stkLoc">Mini ${e(p.minimum_stock)}${p.maximum_stock!=null?' · Maxi '+e(p.maximum_stock):''}</div>${inc>0?`<div class="stkOk">+${inc} en commande</div>`:''}</td>
      <td><div class="${sStatusClass(st)}">${sStatusLabel(st)}</div><div class="stkCoverage"><div class="stkCoverageBar ${cov!=null&&cov<30?'hot':cov!=null&&cov<60?'warn':''}"><i style="width:${sCoveragePct(cov)}%"></i></div><span>${e(sCoverageLabel(cov))}</span></div></td>
      <td><b>${u.qty.toFixed(2)}</b><div class="stkLoc">${u.wo} OT · 90 j</div></td>
      ${isMgr()?`<td>${sNum(p.unit_cost_mad).toFixed(2)} MAD<div class="stkLoc">${(sNum(p.quantity_on_hand)*sNum(p.unit_cost_mad)).toFixed(2)} MAD stock</div></td>`:''}
      <td><div>${e(vendor?.name||'—')}</div><div class="stkLoc">${e(vendor?.phone||vendor?.email||'')}</div></td>
      ${isMgr()?`<td class="stkActionCell"><div class="stack"><button class="btn" data-editpart="${p.id}">Modifier</button><button class="btn" data-adjustpart="${p.id}">Ajuster</button></div></td>`:''}
    </tr>`
  }).join('');

  let stockView=`<div class="card"><div style="overflow:auto"><table class="stkTable"><thead><tr><th>Réf.</th><th>Pièce / emplacement</th><th>Stock</th><th>Couverture</th><th>Conso 90 j</th>${isMgr()?'<th>Valeur</th>':''}<th>Fournisseur</th>${isMgr()?'<th>Actions</th>':''}</tr></thead><tbody>${tableRows||`<tr><td colspan="${isMgr()?8:6}" class="mut">Aucune pièce pour ces filtres.</td></tr>`}</tbody></table></div></div>`;

  let replenishment=`<div class="stkGrid"><div class="card"><div class="stkSectionTitle"><h3>Réapprovisionnement recommandé</h3><span class="pill red">${risk.length}</span></div>${risk.map(x=>`<div class="stkMini"><div class="row mobileStack"><div><b>${e(x.p.reference||'')} · ${e(x.p.name)}</b><small>${e(sLocation(x.p))}${x.p.bin_location?' · '+e(x.p.bin_location):''} · ${e(sStatusLabel(x.status))}${x.p.critical?' · CRITIQUE':''}</small></div><div style="text-align:right"><b>${x.reorder>0?x.reorder.toFixed(2):'—'}</b><small>qté suggérée</small></div></div><div class="stkLoc">Stock ${e(x.p.quantity_on_hand)} · mini ${e(x.p.minimum_stock)} · entrant ${x.incoming} · conso 90 j ${x.usage.qty.toFixed(2)} · couverture ${e(sCoverageLabel(x.coverage))}</div></div>`).join('')||'<div class="mut">Aucun besoin détecté.</div>'}</div><div class="card"><h3>Règles de calcul</h3><div class="notice">La suggestion utilise le stock mini/maxi, la quantité de réapprovisionnement, les réceptions encore attendues et la consommation des 90 derniers jours.</div><div class="mut" style="margin-top:10px">Les lignes déjà ajoutées à un OT sont traitées comme des consommations/sorties, pas comme des réservations. La réservation persistante sera ajoutée séparément au backend.</div>${isMgr()?'<button class="btn primary" data-p="purchase" style="margin-top:12px">Ouvrir les achats</button>':''}</div></div>`;

  let consumption=`<div class="stkGrid"><div class="card"><h3>Machines les plus consommatrices</h3>${top.map(x=>`<div class="stkMini" data-asset="${x.asset.id}"><b>${e(x.asset.code||'')} · ${e(x.asset.name)}</b><small>${x.lines} mouvement(s) pièce · ${x.qty.toFixed(2)} unités${isMgr()?' · '+x.cost.toFixed(2)+' MAD estimés':''}</small></div>`).join('')||'<div class="mut">Aucune consommation enregistrée.</div>'}</div><div class="card"><h3>Pièces les plus consommées — 90 j</h3>${all.map(p=>({p,u:sUsage(p.id,90)})).filter(x=>x.u.qty>0).sort((a,b)=>b.u.qty-a.u.qty).slice(0,10).map(x=>`<div class="stkMini"><b>${e(x.p.reference||'')} · ${e(x.p.name)}</b><small>${x.u.qty.toFixed(2)} unité(s) · ${x.u.wo} OT · couverture ${e(sCoverageLabel(sCoverageDays(x.p)))}</small></div>`).join('')||'<div class="mut">Aucune consommation sur 90 jours.</div>'}</div></div>`;

  shell(`<div class="stkTop"><div><h1 class="title">Stock industriel</h1><p class="sub">Couverture, criticité, consommation, réapprovisionnement et traçabilité.</p></div>${isMgr()?'<div class="stkToolbar"><button class="btn primary" data-a="newpart">+ Ajouter pièce</button><button class="btn" data-a="vendors">Fournisseurs</button><button class="btn" data-p="purchase">Achats</button><button class="btn" data-a="exportstock">Excel</button><button class="btn" data-a="printstock">PDF</button></div>':''}</div>
  <div class="stkKpis"><div class="stkKpi"><b>${all.length}</b><span>Références actives</span></div><div class="stkKpi ${out.length?'hot':''}"><b>${out.length}</b><span>Ruptures</span></div><div class="stkKpi ${low.length?'warn':''}"><b>${low.length}</b><span>Stock bas</span></div><div class="stkKpi"><b>${critical.length}</b><span>Pièces critiques</span></div>${isMgr()?`<div class="stkKpi"><b>${value.toFixed(0)} MAD</b><span>Valeur stock · +${incoming.toFixed(0)} MAD entrant</span></div>`:`<div class="stkKpi"><b>${risk.length}</b><span>Références à surveiller</span></div>`}</div>
  <div class="stkToolbar"><button class="btn ${STOCK_STATE.view==='stock'?'on':''}" data-stock-view="stock">Stock</button><button class="btn ${STOCK_STATE.view==='replenishment'?'on':''}" data-stock-view="replenishment">Réapprovisionnement</button><button class="btn ${STOCK_STATE.view==='consumption'?'on':''}" data-stock-view="consumption">Consommation</button></div>
  ${STOCK_STATE.view==='stock'?`<div class="stkFilters"><input id="stockSearch" placeholder="Rechercher pièce, réf., emplacement, fournisseur…" value="${e(STOCK_STATE.search)}"><select id="stockStatus"><option value="all">Tous les états</option>${[['rupture','Rupture'],['bas','Stock bas'],['risque','Risque'],['ok','OK']].map(x=>`<option value="${x[0]}" ${STOCK_STATE.status===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select id="stockCritical"><option value="all">Toutes les pièces</option><option value="critical" ${STOCK_STATE.critical==='critical'?'selected':''}>Critiques uniquement</option><option value="normal" ${STOCK_STATE.critical==='normal'?'selected':''}>Non critiques</option></select></div>${stockView}`:STOCK_STATE.view==='replenishment'?replenishment:consumption}`);
}

if(!window.__maintenoStockV2Events){
  window.__maintenoStockV2Events=true;
  let st=null;
  document.addEventListener('click',ev=>{
    let b=ev.target.closest('[data-stock-view]');
    if(!b)return;
    STOCK_STATE.view=b.dataset.stockView;inventory()
  });
  document.addEventListener('input',ev=>{
    if(ev.target.id!=='stockSearch')return;
    clearTimeout(st);st=setTimeout(()=>{STOCK_STATE.search=ev.target.value;inventory()},220)
  });
  document.addEventListener('change',ev=>{
    if(ev.target.id==='stockStatus'){STOCK_STATE.status=ev.target.value;inventory()}
    if(ev.target.id==='stockCritical'){STOCK_STATE.critical=ev.target.value;inventory()}
  })
}

function partForm(){if(!isMgr()){S.page='inventory';return render()}let p=S.selected?S.parts.find(x=>x.id===S.selected):null,edit=!!p;shell(`<button class="btn" data-p="inventory">← Stock</button><h1 class="title">${edit?'Modifier la pièce':'Ajouter une pièce'}</h1><form id="partCRUD"><input type="hidden" name="part_id" value="${p?.id||''}"><div class="card"><div class="grid2"><div class="field"><label>Nom *</label><input name="name" required value="${e(p?.name||'')}"></div><div class="field"><label>Référence</label><input name="reference" value="${e(p?.reference||'')}"></div></div><div class="field"><label>Description</label><textarea name="description">${e(p?.description||'')}</textarea></div><div class="grid2"><div class="field"><label>Catégorie</label><input name="category" value="${e(p?.category||'')}"></div><div class="field"><label>Fournisseur</label><select name="vendor_id"><option value="">—</option>${S.vendors.map(v=>`<option value="${v.id}" ${p?.vendor_id===v.id?'selected':''}>${e(v.name)}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>Emplacement stock</label><select name="location_id"><option value="">—</option>${activeLocations().map(l=>`<option value="${l.id}" ${p?.location_id===l.id?'selected':''}>${e(l.path||l.name)}</option>`).join('')}</select></div><div class="field"><label>Casier / bin</label><input name="bin_location" value="${e(p?.bin_location||'')}"></div></div>${!edit?'<div class="field"><label>Stock initial</label><input type="number" step="any" min="0" name="quantity_on_hand" value="0"></div>':''}<div class="grid3"><div class="field"><label>Stock minimum</label><input type="number" step="any" min="0" name="minimum_stock" value="${p?.minimum_stock??0}"></div><div class="field"><label>Stock maximum</label><input type="number" step="any" min="0" name="maximum_stock" value="${p?.maximum_stock??''}"></div><div class="field"><label>Qté réappro.</label><input type="number" step="any" min="0" name="reorder_quantity" value="${p?.reorder_quantity??0}"></div></div><div class="grid2"><div class="field"><label>Coût unitaire MAD</label><input type="number" step="0.01" min="0" name="unit_cost_mad" value="${p?.unit_cost_mad??0}"></div><div class="field"><label>Code-barres</label><input name="barcode" value="${e(p?.barcode||'')}"></div></div><label><input type="checkbox" name="critical" ${p?.critical?'checked':''}> Pièce critique</label>${edit?`<label><input type="checkbox" name="active" ${p.active!==false?'checked':''}> Active</label>`:''}</div><button class="btn primary">${edit?'Enregistrer':'Ajouter la pièce'}</button></form>`)}

function vendors(){if(!isMgr()){S.page='inventory';return render()}let v=S.editVendorId?S.vendors.find(x=>x.id===S.editVendorId):null;shell(`<button class="btn" data-p="inventory">← Stock</button><h1 class="title">Fournisseurs</h1><div class="grid2"><form id="vendorCRUD" class="card"><input type="hidden" name="vendor_id" value="${v?.id||''}"><h3>${v?'Modifier fournisseur':'Nouveau fournisseur'}</h3><div class="field"><label>Nom *</label><input name="name" required value="${e(v?.name||'')}"></div><div class="grid2"><div class="field"><label>Contact</label><input name="contact_name" value="${e(v?.contact_name||'')}"></div><div class="field"><label>Type</label><input name="vendor_type" value="${e(v?.vendor_type||'supplier')}"></div></div><div class="field"><label>Email</label><input type="email" name="email" value="${e(v?.email||'')}"></div><div class="field"><label>Téléphone</label><input name="phone" value="${e(v?.phone||'')}"></div><div class="field"><label>Adresse</label><textarea name="address">${e(v?.address||'')}</textarea></div><div class="field"><label>ICE / ID fiscal</label><input name="tax_id" value="${e(v?.tax_id||'')}"></div><div class="field"><label>Notes</label><textarea name="notes">${e(v?.notes||'')}</textarea></div>${v?`<label><input type="checkbox" name="active" ${v.active!==false?'checked':''}> Actif</label>`:''}<div class="stack"><button class="btn primary">${v?'Enregistrer':'Ajouter'}</button>${v?'<button type="button" class="btn" data-a="cancelvendoredit">Annuler édition</button>':''}</div></form><div class="card"><h3>Liste</h3>${S.vendors.map(x=>`<div class="listitem"><div class="row mobileStack"><div><b>${e(x.name)}</b><div class="mut">${e(x.contact_name||'')} ${e(x.phone||'')} ${e(x.email||'')}</div></div><button class="btn" data-editvendor="${x.id}">Modifier</button></div></div>`).join('')||'<div class="mut">Aucun fournisseur.</div>'}</div></div>`)}

function purchase(){shell(`<div class="row mobileStack"><div><h1 class="title">Achats</h1><p class="sub">Demandes, approbations et réceptions</p></div><div class="stack"><button class="btn primary" data-a="newpoform">+ Nouveau PO</button><button class="btn" data-a="vendors">Fournisseurs</button></div></div><div class="card">${S.pos.map(po=>{let v=S.vendors.find(x=>x.id===po.vendor_id);return `<div class="listitem" data-po="${po.id}"><div class="row"><div><b>PO #${po.po_number} · ${e(v?.name||'Sans fournisseur')}</b><div class="mut">${Number(po.total_mad||0).toFixed(2)} MAD · ${new Date(po.created_at).toLocaleDateString('fr-FR')}</div></div>${pill(po.status)}</div></div>`}).join('')||'<div class="mut">Aucun bon de commande. Crée un fournisseur puis un PO.</div>'}</div>`)}

function poForm(){if(!isMgr()){S.page='purchase';return render()}shell(`<button class="btn" data-p="purchase">← Achats</button><h1 class="title">Nouveau bon de commande</h1><form id="newPOForm" class="card"><div class="field"><label>Fournisseur *</label><select name="vendor_id" required><option value="">Choisir…</option>${S.vendors.map(v=>`<option value="${v.id}">${e(v.name)}</option>`).join('')}</select>${!S.vendors.length?'<div class="notice">Aucun fournisseur. Va dans Fournisseurs pour en créer un.</div>':''}</div><div class="field"><label>Note</label><textarea name="notes" placeholder="Objet de la commande, délai, référence devis…"></textarea></div><button class="btn primary" ${!S.vendors.length?'disabled':''}>Créer le PO</button></form>`)}

function purchaseDetail(){let po=S.pos.find(x=>x.id===S.selected);if(!po){S.page='purchase';return render()}let v=S.vendors.find(x=>x.id===po.vendor_id),lines=S.polines.filter(x=>x.purchase_order_id===po.id);shell(`<button class="btn" data-p="purchase">← Achats</button><div class="card"><div class="row mobileStack"><div><div class="mut">Bon de commande</div><h1 class="title">PO #${po.po_number}</h1><p class="sub">${e(v?.name||'Sans fournisseur')} · ${Number(po.total_mad||0).toFixed(2)} MAD</p></div><div class="stack">${pill(po.status)}${po.status==='requested'?'<button class="btn success" data-a="approvepo">Approuver</button>':''}</div></div>${po.notes?`<div class="notice">${e(po.notes)}</div>`:''}</div>${po.status==='requested'?`<form id="addPOLine" class="card"><h3>Ajouter une ligne</h3><div class="grid3"><div class="field"><label>Pièce *</label><select name="part_id" required><option value="">Choisir…</option>${S.parts.filter(p=>p.active!==false).map(p=>`<option value="${p.id}">${e(p.reference||'')} · ${e(p.name)}</option>`).join('')}</select></div><div class="field"><label>Quantité *</label><input name="quantity" type="number" step="any" min="0.01" value="1" required></div><div class="field"><label>Coût unitaire MAD *</label><input name="unit_cost_mad" type="number" step="0.01" min="0" value="0" required></div></div>${!S.parts.length?'<div class="notice">Aucune pièce disponible. Crée d’abord la pièce dans Stock.</div>':''}<button class="btn primary" ${!S.parts.length?'disabled':''}>Ajouter la ligne</button></form>`:''}<div class="card"><h3>Lignes</h3>${lines.map(l=>{let p=S.parts.find(x=>x.id===l.part_id),rest=Number(l.quantity_ordered)-Number(l.quantity_received);return `<div class="listitem"><div class="row mobileStack"><div><b>${e(p?.reference||'')} · ${e(l.description)}</b><div class="mut">Commandé ${l.quantity_ordered} · Reçu ${l.quantity_received} · ${Number(l.unit_cost_mad).toFixed(2)} MAD/u</div></div>${['approved','partially_fulfilled'].includes(po.status)&&rest>0?`<div class="stack"><input id="receive_${l.id}" type="number" min="0.01" max="${rest}" step="any" value="${rest}" style="width:100px"><button class="btn success" data-receiveline="${l.id}" data-rest="${rest}">Réceptionner</button></div>`:''}</div></div>`}).join('')||'<div class="mut">Aucune ligne.</div>'}</div>`)}
