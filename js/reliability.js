// Mainteno Next — Reliability / failure analysis (manager view).

const RELIABILITY_STATE = window.__maintenoReliability || (window.__maintenoReliability={
  range:'90',
  asset:'all'
});

function reliabilityStyles(){
  if(document.getElementById('reliabilityStyles'))return;
  const s=document.createElement('style');
  s.id='reliabilityStyles';
  s.textContent=`
    .relTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .relFilters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .relFilters .btn.on{background:#111827;color:#fff}
    .relFilters select{border:1px solid #d1d5db;border-radius:9px;padding:10px;background:#fff;min-width:210px}
    .relKpis{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:14px 0}
    .relKpi{background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px}
    .relKpi b{display:block;font-size:23px}.relKpi span{font-size:10px;color:var(--mut);font-weight:850;text-transform:uppercase}
    .relKpi.hot{border-color:#fecaca;background:#fff7f7}.relKpi.hot b{color:#b91c1c}
    .relGrid{display:grid;grid-template-columns:1.35fr 1fr;gap:12px}
    .relBarRow{display:grid;grid-template-columns:minmax(120px,1fr) 2fr auto;gap:9px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
    .relBarTrack{height:9px;background:#e5e7eb;border-radius:999px;overflow:hidden}.relBarTrack i{display:block;height:100%;background:#2563eb}
    .relBarTrack.hot i{background:#dc2626}
    .relMini{font-size:11px;color:var(--mut)}
    .relTable{width:100%;border-collapse:collapse}.relTable th,.relTable td{padding:9px 7px;border-bottom:1px solid var(--line);font-size:11px;text-align:left;vertical-align:top}.relTable th{color:var(--mut);font-size:10px;text-transform:uppercase}
    .relAssetLink{cursor:pointer}.relAssetLink:hover{text-decoration:underline}
    .relQuality{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.relQuality>div{background:#f8fafc;border-radius:10px;padding:10px}.relQuality b{display:block;font-size:19px}.relQuality span{font-size:10px;color:var(--mut);font-weight:800}
    .relHistoryItem{padding:11px 0;border-bottom:1px solid var(--line);cursor:pointer}.relHistoryItem:last-child{border-bottom:0}
    .relHistoryMeta{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.relHistoryMeta span{font-size:10px;background:#f3f4f6;border-radius:999px;padding:4px 7px}
    .relNote{font-size:11px;color:var(--mut);margin-top:8px}
    @media(max-width:1000px){.relKpis{grid-template-columns:repeat(3,1fr)}.relGrid{grid-template-columns:1fr}}
    @media(max-width:560px){.relKpis{grid-template-columns:1fr 1fr}.relFilters{width:100%}.relFilters select{width:100%;min-width:0}.relQuality{grid-template-columns:1fr}.relBarRow{grid-template-columns:1fr auto}.relBarTrack{grid-column:1/-1}.relTop{display:block}.relFilters{margin-top:10px}}
  `;
  document.head.appendChild(s);
}

function rAsset(w){return S.assets.find(a=>a.id===w.asset_id)}
function rClosed(w){return ['completed','validated'].includes(w.status)}
function rIsFailure(w){
  if(w.status==='cancelled')return false;
  return ['corrective','emergency'].includes(w.type)||Number(w.downtime_hours||0)>0;
}
function rEventDate(w){
  const v=w.completed_at||w.started_at||w.created_at||w.updated_at;
  const d=v?new Date(v):null;
  return d&&!Number.isNaN(d.getTime())?d:null;
}
function rDuration(w){
  const direct=Number(w.duration_hours||0);
  if(direct>0)return direct;
  if(w.started_at&&w.completed_at){
    const h=(new Date(w.completed_at)-new Date(w.started_at))/3600000;
    if(Number.isFinite(h)&&h>0)return h;
  }
  const labor=Number(w.labor_hours||0);
  return labor>0?labor:0;
}
function rDowntime(w){const n=Number(w.downtime_hours||0);return Number.isFinite(n)&&n>0?n:0}
function rHours(v){
  if(v==null||!Number.isFinite(v))return 'N/A';
  if(v>=48)return (v/24).toFixed(1)+' j';
  return v.toFixed(v>=10?1:2)+' h';
}
function rPct(n,d){return d?Math.round(n*100/d):0}
function rStartDate(){
  if(RELIABILITY_STATE.range==='all')return null;
  const days=Number(RELIABILITY_STATE.range)||90,d=new Date();
  d.setDate(d.getDate()-days);return d;
}
function rScopedFailures(){
  const start=rStartDate();
  return S.wo.filter(rIsFailure).filter(w=>{
    if(RELIABILITY_STATE.asset!=='all'&&w.asset_id!==RELIABILITY_STATE.asset)return false;
    const d=rEventDate(w);if(!d)return RELIABILITY_STATE.range==='all';
    return !start||d>=start;
  });
}
function rMtbfHours(rows){
  const by={};
  rows.filter(rClosed).forEach(w=>{if(!w.asset_id)return;const d=rEventDate(w);if(!d)return;(by[w.asset_id]||(by[w.asset_id]=[])).push(d.getTime())});
  const intervals=[];
  Object.values(by).forEach(ts=>{ts.sort((a,b)=>a-b);for(let i=1;i<ts.length;i++){const h=(ts[i]-ts[i-1])/3600000;if(h>0)intervals.push(h)}});
  return intervals.length?intervals.reduce((a,b)=>a+b,0)/intervals.length:null;
}
function rRangeHours(rows){
  if(RELIABILITY_STATE.range!=='all')return (Number(RELIABILITY_STATE.range)||90)*24;
  const ds=rows.map(rEventDate).filter(Boolean).sort((a,b)=>a-b);
  if(!ds.length)return 90*24;
  return Math.max(24,(Date.now()-ds[0].getTime())/3600000);
}
function rAssetStats(rows){
  const map={};
  rows.forEach(w=>{
    if(!w.asset_id)return;
    const x=map[w.asset_id]||(map[w.asset_id]={asset:rAsset(w),rows:[],downtime:0,durations:[]});
    x.rows.push(w);x.downtime+=rDowntime(w);const d=rDuration(w);if(rClosed(w)&&d>0)x.durations.push(d);
  });
  return Object.values(map).map(x=>({
    ...x,
    failures:x.rows.length,
    mttr:x.durations.length?x.durations.reduce((a,b)=>a+b,0)/x.durations.length:null,
    mtbf:rMtbfHours(x.rows)
  })).sort((a,b)=>b.downtime-a.downtime||b.failures-a.failures);
}
function rGroup(rows,keyFn){
  const m=new Map();
  rows.forEach(w=>{const raw=keyFn(w);if(!raw)return;const label=String(raw).trim();if(!label)return;const k=label.toLowerCase();const x=m.get(k)||{label,count:0,downtime:0};x.count++;x.downtime+=rDowntime(w);m.set(k,x)});
  return [...m.values()].sort((a,b)=>b.count-a.count||b.downtime-a.downtime);
}
function rBars(items,valueKey='downtime',limit=8){
  const xs=items.slice(0,limit),max=Math.max(1,...xs.map(x=>Number(x[valueKey]||0)));
  return xs.length?xs.map(x=>`<div class="relBarRow"><div><b>${e(x.label)}</b><div class="relMini">${x.count??''}${x.count!=null?' panne(s)':''}</div></div><div class="relBarTrack ${valueKey==='downtime'?'hot':''}"><i style="width:${Math.max(3,Number(x[valueKey]||0)/max*100)}%"></i></div><b>${valueKey==='downtime'?rHours(Number(x[valueKey]||0)):e(x[valueKey])}</b></div>`).join(''):'<div class="mut">Données insuffisantes.</div>';
}
function rDataQuality(closed){
  const root=closed.filter(w=>String(w.root_cause||'').trim()).length;
  const dt=closed.filter(w=>rDowntime(w)>0).length;
  const diag=closed.filter(w=>String(w.diagnosis||'').trim()).length;
  return `<div class="relQuality"><div><b>${rPct(root,closed.length)}%</b><span>Causes racines renseignées</span></div><div><b>${rPct(dt,closed.length)}%</b><span>Downtime renseigné</span></div><div><b>${rPct(diag,closed.length)}%</b><span>Diagnostics renseignés</span></div></div>`;
}
function rHistory(rows){
  const xs=[...rows].sort((a,b)=>(rEventDate(b)?.getTime()||0)-(rEventDate(a)?.getTime()||0)).slice(0,18);
  return xs.length?xs.map(w=>{const a=rAsset(w),d=rEventDate(w);return `<div class="relHistoryItem" data-wo="${w.id}"><div class="row"><div><b>#${e(w.wo_number)} · ${e(w.title)}</b><div class="mut">${e(a?.code||'Sans machine')} · ${d?d.toLocaleDateString('fr-FR'):'—'}</div></div>${pill(w.status)}</div><div class="relHistoryMeta"><span>${e(w.type||'—')}</span>${w.category?`<span>${e(w.category)}</span>`:''}<span>Downtime ${rHours(rDowntime(w))}</span>${w.resolution_status?`<span>${e(w.resolution_status)}</span>`:''}</div>${w.root_cause?`<div class="relNote"><b>Cause :</b> ${e(w.root_cause)}</div>`:''}</div>`}).join(''):'<div class="mut">Aucune panne dans cette période.</div>';
}

function reliability(){
  if(!isMgr()){S.page='workorders';return render()}
  reliabilityStyles();
  const rows=rScopedFailures(),closed=rows.filter(rClosed),downtime=rows.reduce((s,w)=>s+rDowntime(w),0),dur=closed.map(rDuration).filter(v=>v>0),mttr=dur.length?dur.reduce((a,b)=>a+b,0)/dur.length:null,mtbf=rMtbfHours(rows);
  const assetStats=rAssetStats(rows),rootGroups=rGroup(closed,w=>w.root_cause),catGroups=rGroup(rows,w=>w.category||w.type),provisional=closed.filter(w=>['temporary_repair','monitoring','not_repaired'].includes(w.resolution_status)).length;
  const assetCount=RELIABILITY_STATE.asset==='all'?Math.max(1,S.assets.filter(a=>a.active!==false).length):1,periodHours=rRangeHours(rows),availability=Math.max(0,Math.min(100,100-(downtime/(periodHours*assetCount))*100));
  const maxDt=Math.max(1,...assetStats.map(x=>x.downtime));
  shell(`<div class="relTop"><div><h1 class="title">Fiabilité & pannes</h1><p class="sub">MTBF, MTTR, arrêts, récurrence et Pareto des défaillances.</p></div><div class="relFilters"><div class="stack">${[['30','30 j'],['90','90 j'],['365','1 an'],['all','Tout']].map(x=>`<button class="btn ${RELIABILITY_STATE.range===x[0]?'on':''}" data-rel-range="${x[0]}">${x[1]}</button>`).join('')}</div><select id="relAsset"><option value="all">Toutes les machines</option>${S.assets.filter(a=>a.active!==false).map(a=>`<option value="${a.id}" ${RELIABILITY_STATE.asset===a.id?'selected':''}>${e(a.code||'')} · ${e(a.name)}</option>`).join('')}</select></div></div>
  <div class="relKpis"><div class="relKpi"><b>${rows.length}</b><span>Pannes / interventions</span></div><div class="relKpi hot"><b>${rHours(downtime)}</b><span>Temps d'arrêt déclaré</span></div><div class="relKpi"><b>${rHours(mttr)}</b><span>MTTR</span></div><div class="relKpi"><b>${rHours(mtbf)}</b><span>MTBF observé</span></div><div class="relKpi"><b>${availability.toFixed(1)}%</b><span>Disponibilité estimée</span></div></div>
  <div class="notice">Les indicateurs de fiabilité sont calculés à partir des OT correctifs/urgents et des downtimes déclarés. La disponibilité est une estimation basée uniquement sur les arrêts saisis dans Mainteno.</div>
  <div class="relGrid" style="margin-top:12px"><div class="card"><h3>Pareto machines — temps d'arrêt</h3>${assetStats.slice(0,10).map(x=>`<div class="relBarRow" data-asset="${x.asset?.id||''}"><div class="relAssetLink"><b>${e(x.asset?.code||'')} · ${e(x.asset?.name||'Machine')}</b><div class="relMini">${x.failures} panne(s) · MTTR ${rHours(x.mttr)} · MTBF ${rHours(x.mtbf)}</div></div><div class="relBarTrack hot"><i style="width:${Math.max(3,x.downtime/maxDt*100)}%"></i></div><b>${rHours(x.downtime)}</b></div>`).join('')||'<div class="mut">Aucune donnée machine.</div>'}</div><div class="card"><h3>Qualité des comptes-rendus</h3>${rDataQuality(closed)}<div class="relNote">${provisional} intervention(s) terminée(s) en réparation provisoire, surveillance ou non réparée.</div></div></div>
  <div class="relGrid"><div class="card"><h3>Causes racines les plus fréquentes</h3>${rBars(rootGroups,'count',8)}</div><div class="card"><h3>Catégories de panne</h3>${rBars(catGroups,'count',8)}</div></div>
  <div class="card"><div class="row mobileStack"><div><h3 style="margin:0">Performance par machine</h3><div class="mut">Triée par downtime décroissant</div></div></div><div style="overflow:auto"><table class="relTable"><thead><tr><th>Machine</th><th>Pannes</th><th>Downtime</th><th>MTTR</th><th>MTBF</th></tr></thead><tbody>${assetStats.map(x=>`<tr data-asset="${x.asset?.id||''}"><td class="relAssetLink"><b>${e(x.asset?.code||'')}</b><br>${e(x.asset?.name||'')}</td><td>${x.failures}</td><td>${rHours(x.downtime)}</td><td>${rHours(x.mttr)}</td><td>${rHours(x.mtbf)}</td></tr>`).join('')||'<tr><td colspan="5" class="mut">Aucune donnée.</td></tr>'}</tbody></table></div></div>
  <div class="card"><h3>Historique récent des pannes</h3>${rHistory(rows)}</div>`);
}

if(!window.__maintenoReliabilityEvents){
  window.__maintenoReliabilityEvents=true;
  document.addEventListener('click',ev=>{const b=ev.target.closest('[data-rel-range]');if(!b)return;RELIABILITY_STATE.range=b.dataset.relRange;reliability()});
  document.addEventListener('change',ev=>{if(ev.target.id==='relAsset'){RELIABILITY_STATE.asset=ev.target.value;reliability()}});
}
