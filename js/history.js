// Mainteno Next — Historique V2: manager read-only monthly snapshots.
(function(){
  if(window.__maintenoHistoryV2Loaded)return;
  window.__maintenoHistoryV2Loaded=true;

  const H={
    months:12,
    tab:'maintenance',
    loading:false,
    loaded:false,
    error:'',
    data:{maintenance:[],machines:[],technicians:[],stock:[]},
    assetId:'',
    technicianId:'',
    partId:''
  };

  function historyStyles(){
    if(document.getElementById('maintenoHistoryStyles'))return;
    const s=document.createElement('style');
    s.id='maintenoHistoryStyles';
    s.textContent=`
      .histTabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .histTabs .btn.on{background:#111827;color:#fff}
      .histStatus{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px}
      .histStatus.closed{background:#dcfce7;color:#166534}
      .histStatus.provisional{background:#fef3c7;color:#92400e}
      .histTableWrap{overflow:auto}
      .histTable{width:100%;border-collapse:collapse;min-width:820px}
      .histTable th,.histTable td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;font-size:12px}
      .histTable th{font-size:11px;color:var(--mut);font-weight:700;background:#f9fafb;position:sticky;top:0}
      .histCards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
      .histCard{padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff}
      .histCard b{display:block;font-size:22px;margin:4px 0}
      .histCard span{font-size:11px;color:var(--mut)}
      .histDelta{font-size:10px;margin-top:4px;color:var(--mut)}
      .histSelectors{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
      .histSelectors .field{min-width:180px;margin:0}
      .histNote{font-size:11px;color:var(--mut);margin-top:8px}
      @media(max-width:850px){.histCards{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.histCards{grid-template-columns:1fr}.histSelectors .field{width:100%;min-width:0}}
    `;
    document.head.appendChild(s);
  }

  function monthLabel(v){
    if(!v)return '—';
    try{
      const d=new Date(v+'T12:00:00');
      return d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    }catch{return v}
  }

  function num(v,d=1){
    const n=Number(v);
    return Number.isFinite(n)?n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  }

  function int(v){
    const n=Number(v);
    return Number.isFinite(n)?Math.round(n).toLocaleString('fr-FR'):'—';
  }

  function mad(v){
    const n=Number(v);
    return Number.isFinite(n)?n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' MAD':'—';
  }

  function histStatus(v){
    const c=v==='closed'?'closed':'provisional';
    const label=v==='closed'?'Clôturé':'Provisoire';
    return `<span class="histStatus ${c}">${label}</span>`;
  }

  function delta(cur,prev,suffix=''){
    const a=Number(cur),b=Number(prev);
    if(!Number.isFinite(a)||!Number.isFinite(b))return 'M-1 : —';
    const d=a-b;
    const arrow=d>0?'▲':d<0?'▼':'→';
    const sign=d>0?'+':'';
    return `M-1 ${arrow} ${sign}${num(d,1)}${suffix}`;
  }

  function latestPair(rows){
    const a=[...rows].sort((x,y)=>String(x.month_start).localeCompare(String(y.month_start)));
    return {cur:a[a.length-1]||null,prev:a[a.length-2]||null};
  }

  function uniq(rows,idKey,labelFn){
    const m=new Map();
    rows.forEach(r=>{if(r[idKey]&&!m.has(r[idKey]))m.set(r[idKey],labelFn(r))});
    return [...m.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  }

  function ensureSelections(){
    const assets=uniq(H.data.machines,'asset_id',r=>(r.asset_code?`${r.asset_code} · `:'')+r.asset_name);
    const techs=uniq(H.data.technicians,'technician_id',r=>r.technician_name);
    const parts=uniq(H.data.stock,'part_id',r=>(r.part_reference?`${r.part_reference} · `:'')+r.part_name);
    if(!assets.some(x=>x[0]===H.assetId))H.assetId=assets[0]?.[0]||'';
    if(!techs.some(x=>x[0]===H.technicianId))H.technicianId=techs[0]?.[0]||'';
    if(!parts.some(x=>x[0]===H.partId))H.partId=parts[0]?.[0]||'';
  }

  async function loadHistory(forceRefresh=false){
    if(H.loading)return;
    H.loading=true;H.error='';
    if(S.page==='history')render();
    try{
      if(forceRefresh){
        if(!navigator.onLine)throw Error('Connexion requise pour actualiser le snapshot');
        await rpc('nx_refresh_monthly_history',{});
      }
      H.data=await rpc('nx_history_bundle',{p_months:H.months})||{maintenance:[],machines:[],technicians:[],stock:[]};
      H.data.maintenance=Array.isArray(H.data.maintenance)?H.data.maintenance:[];
      H.data.machines=Array.isArray(H.data.machines)?H.data.machines:[];
      H.data.technicians=Array.isArray(H.data.technicians)?H.data.technicians:[];
      H.data.stock=Array.isArray(H.data.stock)?H.data.stock:[];
      H.loaded=true;
      ensureSelections();
    }catch(err){
      H.error=err?.message||String(err);
    }finally{
      H.loading=false;
      if(S.page==='history')render();
    }
  }

  function kpiCard(label,value,cur,prev,suffix=''){
    return `<div class="histCard"><span>${e(label)}</span><b>${e(value)}</b><div class="histDelta">${e(delta(cur,prev,suffix))}</div></div>`;
  }

  function maintenanceView(){
    const rows=[...H.data.maintenance].sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    if(!cur)return '<div class="card"><div class="mut">Aucun snapshot maintenance.</div></div>';
    return `
      <div class="card">
        <div class="row mobileStack">
          <div><h3 style="margin:0">${e(monthLabel(cur.month_start))}</h3><div class="histNote">Dernier snapshot maintenance · ${histStatus(cur.snapshot_status)}</div></div>
          <div class="mut">Calcul ${e(cur.calculation_version||'—')}</div>
        </div>
        <div class="histCards">
          ${kpiCard('OT terminés',int(cur.work_orders_completed),cur.work_orders_completed,prev?.work_orders_completed)}
          ${kpiCard('Backlog',int(cur.open_backlog),cur.open_backlog,prev?.open_backlog)}
          ${kpiCard('MTTR',num(cur.avg_mttr_hours,2)+' h',cur.avg_mttr_hours,prev?.avg_mttr_hours,' h')}
          ${kpiCard('Downtime',num(cur.total_downtime_hours,2)+' h',cur.total_downtime_hours,prev?.total_downtime_hours,' h')}
          ${kpiCard('First Time Fix',num(cur.first_time_fix_pct,1)+' %',cur.first_time_fix_pct,prev?.first_time_fix_pct,' %')}
          ${kpiCard('Documentation',num(cur.documentation_pct,1)+' %',cur.documentation_pct,prev?.documentation_pct,' %')}
          ${kpiCard('Coût pièces',mad(cur.parts_cost_mad),cur.parts_cost_mad,prev?.parts_cost_mad,' MAD')}
          ${kpiCard('Stock bas',int(cur.low_stock_parts),cur.low_stock_parts,prev?.low_stock_parts)}
        </div>
      </div>
      <div class="card">
        <h3>Historique mensuel maintenance</h3>
        <div class="histTableWrap"><table class="histTable">
          <thead><tr><th>Mois</th><th>État</th><th>Créés</th><th>Terminés</th><th>Backlog</th><th>Correctifs</th><th>Préventifs</th><th>MTTR</th><th>Downtime</th><th>FTF</th><th>Docs</th><th>Pièces</th></tr></thead>
          <tbody>${rows.map(r=>`<tr>
            <td><b>${e(monthLabel(r.month_start))}</b></td><td>${histStatus(r.snapshot_status)}</td>
            <td>${int(r.work_orders_created)}</td><td>${int(r.work_orders_completed)}</td><td>${int(r.open_backlog)}</td>
            <td>${int(r.corrective_completed)}</td><td>${int(r.preventive_completed)}</td>
            <td>${num(r.avg_mttr_hours,2)} h</td><td>${num(r.total_downtime_hours,2)} h</td>
            <td>${num(r.first_time_fix_pct,1)} %</td><td>${num(r.documentation_pct,1)} %</td><td>${mad(r.parts_cost_mad)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }

  function machineView(){
    const opts=uniq(H.data.machines,'asset_id',r=>(r.asset_code?`${r.asset_code} · `:'')+r.asset_name);
    const rows=H.data.machines.filter(r=>r.asset_id===H.assetId).sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    return `
      <div class="card"><div class="histSelectors">
        <div class="field"><label>Machine</label><select data-history-asset>${opts.map(([id,l])=>`<option value="${e(id)}" ${id===H.assetId?'selected':''}>${e(l)}</option>`).join('')}</select></div>
      </div></div>
      ${cur?`<div class="histCards">
        ${kpiCard('OT terminés',int(cur.work_orders_completed),cur.work_orders_completed,prev?.work_orders_completed)}
        ${kpiCard('Pannes correctives',int(cur.corrective_failures),cur.corrective_failures,prev?.corrective_failures)}
        ${kpiCard('MTTR',num(cur.mttr_hours,2)+' h',cur.mttr_hours,prev?.mttr_hours,' h')}
        ${kpiCard('Downtime',num(cur.downtime_hours,2)+' h',cur.downtime_hours,prev?.downtime_hours,' h')}
        ${kpiCard('FTF',num(cur.first_time_fix_pct,1)+' %',cur.first_time_fix_pct,prev?.first_time_fix_pct,' %')}
        ${kpiCard('Documentation',num(cur.documentation_pct,1)+' %',cur.documentation_pct,prev?.documentation_pct,' %')}
        ${kpiCard('Coût pièces',mad(cur.parts_cost_mad),cur.parts_cost_mad,prev?.parts_cost_mad,' MAD')}
        ${kpiCard('Heures intervention',num(cur.total_intervention_hours,2)+' h',cur.total_intervention_hours,prev?.total_intervention_hours,' h')}
      </div>`:''}
      <div class="card"><h3>Historique machine</h3><div class="histTableWrap"><table class="histTable">
        <thead><tr><th>Mois</th><th>État snapshot</th><th>État machine</th><th>OT</th><th>Pannes</th><th>MTTR</th><th>Downtime</th><th>FTF</th><th>Rework</th><th>Docs</th><th>Pièces</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td><b>${e(monthLabel(r.month_start))}</b></td><td>${histStatus(r.snapshot_status)}</td><td>${e(r.asset_status||'—')}</td>
          <td>${int(r.work_orders_completed)}</td><td>${int(r.corrective_failures)}</td><td>${num(r.mttr_hours,2)} h</td><td>${num(r.downtime_hours,2)} h</td>
          <td>${num(r.first_time_fix_pct,1)} %</td><td>${num(r.rework_pct,1)} %</td><td>${num(r.documentation_pct,1)} %</td><td>${mad(r.parts_cost_mad)}</td></tr>`).join('')||'<tr><td colspan="11">Aucune donnée.</td></tr>'}</tbody>
      </table></div></div>`;
  }

  function technicianView(){
    const opts=uniq(H.data.technicians,'technician_id',r=>r.technician_name);
    const rows=H.data.technicians.filter(r=>r.technician_id===H.technicianId).sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    return `
      <div class="card"><div class="histSelectors">
        <div class="field"><label>Technicien</label><select data-history-tech>${opts.map(([id,l])=>`<option value="${e(id)}" ${id===H.technicianId?'selected':''}>${e(l)}</option>`).join('')}</select></div>
        ${cur?`<div class="mut">${e(cur.technician_role||'')} ${cur.department?'· '+e(cur.department):''}</div>`:''}
      </div></div>
      ${cur?`<div class="histCards">
        ${kpiCard('OT terminés',int(cur.completed_work_orders),cur.completed_work_orders,prev?.completed_work_orders)}
        ${kpiCard('Correctifs',int(cur.corrective_completed),cur.corrective_completed,prev?.corrective_completed)}
        ${kpiCard('MTTR',num(cur.mttr_hours,2)+' h',cur.mttr_hours,prev?.mttr_hours,' h')}
        ${kpiCard('Réponse',num(cur.avg_response_minutes,1)+' min',cur.avg_response_minutes,prev?.avg_response_minutes,' min')}
        ${kpiCard('FTF',num(cur.first_time_fix_pct,1)+' %',cur.first_time_fix_pct,prev?.first_time_fix_pct,' %')}
        ${kpiCard('Rework',num(cur.rework_pct,1)+' %',cur.rework_pct,prev?.rework_pct,' %')}
        ${kpiCard('Documentation',num(cur.documentation_pct,1)+' %',cur.documentation_pct,prev?.documentation_pct,' %')}
        ${kpiCard('Heures intervention',num(cur.total_intervention_hours,2)+' h',cur.total_intervention_hours,prev?.total_intervention_hours,' h')}
      </div>`:''}
      <div class="card"><h3>Historique technicien</h3><div class="histTableWrap"><table class="histTable">
        <thead><tr><th>Mois</th><th>État</th><th>Affectés</th><th>Terminés</th><th>Ouverts</th><th>Correctifs</th><th>Préventifs</th><th>MTTR</th><th>Réponse</th><th>FTF</th><th>Docs</th><th>Échantillon</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td><b>${e(monthLabel(r.month_start))}</b></td><td>${histStatus(r.snapshot_status)}</td><td>${int(r.assigned_work_orders)}</td><td>${int(r.completed_work_orders)}</td>
          <td>${int(r.open_work_orders)}</td><td>${int(r.corrective_completed)}</td><td>${int(r.preventive_completed)}</td><td>${num(r.mttr_hours,2)} h</td>
          <td>${num(r.avg_response_minutes,1)} min</td><td>${num(r.first_time_fix_pct,1)} %</td><td>${num(r.documentation_pct,1)} %</td>
          <td>${r.comparison_ready?'<span class="pill green">Suffisant</span>':'<span class="pill orange">Faible</span>'}</td></tr>`).join('')||'<tr><td colspan="12">Aucune donnée.</td></tr>'}</tbody>
      </table></div></div>`;
  }

  function stockView(){
    const opts=uniq(H.data.stock,'part_id',r=>(r.part_reference?`${r.part_reference} · `:'')+r.part_name);
    const rows=H.data.stock.filter(r=>r.part_id===H.partId).sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    const months=[...new Set(H.data.stock.map(r=>r.month_start))].sort();
    const totals=months.map(m=>{
      const xs=H.data.stock.filter(r=>r.month_start===m);
      return {month:m,value:xs.reduce((s,r)=>s+Number(r.inventory_value_mad||0),0),reserved:xs.reduce((s,r)=>s+Number(r.reserved_value_mad||0),0),low:xs.filter(r=>Number(r.quantity_available)<=Number(r.minimum_stock)).length,status:xs[0]?.snapshot_status};
    }).sort((a,b)=>String(b.month).localeCompare(String(a.month)));
    return `
      <div class="card"><div class="histSelectors">
        <div class="field"><label>Pièce</label><select data-history-part>${opts.map(([id,l])=>`<option value="${e(id)}" ${id===H.partId?'selected':''}>${e(l)}</option>`).join('')}</select></div>
      </div></div>
      ${cur?`<div class="histCards">
        ${kpiCard('Stock physique',num(cur.quantity_on_hand,2),cur.quantity_on_hand,prev?.quantity_on_hand)}
        ${kpiCard('Réservé',num(cur.quantity_reserved,2),cur.quantity_reserved,prev?.quantity_reserved)}
        ${kpiCard('Disponible',num(cur.quantity_available,2),cur.quantity_available,prev?.quantity_available)}
        ${kpiCard('Valeur stock',mad(cur.inventory_value_mad),cur.inventory_value_mad,prev?.inventory_value_mad,' MAD')}
      </div>`:''}
      <div class="grid2">
        <div class="card"><h3>Historique de la pièce</h3><div class="histTableWrap"><table class="histTable">
          <thead><tr><th>Mois</th><th>État</th><th>Physique</th><th>Réservé</th><th>Disponible</th><th>Mini</th><th>Coût unitaire</th><th>Valeur</th></tr></thead>
          <tbody>${rows.map(r=>`<tr><td><b>${e(monthLabel(r.month_start))}</b></td><td>${histStatus(r.snapshot_status)}</td><td>${num(r.quantity_on_hand,2)}</td>
            <td>${num(r.quantity_reserved,2)}</td><td>${num(r.quantity_available,2)}</td><td>${num(r.minimum_stock,2)}</td><td>${mad(r.unit_cost_mad)}</td><td>${mad(r.inventory_value_mad)}</td></tr>`).join('')||'<tr><td colspan="8">Aucune donnée.</td></tr>'}</tbody>
        </table></div></div>
        <div class="card"><h3>Valeur globale du stock</h3>${totals.map(t=>`<div class="metric"><span>${e(monthLabel(t.month))} · ${histStatus(t.status)}</span><b>${e(mad(t.value))}</b></div><div class="mut" style="margin:-5px 0 9px">Réservé ${e(mad(t.reserved))} · ${t.low} réf. sous mini</div>`).join('')||'<div class="mut">Aucune donnée.</div>'}</div>
      </div>`;
  }

  function historyBody(){
    if(H.loading&&!H.loaded)return '<div class="card"><div class="mut">Chargement de l’historique…</div></div>';
    if(H.error)return `<div class="card"><div class="notice">${e(H.error)}</div><button class="btn primary" data-history-retry style="margin-top:10px">Réessayer</button></div>`;
    if(!H.loaded)return '<div class="card"><div class="mut">Préparation de l’historique…</div></div>';
    if(H.tab==='machines')return machineView();
    if(H.tab==='technicians')return technicianView();
    if(H.tab==='stock')return stockView();
    return maintenanceView();
  }

  function history(){
    if(!isMgr()){S.page='techhome';return render()}
    historyStyles();
    shell(`
      <div class="row mobileStack">
        <div><h1 class="title">Historique</h1><p class="sub">Snapshots mensuels figés · Maintenance, machines, techniciens et stock</p></div>
        <div class="stack"><button class="btn primary" data-history-refresh ${H.loading?'disabled':''}>↻ Actualiser</button></div>
      </div>
      <div class="notice">Le mois en cours reste <b>provisoire</b>. Au changement de mois, le snapshot précédent passe en <b>clôturé</b> et n’est plus recalculé par Mainteno.</div>
      <div class="row mobileStack" style="margin-top:12px">
        <div class="histTabs">
          <button class="btn ${H.tab==='maintenance'?'on':''}" data-history-tab="maintenance">Maintenance</button>
          <button class="btn ${H.tab==='machines'?'on':''}" data-history-tab="machines">Machines</button>
          <button class="btn ${H.tab==='technicians'?'on':''}" data-history-tab="technicians">Techniciens</button>
          <button class="btn ${H.tab==='stock'?'on':''}" data-history-tab="stock">Stock</button>
        </div>
        <div class="field" style="margin:0;min-width:145px"><label>Période</label><select data-history-months>
          ${[6,12,24,36].map(n=>`<option value="${n}" ${H.months===n?'selected':''}>${n} mois</option>`).join('')}
        </select></div>
      </div>
      ${historyBody()}
    `);
    if(!H.loaded&&!H.loading&&!H.error)setTimeout(()=>loadHistory(false),0);
  }

  // Add Historique to the manager navigation without editing router.js.
  const baseManagerNav=managerNav;
  managerNav=function(){
    const a=baseManagerNav();
    if(!a.some(x=>x[0]==='history')){
      const i=a.findIndex(x=>x[0]==='reliability');
      a.splice(i>=0?i:a.length,0,['history','Historique','◫']);
    }
    return a;
  };

  // Route only the new page; preserve all existing render behavior.
  const baseRender=render;
  render=function(){
    if(S.page==='history')return history();
    return baseRender();
  };

  document.addEventListener('click',ev=>{
    const tab=ev.target.closest('[data-history-tab]');
    if(tab){H.tab=tab.dataset.historyTab;return render()}
    if(ev.target.closest('[data-history-refresh]'))return loadHistory(true);
    if(ev.target.closest('[data-history-retry]'))return loadHistory(false);
  });

  document.addEventListener('change',ev=>{
    if(ev.target.matches('[data-history-months]')){
      H.months=Number(ev.target.value)||12;H.loaded=false;H.error='';return loadHistory(false);
    }
    if(ev.target.matches('[data-history-asset]')){H.assetId=ev.target.value;return render()}
    if(ev.target.matches('[data-history-tech]')){H.technicianId=ev.target.value;return render()}
    if(ev.target.matches('[data-history-part]')){H.partId=ev.target.value;return render()}
  });
})();
