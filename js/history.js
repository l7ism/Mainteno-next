// Mainteno Next — Historique V3: monthly snapshots, trends, comparisons and drift alerts.
(function(){
  if(window.__maintenoHistoryV3Loaded)return;
  window.__maintenoHistoryV3Loaded=true;

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
      .histCharts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
      .histChart{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px;overflow:hidden}
      .histChart h4{margin:0 0 4px}
      .histChart .mut{font-size:10px}
      .histChart svg{width:100%;height:190px;display:block;overflow:visible}
      .histChartAxis{stroke:#d1d5db;stroke-width:1}
      .histChartGrid{stroke:#e5e7eb;stroke-width:1}
      .histChartLine{fill:none;stroke:#111827;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
      .histChartPoint{fill:#fff;stroke:#111827;stroke-width:2}
      .histChartProvisional{fill:#f59e0b;stroke:#92400e;stroke-width:1.5}
      .histChartLabel{font-size:9px;fill:#6b7280}
      .histChartValue{font-size:9px;fill:#111827;font-weight:700}
      .histAlerts{display:grid;gap:8px}
      .histAlert{border-radius:10px;padding:10px 12px;font-size:12px;border:1px solid var(--line)}
      .histAlert.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}
      .histAlert.watch{background:#fffbeb;border-color:#fde68a;color:#92400e}
      .histAlert.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
      .histAlert.info{background:#f8fafc;color:#475569}
      .histCompareNote{margin:6px 0 12px;font-size:11px;color:var(--mut)}
      @media(max-width:850px){.histCards{grid-template-columns:repeat(2,minmax(0,1fr))}.histCharts{grid-template-columns:1fr}}
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

  function shortMonth(v){
    if(!v)return '—';
    try{
      const d=new Date(v+'T12:00:00');
      return d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}).replace('.','');
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

  function chron(rows){
    return [...rows].sort((a,b)=>String(a.month_start).localeCompare(String(b.month_start)));
  }

  function latestPair(rows){
    const a=chron(rows);
    return {cur:a[a.length-1]||null,prev:a[a.length-2]||null};
  }

  function closedPair(rows){
    const a=chron(rows).filter(r=>r.snapshot_status==='closed');
    return {cur:a[a.length-1]||null,prev:a[a.length-2]||null,count:a.length};
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

  function lineChart(title,rows,key,unit='',digits=1){
    const data=chron(rows).filter(r=>Number.isFinite(Number(r[key])));
    if(!data.length){
      return `<div class="histChart"><h4>${e(title)}</h4><div class="mut">Pas encore de données exploitables.</div></div>`;
    }

    const W=720,Hh=190,pL=42,pR=16,pT=22,pB=34;
    const vals=data.map(r=>Number(r[key]));
    let min=Math.min(...vals),max=Math.max(...vals);
    if(min===max){
      const pad=Math.abs(max||1)*0.15||1;
      min-=pad;max+=pad;
    }else{
      const pad=(max-min)*0.12;
      min-=pad;max+=pad;
    }
    if(min>0)min=Math.max(0,min);

    const x=(i)=>data.length===1?(pL+(W-pL-pR)/2):pL+i*(W-pL-pR)/(data.length-1);
    const y=(v)=>pT+(max-v)*(Hh-pT-pB)/(max-min);
    const pts=data.map((r,i)=>`${x(i).toFixed(1)},${y(Number(r[key])).toFixed(1)}`).join(' ');
    const grid=[0,1,2,3].map(i=>{
      const gy=pT+i*(Hh-pT-pB)/3;
      const gv=max-i*(max-min)/3;
      return `<line class="histChartGrid" x1="${pL}" y1="${gy}" x2="${W-pR}" y2="${gy}"></line><text class="histChartLabel" x="2" y="${gy+3}">${e(num(gv,digits))}</text>`;
    }).join('');
    const points=data.map((r,i)=>{
      const px=x(i),py=y(Number(r[key])),prov=r.snapshot_status!=='closed';
      return `<circle class="${prov?'histChartProvisional':'histChartPoint'}" cx="${px}" cy="${py}" r="4"></circle>
        <text class="histChartLabel" text-anchor="middle" x="${px}" y="${Hh-10}">${e(shortMonth(r.month_start))}</text>`;
    }).join('');
    const note=data.length<2?'Tendance disponible après au moins 2 mois.':'Point orange = mois provisoire.';
    return `<div class="histChart"><h4>${e(title)}</h4><div class="mut">${e(note)}</div>
      <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${e(title)}">
        ${grid}
        <line class="histChartAxis" x1="${pL}" y1="${Hh-pB}" x2="${W-pR}" y2="${Hh-pB}"></line>
        ${data.length>1?`<polyline class="histChartLine" points="${pts}"></polyline>`:''}
        ${points}
      </svg>
      <div class="histNote">Dernière valeur : <b>${e(num(vals[vals.length-1],digits))}${e(unit)}</b></div>
    </div>`;
  }

  function alertBlock(items,emptyText){
    if(!items.length)return `<div class="histAlert info">${e(emptyText)}</div>`;
    return `<div class="histAlerts">${items.map(a=>`<div class="histAlert ${a.level}"><b>${e(a.title)}</b><div>${e(a.text)}</div></div>`).join('')}</div>`;
  }

  function pctChange(a,b){
    const x=Number(a),y=Number(b);
    if(!Number.isFinite(x)||!Number.isFinite(y)||y===0)return null;
    return 100*(x-y)/Math.abs(y);
  }

  function maintenanceAlerts(rows){
    const {cur,prev,count}=closedPair(rows);
    if(count<2)return [];
    const out=[];
    let p=pctChange(cur.avg_mttr_hours,prev.avg_mttr_hours);
    if(p!=null&&p>=20&&Number(cur.avg_mttr_hours)-Number(prev.avg_mttr_hours)>=0.5)
      out.push({level:'bad',title:'MTTR en hausse',text:`+${num(p,1)} % entre ${shortMonth(prev.month_start)} et ${shortMonth(cur.month_start)}.`});
    p=pctChange(cur.total_downtime_hours,prev.total_downtime_hours);
    if(p!=null&&p>=20&&Number(cur.total_downtime_hours)-Number(prev.total_downtime_hours)>=1)
      out.push({level:'bad',title:'Downtime en hausse',text:`+${num(p,1)} % sur le dernier mois clôturé.`});
    if(Number.isFinite(Number(cur.first_time_fix_pct))&&Number.isFinite(Number(prev.first_time_fix_pct))&&Number(cur.first_time_fix_pct)<=Number(prev.first_time_fix_pct)-10)
      out.push({level:'watch',title:'First Time Fix en baisse',text:`${num(prev.first_time_fix_pct,1)} % → ${num(cur.first_time_fix_pct,1)} %.`});
    if(Number.isFinite(Number(cur.documentation_pct))&&Number.isFinite(Number(prev.documentation_pct))&&Number(cur.documentation_pct)<=Number(prev.documentation_pct)-10)
      out.push({level:'watch',title:'Documentation en baisse',text:`${num(prev.documentation_pct,1)} % → ${num(cur.documentation_pct,1)} %.`});
    if(!out.length)out.push({level:'ok',title:'Pas de dérive majeure détectée',text:'Les deux derniers mois clôturés restent dans les seuils de surveillance.'});
    return out;
  }

  function machineAlerts(rows){
    const {cur,prev,count}=closedPair(rows);
    if(count<2)return [];
    if(Number(cur.work_orders_completed||0)<2||Number(prev.work_orders_completed||0)<2)return [];
    const out=[];
    let p=pctChange(cur.downtime_hours,prev.downtime_hours);
    if(p!=null&&p>=25&&Number(cur.downtime_hours)-Number(prev.downtime_hours)>=1)
      out.push({level:'bad',title:'Downtime machine en hausse',text:`+${num(p,1)} % sur le dernier mois clôturé.`});
    p=pctChange(cur.mttr_hours,prev.mttr_hours);
    if(p!=null&&p>=20&&Number(cur.mttr_hours)-Number(prev.mttr_hours)>=0.5)
      out.push({level:'bad',title:'MTTR machine en hausse',text:`+${num(p,1)} %.`});
    if(Number(cur.corrective_failures)>=Number(prev.corrective_failures)+2)
      out.push({level:'watch',title:'Plus de pannes correctives',text:`${int(prev.corrective_failures)} → ${int(cur.corrective_failures)}.`});
    if(!out.length)out.push({level:'ok',title:'Machine stable',text:'Aucune dérive majeure détectée sur les mois clôturés comparables.'});
    return out;
  }

  function technicianAlerts(rows){
    const {cur,prev,count}=closedPair(rows);
    if(count<2||!cur?.comparison_ready||!prev?.comparison_ready)return [];
    const out=[];
    let p=pctChange(cur.mttr_hours,prev.mttr_hours);
    if(p!=null&&p>=20)
      out.push({level:'watch',title:'MTTR technicien en hausse',text:`+${num(p,1)} % sur un échantillon exploitable.`});
    if(Number.isFinite(Number(cur.rework_pct))&&Number.isFinite(Number(prev.rework_pct))&&Number(cur.rework_pct)>=Number(prev.rework_pct)+10)
      out.push({level:'bad',title:'Rework en hausse',text:`${num(prev.rework_pct,1)} % → ${num(cur.rework_pct,1)} %.`});
    if(Number.isFinite(Number(cur.documentation_pct))&&Number.isFinite(Number(prev.documentation_pct))&&Number(cur.documentation_pct)<=Number(prev.documentation_pct)-10)
      out.push({level:'watch',title:'Documentation en baisse',text:`${num(prev.documentation_pct,1)} % → ${num(cur.documentation_pct,1)} %.`});
    if(!out.length)out.push({level:'ok',title:'Tendance stable',text:'Aucune dérive majeure sur les deux derniers mois clôturés avec échantillon suffisant.'});
    return out;
  }

  function selectedLatestMonth(rows){
    return [...new Set(rows.map(r=>r.month_start))].sort().pop()||null;
  }

  function maintenanceView(){
    const rows=[...H.data.maintenance].sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    if(!cur)return '<div class="card"><div class="mut">Aucun snapshot maintenance.</div></div>';
    const alerts=maintenanceAlerts(rows);
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
        <h3>Surveillance des dérives</h3>
        ${alertBlock(alerts,'Deux mois clôturés sont nécessaires avant de générer des alertes de dérive fiables.')}
      </div>

      <div class="histCharts">
        ${lineChart('Évolution du MTTR',rows,'avg_mttr_hours',' h',2)}
        ${lineChart('Évolution du downtime',rows,'total_downtime_hours',' h',2)}
        ${lineChart('First Time Fix',rows,'first_time_fix_pct',' %',1)}
        ${lineChart('Coût des pièces',rows,'parts_cost_mad',' MAD',0)}
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

  function machineComparison(){
    const month=selectedLatestMonth(H.data.machines);
    if(!month)return '';
    const rows=H.data.machines.filter(r=>r.month_start===month).sort((a,b)=>Number(b.downtime_hours||0)-Number(a.downtime_hours||0));
    return `<div class="card"><h3>Comparaison machines · ${e(monthLabel(month))}</h3>
      <div class="histCompareNote">Vue descriptive du mois sélectionné. Un faible nombre d’OT peut rendre les ratios instables.</div>
      <div class="histTableWrap"><table class="histTable"><thead><tr><th>Machine</th><th>OT terminés</th><th>Pannes</th><th>MTTR</th><th>Downtime</th><th>FTF</th><th>Pièces</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td><b>${e((r.asset_code?`${r.asset_code} · `:'')+r.asset_name)}</b></td><td>${int(r.work_orders_completed)}</td><td>${int(r.corrective_failures)}</td><td>${num(r.mttr_hours,2)} h</td><td>${num(r.downtime_hours,2)} h</td><td>${num(r.first_time_fix_pct,1)} %</td><td>${mad(r.parts_cost_mad)}</td></tr>`).join('')}</tbody>
      </table></div></div>`;
  }

  function machineView(){
    const opts=uniq(H.data.machines,'asset_id',r=>(r.asset_code?`${r.asset_code} · `:'')+r.asset_name);
    const rows=H.data.machines.filter(r=>r.asset_id===H.assetId).sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    const alerts=machineAlerts(rows);
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

      <div class="card"><h3>Surveillance de la machine</h3>
        ${alertBlock(alerts,'Deux mois clôturés avec un volume suffisant sont nécessaires avant de signaler une dérive machine.')}
      </div>

      <div class="histCharts">
        ${lineChart('MTTR machine',rows,'mttr_hours',' h',2)}
        ${lineChart('Downtime machine',rows,'downtime_hours',' h',2)}
        ${lineChart('Pannes correctives',rows,'corrective_failures','',0)}
        ${lineChart('Coût pièces',rows,'parts_cost_mad',' MAD',0)}
      </div>

      ${machineComparison()}

      <div class="card"><h3>Historique machine</h3><div class="histTableWrap"><table class="histTable">
        <thead><tr><th>Mois</th><th>État snapshot</th><th>État machine</th><th>OT</th><th>Pannes</th><th>MTTR</th><th>Downtime</th><th>FTF</th><th>Rework</th><th>Docs</th><th>Pièces</th></tr></thead>
        <tbody>${rows.map(r=>`<tr><td><b>${e(monthLabel(r.month_start))}</b></td><td>${histStatus(r.snapshot_status)}</td><td>${e(r.asset_status||'—')}</td>
          <td>${int(r.work_orders_completed)}</td><td>${int(r.corrective_failures)}</td><td>${num(r.mttr_hours,2)} h</td><td>${num(r.downtime_hours,2)} h</td>
          <td>${num(r.first_time_fix_pct,1)} %</td><td>${num(r.rework_pct,1)} %</td><td>${num(r.documentation_pct,1)} %</td><td>${mad(r.parts_cost_mad)}</td></tr>`).join('')||'<tr><td colspan="11">Aucune donnée.</td></tr>'}</tbody>
      </table></div></div>`;
  }

  function technicianComparison(){
    const month=selectedLatestMonth(H.data.technicians);
    if(!month)return '';
    const rows=H.data.technicians.filter(r=>r.month_start===month).sort((a,b)=>String(a.technician_name).localeCompare(String(b.technician_name)));
    return `<div class="card"><h3>Comparaison équipe · ${e(monthLabel(month))}</h3>
      <div class="histCompareNote">Comparaison descriptive. Mainteno ne considère l’échantillon exploitable qu’à partir de 5 interventions terminées.</div>
      <div class="histTableWrap"><table class="histTable"><thead><tr><th>Technicien</th><th>Terminés</th><th>MTTR</th><th>FTF</th><th>Rework</th><th>Docs</th><th>Heures</th><th>Échantillon</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td><b>${e(r.technician_name)}</b></td><td>${int(r.completed_work_orders)}</td><td>${num(r.mttr_hours,2)} h</td><td>${num(r.first_time_fix_pct,1)} %</td><td>${num(r.rework_pct,1)} %</td><td>${num(r.documentation_pct,1)} %</td><td>${num(r.total_intervention_hours,2)} h</td><td>${r.comparison_ready?'<span class="pill green">Exploitable</span>':'<span class="pill orange">Faible</span>'}</td></tr>`).join('')}</tbody>
      </table></div></div>`;
  }

  function technicianView(){
    const opts=uniq(H.data.technicians,'technician_id',r=>r.technician_name);
    const rows=H.data.technicians.filter(r=>r.technician_id===H.technicianId).sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
    const {cur,prev}=latestPair(rows);
    const alerts=technicianAlerts(rows);
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

      <div class="card"><h3>Surveillance technicien</h3>
        ${alertBlock(alerts,'Deux mois clôturés avec au moins 5 interventions terminées par mois sont nécessaires avant de produire une alerte de tendance technicien.')}
      </div>

      <div class="histCharts">
        ${lineChart('OT terminés',rows,'completed_work_orders','',0)}
        ${lineChart('MTTR',rows,'mttr_hours',' h',2)}
        ${lineChart('First Time Fix',rows,'first_time_fix_pct',' %',1)}
        ${lineChart('Documentation',rows,'documentation_pct',' %',1)}
      </div>

      ${technicianComparison()}

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

    let stockAlert='';
    if(cur){
      if(Number(cur.quantity_available)<=0)stockAlert='<div class="histAlert bad"><b>Rupture disponible</b><div>Le stock disponible de cette pièce est nul.</div></div>';
      else if(Number(cur.quantity_available)<=Number(cur.minimum_stock))stockAlert='<div class="histAlert watch"><b>Disponible sous minimum</b><div>Le stock disponible est inférieur ou égal au seuil minimum.</div></div>';
      else stockAlert='<div class="histAlert ok"><b>Niveau disponible correct</b><div>Le stock disponible est au-dessus du seuil minimum.</div></div>';
    }

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

      <div class="card"><h3>Surveillance stock</h3>${stockAlert||'<div class="histAlert info">Aucun snapshot disponible.</div>'}</div>

      <div class="histCharts">
        ${lineChart('Stock disponible',rows,'quantity_available','',2)}
        ${lineChart('Quantité réservée',rows,'quantity_reserved','',2)}
        ${lineChart('Valeur de la pièce en stock',rows,'inventory_value_mad',' MAD',0)}
        ${lineChart('Coût unitaire',rows,'unit_cost_mad',' MAD',2)}
      </div>

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
        <div><h1 class="title">Historique</h1><p class="sub">Tendances mensuelles · Maintenance, machines, techniciens et stock</p></div>
        <div class="stack"><button class="btn primary" data-history-refresh ${H.loading?'disabled':''}>↻ Actualiser</button></div>
      </div>
      <div class="notice">Le mois en cours reste <b>provisoire</b>. Les alertes de dérive utilisent les mois clôturés et vérifient la taille de l’échantillon lorsque c’est nécessaire.</div>
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

  const baseManagerNav=managerNav;
  managerNav=function(){
    const a=baseManagerNav();
    if(!a.some(x=>x[0]==='history')){
      const i=a.findIndex(x=>x[0]==='reliability');
      a.splice(i>=0?i:a.length,0,['history','Historique','◫']);
    }
    return a;
  };

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
