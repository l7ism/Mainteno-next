// Mainteno Next — real spare-part reservations for work orders + reservation-aware stock UI.
(function(){
  if(window.__maintenoReservationsLoaded)return;
  window.__maintenoReservationsLoaded=true;

  if(!Array.isArray(S.reservations))S.reservations=[];
  if(!Array.isArray(S.partAvailability))S.partAvailability=[];

  function rsvNum(v){let n=Number(v||0);return Number.isFinite(n)?n:0}
  function rsvSnapshot(){try{localStorage.setItem('mainteno_reservations_snapshot',JSON.stringify({reservations:S.reservations,availability:S.partAvailability,ts:Date.now()}))}catch{}}
  function rsvRestore(){try{let x=JSON.parse(localStorage.getItem('mainteno_reservations_snapshot')||'null');if(x){S.reservations=Array.isArray(x.reservations)?x.reservations:[];S.partAvailability=Array.isArray(x.availability)?x.availability:[]}}catch{}}
  rsvRestore();

  async function loadReservationData(){
    if(!S.u)return;
    if(!navigator.onLine){rsvRestore();return}
    let [reservations,availability]=await Promise.all([
      sel('nx_part_reservations','select=*&status=eq.active&quantity=gt.0&order=reserved_at.desc'),
      rpc('nx_part_availability',{})
    ]);
    S.reservations=Array.isArray(reservations)?reservations:[];
    S.partAvailability=Array.isArray(availability)?availability:[];
    rsvSnapshot();
  }
  window.loadReservationData=loadReservationData;

  const baseLoadAll=loadAll;
  loadAll=async function(){
    await baseLoadAll();
    try{await loadReservationData()}catch(err){console.warn('Reservation refresh failed',err);rsvRestore()}
  };

  function rsvAvail(partId){
    let p=S.parts.find(x=>x.id===partId),a=S.partAvailability.find(x=>x.part_id===partId);
    if(a)return {physical:rsvNum(a.quantity_on_hand),reserved:rsvNum(a.quantity_reserved),available:rsvNum(a.quantity_available)};
    let physical=rsvNum(p?.quantity_on_hand),reserved=S.reservations.filter(r=>r.part_id===partId&&r.status==='active'&&rsvNum(r.quantity)>0).reduce((s,r)=>s+rsvNum(r.quantity),0);
    return {physical,reserved,available:Math.max(0,physical-reserved)};
  }
  function rsvOwn(workOrderId,partId){return S.reservations.filter(r=>r.work_order_id===workOrderId&&r.part_id===partId&&r.status==='active').reduce((s,r)=>s+rsvNum(r.quantity),0)}
  function rsvUsable(workOrderId,partId){let a=rsvAvail(partId),own=rsvOwn(workOrderId,partId);return Math.max(0,a.physical-Math.max(0,a.reserved-own))}
  function rsvRowsForWo(workOrderId){return S.reservations.filter(r=>r.work_order_id===workOrderId&&r.status==='active'&&rsvNum(r.quantity)>0)}
  function rsvPartName(id){let p=S.parts.find(x=>x.id===id);return `${p?.reference||''}${p?.reference?' · ':''}${p?.name||'Pièce'}`}

  // Override the existing WO parts card with reservation-aware actions.
  partsSection=function(w,lines){
    let reservations=rsvRowsForWo(w.id),opts=S.parts.filter(p=>p.active!==false&&rsvUsable(w.id,p.id)>0).map(p=>{let a=rsvAvail(p.id),own=rsvOwn(w.id,p.id),usable=rsvUsable(w.id,p.id);return `<option value="${p.id}">${e(p.reference||'')} · ${e(p.name)} — dispo ${usable}${own?` · réservé OT ${own}`:''}</option>`}).join('');
    return `<div class="card"><div class="row mobileStack"><div><h3 style="margin:0">Pièces & réservations</h3><div class="mut">Le stock physique baisse seulement quand la pièce est réellement utilisée.</div></div>${reservations.length?`<span class="pill orange">${reservations.length} réservation(s)</span>`:''}</div>
      <h4>Réservé pour cet OT</h4>${reservations.map(r=>{let p=S.parts.find(x=>x.id===r.part_id),a=rsvAvail(r.part_id);return `<div class="listitem"><div class="row mobileStack"><div><b>${e(rsvPartName(r.part_id))}</b><div class="mut">Réservé ${rsvNum(r.quantity)} · physique ${a.physical} · disponible général ${a.available}</div></div>${navigator.onLine?`<button class="btn danger" data-releasereservation="${r.id}">Libérer</button>`:'<span class="pill">Hors ligne</span>'}</div></div>`}).join('')||'<div class="mut">Aucune réservation active.</div>'}
      <h4>Pièces utilisées</h4>${lines.map(l=>{let p=S.parts.find(x=>x.id===l.part_id);return `<div class="listitem"><div class="row"><div><b>${e(p?.reference||'')} · ${e(p?.name||'Pièce')}</b><div class="mut">Qté ${l.quantity}</div></div>${navigator.onLine?`<button class="btn danger" data-removepart="${l.id}">Retirer / retourner</button>`:''}</div></div>`}).join('')||'<div class="mut">Aucune pièce consommée.</div>'}
      <div class="grid2" style="margin-top:12px"><select id="partSelect"><option value="">Choisir une pièce</option>${opts}</select><input id="partQty" type="number" min="0.01" step="0.01" value="1"></div>
      <div class="stack" style="margin-top:10px"><button class="btn" data-reservepart ${navigator.onLine?'':'disabled'}>🔒 Réserver</button><button class="btn primary" data-a="addpart">✓ Utiliser maintenant</button><label><input id="noParts" type="checkbox" ${w.no_parts_used?'checked':''}> Aucune pièce utilisée</label></div>
      ${navigator.onLine?'':'<div class="notice" style="margin-top:10px">Les nouvelles réservations nécessitent une connexion. Une consommation hors ligne peut être synchronisée plus tard et sera revalidée contre le stock disponible.</div>'}
    </div>`
  };

  // Reservation actions are online-only to guarantee concurrency safety.
  document.addEventListener('click',async ev=>{
    let reserve=ev.target.closest('[data-reservepart]'),release=ev.target.closest('[data-releasereservation]');
    if(!reserve&&!release)return;
    try{
      if(!navigator.onLine)throw Error('Connexion requise pour gérer les réservations');
      if(reserve){
        let pid=document.getElementById('partSelect')?.value,q=Number(document.getElementById('partQty')?.value);
        if(!pid||!Number.isFinite(q)||q<=0)throw Error('Choisis une pièce et une quantité valide');
        await rpc('nx_reserve_work_order_part',{p_work_order_id:S.selected,p_part_id:pid,p_quantity:q});
        await loadAll();render();toast('Pièce réservée pour cet OT');return;
      }
      if(release){
        await rpc('nx_release_work_order_part_reservation',{p_reservation_id:release.dataset.releasereservation,p_quantity:null,p_reason:'Libération manuelle depuis Mainteno'});
        await loadAll();render();toast('Réservation libérée');
      }
    }catch(err){toast(err.message||'Erreur réservation',1)}
  });

  function rsvCoverageDays(p){let u=typeof sUsage==='function'?sUsage(p.id,90).qty:0,a=rsvAvail(p.id);if(u<=0)return null;return a.available/(u/90)}
  function rsvStatus(p){let a=rsvAvail(p.id),min=rsvNum(p.minimum_stock),incoming=typeof sOpenPoQty==='function'?sOpenPoQty(p.id):0,cov=rsvCoverageDays(p);if(a.available<=0)return'rupture';if(a.available<=min)return'bas';if(cov!=null&&cov<30)return'risque';if(a.available+incoming<=min)return'risque';return'ok'}
  function rsvReorderQty(p){let a=rsvAvail(p.id),incoming=typeof sOpenPoQty==='function'?sOpenPoQty(p.id):0,projected=a.available+incoming,min=rsvNum(p.minimum_stock),max=p.maximum_stock==null?null:rsvNum(p.maximum_stock),preset=rsvNum(p.reorder_quantity);if(projected>min)return 0;let target=max!=null&&max>min?max:min+preset;return Math.max(0,target-projected,preset||Math.max(0,min-projected))}
  function rsvStatusLabel(v){return({rupture:'Rupture',bas:'Stock bas',risque:'Risque',ok:'OK'})[v]||v}
  function rsvStatusClass(v){return v==='rupture'?'stkRisk':v==='bas'||v==='risque'?'stkWarn':'stkOk'}
  function rsvCoverageLabel(days){if(days==null)return'Pas de conso 90 j';if(days<1)return'< 1 j';if(days<60)return days.toFixed(0)+' j';return(days/30).toFixed(1)+' mois'}
  function rsvCoveragePct(days){if(days==null)return 100;return Math.max(3,Math.min(100,days/90*100))}
  function rsvFilteredParts(){let q=(STOCK_STATE.search||'').trim().toLowerCase();return S.parts.filter(p=>p.active!==false).filter(p=>{let st=rsvStatus(p);if(STOCK_STATE.status!=='all'&&st!==STOCK_STATE.status)return false;if(STOCK_STATE.critical==='critical'&&!p.critical)return false;if(STOCK_STATE.critical==='normal'&&p.critical)return false;if(!q)return true;let v=typeof sVendor==='function'?sVendor(p):null,loc=typeof sLocation==='function'?sLocation(p):'';return[p.reference,p.name,p.category,p.barcode,p.bin_location,loc,v?.name].some(x=>String(x||'').toLowerCase().includes(q))})}
  function rsvRiskParts(){return S.parts.filter(p=>p.active!==false).map(p=>({p,status:rsvStatus(p),a:rsvAvail(p.id),incoming:typeof sOpenPoQty==='function'?sOpenPoQty(p.id):0,usage:typeof sUsage==='function'?sUsage(p.id,90):{qty:0,wo:0},coverage:rsvCoverageDays(p),reorder:rsvReorderQty(p)})).filter(x=>x.status!=='ok'||(x.p.critical&&x.coverage!=null&&x.coverage<90)).sort((a,b)=>{let rank={rupture:0,bas:1,risque:2,ok:3};return rank[a.status]-rank[b.status]||Number(b.p.critical)-Number(a.p.critical)||(a.coverage??999999)-(b.coverage??999999)})}

  // Replace Stock V2 renderer with reservation-aware Stock V3 while preserving forms/purchasing below it.
  inventory=function(){
    if(typeof stockV2Styles==='function')stockV2Styles();
    let parts=rsvFilteredParts(),all=S.parts.filter(p=>p.active!==false),risk=rsvRiskParts(),out=all.filter(p=>rsvAvail(p.id).available<=0),low=all.filter(p=>rsvAvail(p.id).available<=rsvNum(p.minimum_stock)),critical=all.filter(p=>p.critical),reservedRefs=all.filter(p=>rsvAvail(p.id).reserved>0),value=all.reduce((s,p)=>s+rsvAvail(p.id).physical*rsvNum(p.unit_cost_mad),0),reservedValue=all.reduce((s,p)=>s+rsvAvail(p.id).reserved*rsvNum(p.unit_cost_mad),0),top=typeof sTopConsumers==='function'?sTopConsumers():[];
    let tableRows=parts.map(p=>{let st=rsvStatus(p),u=typeof sUsage==='function'?sUsage(p.id,90):{qty:0,wo:0},cov=rsvCoverageDays(p),a=rsvAvail(p.id),inc=typeof sOpenPoQty==='function'?sOpenPoQty(p.id):0,v=typeof sVendor==='function'?sVendor(p):null,machines=typeof sPartMachines==='function'?sPartMachines(p.id).slice(0,2):[],loc=typeof sLocation==='function'?sLocation(p):'Non défini';return `<tr class="${st==='rupture'||st==='bas'?'stkBadRow':''} ${p.critical?'stkCriticalRow':''}"><td><div class="stkRef">${e(p.reference||'—')}</div>${p.critical?'<span class="stkBadge">CRITIQUE</span>':''}</td><td><b>${e(p.name)}</b><div class="stkLoc">${e(p.category||'Sans catégorie')} · ${e(loc)}${p.bin_location?' · '+e(p.bin_location):''}</div>${machines.length?`<div class="stkLoc">Machines: ${machines.map(x=>e(x.asset.code||x.asset.name)).join(', ')}</div>`:''}</td><td><b>${a.physical}</b>${inc>0?`<div class="stkOk">+${inc} en commande</div>`:''}</td><td><b>${a.reserved}</b></td><td><b>${a.available}</b><div class="stkLoc">Mini ${e(p.minimum_stock)}</div></td><td><div class="${rsvStatusClass(st)}">${rsvStatusLabel(st)}</div><div class="stkCoverage"><div class="stkCoverageBar ${cov!=null&&cov<30?'hot':cov!=null&&cov<60?'warn':''}"><i style="width:${rsvCoveragePct(cov)}%"></i></div><span>${e(rsvCoverageLabel(cov))}</span></div></td><td><b>${u.qty.toFixed(2)}</b><div class="stkLoc">${u.wo} OT · 90 j</div></td>${isMgr()?`<td>${rsvNum(p.unit_cost_mad).toFixed(2)} MAD<div class="stkLoc">${(a.physical*rsvNum(p.unit_cost_mad)).toFixed(2)} MAD physique</div></td>`:''}<td><div>${e(v?.name||'—')}</div><div class="stkLoc">${e(v?.phone||v?.email||'')}</div></td>${isMgr()?`<td class="stkActionCell"><div class="stack"><button class="btn" data-editpart="${p.id}">Modifier</button><button class="btn" data-adjustpart="${p.id}">Ajuster</button></div></td>`:''}</tr>`}).join('');
    let stockView=`<div class="card"><div class="notice" style="margin-bottom:10px"><b>Physique</b> = quantité réellement en magasin · <b>Réservé</b> = bloqué pour des OT · <b>Disponible</b> = physique − réservé.</div><div style="overflow:auto"><table class="stkTable"><thead><tr><th>Réf.</th><th>Pièce / emplacement</th><th>Physique</th><th>Réservé</th><th>Disponible</th><th>Couverture</th><th>Conso 90 j</th>${isMgr()?'<th>Valeur</th>':''}<th>Fournisseur</th>${isMgr()?'<th>Actions</th>':''}</tr></thead><tbody>${tableRows||`<tr><td colspan="${isMgr()?10:8}" class="mut">Aucune pièce pour ces filtres.</td></tr>`}</tbody></table></div></div>`;
    let reservationView=`<div class="card"><div class="row mobileStack"><div><h3 style="margin:0">Réservations actives</h3><div class="mut">Quantités bloquées pour des interventions en cours.</div></div><span class="pill orange">${S.reservations.length}</span></div>${S.reservations.map(r=>{let w=S.wo.find(x=>x.id===r.work_order_id),p=S.parts.find(x=>x.id===r.part_id),a=w?S.assets.find(x=>x.id===w.asset_id):null,u=S.profiles.find(x=>x.id===r.reserved_by);return `<div class="stkMini" data-wo="${r.work_order_id}"><div class="row mobileStack"><div><b>OT #${e(w?.wo_number||'—')} · ${e(p?.reference||'')} ${e(p?.name||'Pièce')}</b><small>${e(a?.code||'Sans machine')} · réservé par ${e(u?.full_name||'utilisateur')} · ${r.reserved_at?new Date(r.reserved_at).toLocaleString('fr-FR'):'—'}</small></div><b>${rsvNum(r.quantity)}</b></div></div>`}).join('')||'<div class="mut">Aucune réservation visible.</div>'}</div>`;
    let replenishment=`<div class="stkGrid"><div class="card"><div class="stkSectionTitle"><h3>Réapprovisionnement recommandé</h3><span class="pill red">${risk.length}</span></div>${risk.map(x=>{let loc=typeof sLocation==='function'?sLocation(x.p):'Non défini';return `<div class="stkMini"><div class="row mobileStack"><div><b>${e(x.p.reference||'')} · ${e(x.p.name)}</b><small>${e(loc)}${x.p.bin_location?' · '+e(x.p.bin_location):''} · ${e(rsvStatusLabel(x.status))}${x.p.critical?' · CRITIQUE':''}</small></div><div style="text-align:right"><b>${x.reorder>0?x.reorder.toFixed(2):'—'}</b><small>qté suggérée</small></div></div><div class="stkLoc">Physique ${x.a.physical} · réservé ${x.a.reserved} · disponible ${x.a.available} · mini ${e(x.p.minimum_stock)} · entrant ${x.incoming} · couverture ${e(rsvCoverageLabel(x.coverage))}</div></div>`}).join('')||'<div class="mut">Aucun besoin détecté.</div>'}</div><div class="card"><h3>Logique de calcul</h3><div class="notice">Le réapprovisionnement utilise maintenant le <b>stock disponible après réservations</b>, puis tient compte des quantités déjà en commande.</div>${isMgr()?'<button class="btn primary" data-p="purchase" style="margin-top:12px">Ouvrir les achats</button>':''}</div></div>`;
    let consumption=`<div class="stkGrid"><div class="card"><h3>Machines les plus consommatrices</h3>${top.map(x=>`<div class="stkMini" data-asset="${x.asset.id}"><b>${e(x.asset.code||'')} · ${e(x.asset.name)}</b><small>${x.lines} mouvement(s) · ${x.qty.toFixed(2)} unités${isMgr()?' · '+x.cost.toFixed(2)+' MAD estimés':''}</small></div>`).join('')||'<div class="mut">Aucune consommation enregistrée.</div>'}</div><div class="card"><h3>Pièces les plus consommées — 90 j</h3>${all.map(p=>({p,u:typeof sUsage==='function'?sUsage(p.id,90):{qty:0,wo:0}})).filter(x=>x.u.qty>0).sort((a,b)=>b.u.qty-a.u.qty).slice(0,10).map(x=>`<div class="stkMini"><b>${e(x.p.reference||'')} · ${e(x.p.name)}</b><small>${x.u.qty.toFixed(2)} unité(s) · ${x.u.wo} OT · disponible ${rsvAvail(x.p.id).available}</small></div>`).join('')||'<div class="mut">Aucune consommation sur 90 jours.</div>'}</div></div>`;
    shell(`<div class="stkTop"><div><h1 class="title">Stock industriel</h1><p class="sub">Stock physique, réservations OT, disponible, consommation et réapprovisionnement.</p></div>${isMgr()?'<div class="stkToolbar"><button class="btn primary" data-a="newpart">+ Ajouter pièce</button><button class="btn" data-a="vendors">Fournisseurs</button><button class="btn" data-p="purchase">Achats</button><button class="btn" data-a="exportstock">Excel</button><button class="btn" data-a="printstock">PDF</button></div>':''}</div><div class="stkKpis"><div class="stkKpi"><b>${all.length}</b><span>Références actives</span></div><div class="stkKpi ${out.length?'hot':''}"><b>${out.length}</b><span>Ruptures disponibles</span></div><div class="stkKpi ${low.length?'warn':''}"><b>${low.length}</b><span>Sous stock mini</span></div><div class="stkKpi"><b>${reservedRefs.length}</b><span>Références réservées</span></div>${isMgr()?`<div class="stkKpi"><b>${value.toFixed(0)} MAD</b><span>Stock physique · ${reservedValue.toFixed(0)} MAD réservé</span></div>`:`<div class="stkKpi"><b>${risk.length}</b><span>À surveiller</span></div>`}</div><div class="stkToolbar"><button class="btn ${STOCK_STATE.view==='stock'?'on':''}" data-stock-view="stock">Stock</button><button class="btn ${STOCK_STATE.view==='reservations'?'on':''}" data-stock-view="reservations">Réservations</button><button class="btn ${STOCK_STATE.view==='replenishment'?'on':''}" data-stock-view="replenishment">Réapprovisionnement</button><button class="btn ${STOCK_STATE.view==='consumption'?'on':''}" data-stock-view="consumption">Consommation</button></div>${STOCK_STATE.view==='stock'?`<div class="stkFilters"><input id="stockSearch" placeholder="Rechercher pièce, réf., emplacement, fournisseur…" value="${e(STOCK_STATE.search)}"><select id="stockStatus"><option value="all">Tous les états</option>${[['rupture','Rupture'],['bas','Stock bas'],['risque','Risque'],['ok','OK']].map(x=>`<option value="${x[0]}" ${STOCK_STATE.status===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select id="stockCritical"><option value="all">Toutes les pièces</option><option value="critical" ${STOCK_STATE.critical==='critical'?'selected':''}>Critiques uniquement</option><option value="normal" ${STOCK_STATE.critical==='normal'?'selected':''}>Non critiques</option></select></div>${stockView}`:STOCK_STATE.view==='reservations'?reservationView:STOCK_STATE.view==='replenishment'?replenishment:consumption}`)
  };
})();
