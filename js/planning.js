// Mainteno Next — Planning V2, preventive maintenance and meters.

const PLANNING_STATE = window.__maintenoPlanning || (window.__maintenoPlanning={
  mode:'week',
  anchor:new Date().toISOString().slice(0,10),
  search:'',
  priority:'all',
  technician:'all'
});

function planningStyles(){
  if(document.getElementById('planningV2Styles'))return;
  const s=document.createElement('style');
  s.id='planningV2Styles';
  s.textContent=`
  .planTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .planToolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .planToolbar .btn.on{background:#111827;color:#fff}
  .planFilters{display:grid;grid-template-columns:minmax(180px,1fr) 160px 220px;gap:9px;margin:10px 0 14px}
  .planFilters input,.planFilters select{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:10px;background:#fff}
  .planKpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:12px 0}
  .planKpi{background:#fff;border:1px solid var(--line);border-radius:13px;padding:12px}
  .planKpi b{display:block;font-size:22px}.planKpi span{font-size:10px;font-weight:850;color:var(--mut);text-transform:uppercase}
  .planKpi.hot{border-color:#fecaca;background:#fff7f7}.planKpi.hot b{color:#b91c1c}
  .planWrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
  .planWeek{min-width:1120px;display:grid;grid-template-columns:190px repeat(7,minmax(130px,1fr))}
  .planHead,.planTechHead,.planCell{border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-height:90px;padding:8px}
  .planHead{min-height:auto;background:#f8fafc;font-size:11px;font-weight:900;text-align:center;position:sticky;top:0;z-index:4}
  .planHead.today{background:#eff6ff;color:#1d4ed8}
  .planCorner{left:0;z-index:6;text-align:left}
  .planTechHead{position:sticky;left:0;background:#fff;z-index:3;min-height:112px}
  .planTechHead b{display:block}.planTechHead small{display:block;color:var(--mut);margin-top:4px}
  .planLoad{margin-top:8px;height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden}.planLoad i{display:block;height:100%;background:#2563eb}.planLoad.over i{background:#dc2626}
  .planCell{min-height:112px;background:#fff}.planCell.today{background:#f8fbff}.planCell.dragover{outline:2px dashed #2563eb;outline-offset:-4px;background:#eff6ff}
  .planCard{border:1px solid #dbeafe;background:#f8fbff;border-left:4px solid #2563eb;border-radius:9px;padding:7px;margin-bottom:6px;cursor:pointer;font-size:11px}
  .planCard[data-priority="urgent"]{border-left-color:#dc2626;background:#fff7f7}.planCard[data-priority="high"]{border-left-color:#f59e0b;background:#fffaf5}
  .planCard .pcTitle{font-weight:900;line-height:1.2}.planCard .pcMeta{font-size:9px;color:var(--mut);margin-top:3px}.planCard.overdue .pcMeta{color:#b91c1c;font-weight:850}
  .planCard[draggable="true"]{cursor:grab}.planCard[draggable="true"]:active{cursor:grabbing}
  .planMonth{min-width:840px;display:grid;grid-template-columns:repeat(7,1fr)}
  .planMonth .planHead{position:static}.planDay{min-height:145px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px;background:#fff}.planDay.mutedDay{background:#f8fafc;color:#94a3b8}.planDay.today{background:#f8fbff}.planDay.dragover{outline:2px dashed #2563eb;outline-offset:-4px;background:#eff6ff}
  .planDayNum{font-weight:900;font-size:12px;margin-bottom:6px}.planMore{font-size:10px;color:#2563eb;font-weight:800;margin-top:4px}
  .planUnscheduled{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.planUnscheduled .planCard{margin:0}
  .planCardActions{display:flex;justify-content:flex-end;margin-top:5px}.planCardActions button{border:0;background:#e5e7eb;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:800;cursor:pointer}
  .planSectionTitle{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:18px 0 8px}.planSectionTitle h2{font-size:16px;margin:0}
  .planWorkload{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.planWorkCard{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px}.planWorkCard b{display:block}.planWorkCard small{color:var(--mut)}
  .planModalWrap{position:fixed;inset:0;background:#0009;z-index:120;display:grid;place-items:center;padding:18px}.planModal{width:min(520px,100%);background:#fff;border-radius:15px;padding:16px;box-shadow:0 20px 60px #0003}.planModal h3{margin-top:0}
  @media(max-width:900px){.planFilters{grid-template-columns:1fr 1fr}.planFilters input{grid-column:1/-1}.planKpis{grid-template-columns:1fr 1fr}.planUnscheduled{grid-template-columns:1fr 1fr}.planWorkload{grid-template-columns:1fr 1fr}}
  @media(max-width:560px){.planFilters{grid-template-columns:1fr}.planFilters input{grid-column:auto}.planUnscheduled,.planWorkload{grid-template-columns:1fr}.planKpis{grid-template-columns:1fr 1fr}.planTop{display:block}.planToolbar{margin-top:10px}.planToolbar .btn{padding:9px 10px}}
  `;
  document.head.appendChild(s);
}

function pDate(v){
  const d=v instanceof Date?new Date(v):new Date(v+'T12:00:00');
  d.setHours(12,0,0,0);
  return d;
}
function pIso(d){
  const x=new Date(d),y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function pMonday(d){const x=pDate(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);return x}
function pAdd(d,n){const x=pDate(d);x.setDate(x.getDate()+n);return x}
function pMonthStart(d){const x=pDate(d);x.setDate(1);return x}
function pSameDay(a,b){return pIso(a)===pIso(b)}
function pClosed(w){return ['completed','validated','cancelled'].includes(w.status)}
function pTechs(){return S.profiles.filter(p=>p.active!==false&&['technician','supervisor'].includes(p.role))}
function pAsset(w){return S.assets.find(a=>a.id===w.asset_id)}
function pTech(w){return S.profiles.find(p=>p.id===w.technician_id)}
function pPriorityLabel(v){return({urgent:'Urgente',high:'Haute',medium:'Moyenne',low:'Basse'})[v]||v||'—'}
function pPeriod(){
  const a=pDate(PLANNING_STATE.anchor);
  if(PLANNING_STATE.mode==='month'){
    const start=pMonthStart(a),end=new Date(start);end.setMonth(end.getMonth()+1);end.setDate(0);end.setHours(12,0,0,0);return{start,end};
  }
  const start=pMonday(a),end=pAdd(start,6);return{start,end};
}
function pFilteredOrders(){
  let x=S.wo.filter(w=>!pClosed(w));
  const q=(PLANNING_STATE.search||'').trim().toLowerCase();
  if(q)x=x.filter(w=>{
    const a=pAsset(w),t=pTech(w);
    return [w.wo_number,w.title,w.category,w.type,a?.code,a?.name,t?.full_name].some(v=>String(v||'').toLowerCase().includes(q));
  });
  if(PLANNING_STATE.priority!=='all')x=x.filter(w=>w.priority===PLANNING_STATE.priority);
  if(PLANNING_STATE.technician!=='all'){
    if(PLANNING_STATE.technician==='unassigned')x=x.filter(w=>!w.technician_id);
    else x=x.filter(w=>w.technician_id===PLANNING_STATE.technician);
  }
  return x;
}
function pInPeriod(w,period){if(!w.due_at)return false;const d=new Date(w.due_at);return d>=new Date(period.start.getFullYear(),period.start.getMonth(),period.start.getDate())&&d<new Date(period.end.getFullYear(),period.end.getMonth(),period.end.getDate()+1)}
function pDueDate(w){return w.due_at?pIso(new Date(w.due_at)):null}
function pDueTime(w){if(!w.due_at)return '09:00';const d=new Date(w.due_at);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function pDueIso(date,time){
  const [y,m,d]=date.split('-').map(Number),[hh,mm]=(time||'09:00').split(':').map(Number);
  return new Date(y,m-1,d,hh||0,mm||0,0,0).toISOString();
}
function pHours(w){const m=Number(w.estimated_minutes||0);return Number.isFinite(m)?m/60:0}
function pCard(w,compact=false){
  const a=pAsset(w),t=pTech(w),late=w.due_at&&new Date(w.due_at)<new Date();
  return `<div class="planCard ${late?'overdue':''}" data-wo="${w.id}" data-plan-drag="${w.id}" data-priority="${e(w.priority||'medium')}" draggable="${isMgr()?'true':'false'}">
    <div class="pcTitle">#${e(w.wo_number)} · ${e(w.title)}</div>
    <div class="pcMeta">${e(a?.code||'Sans machine')}${compact?'':' · '+e(pPriorityLabel(w.priority))}${t&&!compact?' · '+e(t.full_name):''}${w.estimated_minutes?' · '+e(w.estimated_minutes)+' min':''}</div>
    ${!compact&&isMgr()?`<div class="planCardActions"><button type="button" data-plan-edit="${w.id}">Planifier</button></div>`:''}
  </div>`;
}
function pDayOrders(date,orders,techId){return orders.filter(w=>pDueDate(w)===date&&(techId==='unassigned'?!w.technician_id:w.technician_id===techId))}
function pTechLoad(techId,orders,start,end){
  const xs=orders.filter(w=>w.technician_id===techId&&pInPeriod(w,{start,end}));
  return{count:xs.length,hours:xs.reduce((s,w)=>s+pHours(w),0),overdue:xs.filter(w=>w.due_at&&new Date(w.due_at)<new Date()).length};
}
function pWeekTitle(start,end){return `${start.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} — ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`}
function pMonthTitle(d){return d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}

function planningWeek(orders,period){
  const days=Array.from({length:7},(_,i)=>pAdd(period.start,i));
  let techs=pTechs();
  if(PLANNING_STATE.technician!=='all'&&PLANNING_STATE.technician!=='unassigned')techs=techs.filter(t=>t.id===PLANNING_STATE.technician);
  const rows=[...techs.map(t=>({id:t.id,name:t.full_name})),{id:'unassigned',name:'Non affectés'}];
  return `<div class="planWrap"><div class="planWeek">
    <div class="planHead planCorner">Technicien</div>
    ${days.map(d=>`<div class="planHead ${pSameDay(d,new Date())?'today':''}">${d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit'})}</div>`).join('')}
    ${rows.map(r=>{
      const load=r.id==='unassigned'?null:pTechLoad(r.id,orders,period.start,period.end),pct=load?Math.min(100,(load.hours/40)*100):0;
      return `<div class="planTechHead"><b>${e(r.name)}</b>${load?`<small>${load.count} OT · ${load.hours.toFixed(1)} h estimées${load.overdue?' · '+load.overdue+' retard':''}</small><div class="planLoad ${load.hours>40?'over':''}"><i style="width:${pct}%"></i></div>`:'<small>OT sans technicien</small>'}</div>
      ${days.map(d=>{const date=pIso(d),xs=pDayOrders(date,orders,r.id);return `<div class="planCell ${pSameDay(d,new Date())?'today':''}" data-plan-drop="1" data-plan-date="${date}" data-plan-tech="${r.id}">${xs.map(w=>pCard(w,true)).join('')}</div>`}).join('')}`;
    }).join('')}
  </div></div>`;
}

function planningMonth(orders,period){
  const first=pMonday(pMonthStart(period.start)),last=pAdd(first,41),days=[];for(let d=first;d<=last;d=pAdd(d,1))days.push(d);
  const names=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  return `<div class="planWrap"><div class="planMonth">
    ${names.map(n=>`<div class="planHead">${n}</div>`).join('')}
    ${days.map(d=>{const date=pIso(d),cur=d.getMonth()===period.start.getMonth(),xs=orders.filter(w=>pDueDate(w)===date),show=xs.slice(0,4);return `<div class="planDay ${cur?'':'mutedDay'} ${pSameDay(d,new Date())?'today':''}" data-plan-drop="1" data-plan-date="${date}" data-plan-tech="keep"><div class="planDayNum">${d.getDate()}</div>${show.map(w=>pCard(w,true)).join('')}${xs.length>4?`<div class="planMore">+ ${xs.length-4} autre(s)</div>`:''}</div>`}).join('')}
  </div></div>`;
}

function planningWorkload(orders,period){
  const techs=pTechs().map(t=>({t,...pTechLoad(t.id,orders,period.start,period.end)})).sort((a,b)=>b.hours-a.hours);
  return `<div class="planWorkload">${techs.map(x=>`<div class="planWorkCard"><b>${e(x.t.full_name)}</b><small>${x.count} OT · ${x.hours.toFixed(1)} h estimées${x.overdue?' · '+x.overdue+' retard':''}</small></div>`).join('')||'<div class="mut">Aucun technicien actif.</div>'}</div>`;
}

function planning(){
  if(!isMgr()){S.page='workorders';return render()}
  planningStyles();
  const period=pPeriod(),all=pFilteredOrders(),scheduled=all.filter(w=>pInPeriod(w,period)),unscheduled=all.filter(w=>!w.due_at),urgent=scheduled.filter(w=>['urgent','high'].includes(w.priority)),overdue=all.filter(w=>w.due_at&&new Date(w.due_at)<new Date());
  const title=PLANNING_STATE.mode==='month'?pMonthTitle(period.start):pWeekTitle(period.start,period.end);
  shell(`<div class="planTop"><div><h1 class="title">Planning maintenance</h1><p class="sub">Planifier les OT, équilibrer la charge et suivre les retards.</p></div><div class="planToolbar"><button class="btn ${PLANNING_STATE.mode==='week'?'on':''}" data-plan-mode="week">Semaine</button><button class="btn ${PLANNING_STATE.mode==='month'?'on':''}" data-plan-mode="month">Mois</button></div></div>
  <div class="planToolbar"><button class="btn" data-plan-nav="prev">←</button><button class="btn" data-plan-nav="today">Aujourd’hui</button><button class="btn" data-plan-nav="next">→</button><b style="margin-left:4px">${e(title)}</b></div>
  <div class="planFilters"><input id="planSearch" placeholder="Rechercher OT, machine, technicien…" value="${e(PLANNING_STATE.search)}"><select id="planPriority"><option value="all">Toutes priorités</option>${['urgent','high','medium','low'].map(v=>`<option value="${v}" ${PLANNING_STATE.priority===v?'selected':''}>${pPriorityLabel(v)}</option>`).join('')}</select><select id="planTech"><option value="all">Tous les techniciens</option><option value="unassigned" ${PLANNING_STATE.technician==='unassigned'?'selected':''}>Non affectés</option>${pTechs().map(t=>`<option value="${t.id}" ${PLANNING_STATE.technician===t.id?'selected':''}>${e(t.full_name)}</option>`).join('')}</select></div>
  <div class="planKpis"><div class="planKpi"><b>${scheduled.length}</b><span>OT dans la période</span></div><div class="planKpi"><b>${unscheduled.length}</b><span>Non planifiés</span></div><div class="planKpi"><b>${urgent.length}</b><span>Prioritaires</span></div><div class="planKpi ${overdue.length?'hot':''}"><b>${overdue.length}</b><span>En retard</span></div></div>
  ${PLANNING_STATE.mode==='month'?planningMonth(all,period):planningWeek(all,period)}
  <div class="planSectionTitle"><h2>Charge techniciens</h2><span class="mut">Basée sur les durées estimées des OT visibles</span></div>${planningWorkload(all,period)}
  <div class="planSectionTitle"><h2>OT non planifiés</h2><span class="pill blue">${unscheduled.length}</span></div><div class="planUnscheduled">${unscheduled.map(w=>pCard(w)).join('')||'<div class="card mut">Tous les OT ouverts filtrés ont une échéance.</div>'}</div>`);
}

function planningEditModal(w){
  if(!w)return;
  const due=w.due_at?new Date(w.due_at):new Date(),date=w.due_at?pIso(due):pIso(new Date()),time=pDueTime(w),techs=pTechs();
  const wrap=document.createElement('div');wrap.className='planModalWrap';wrap.innerHTML=`<div class="planModal"><h3>Planifier OT #${e(w.wo_number)}</h3><p class="mut">${e(w.title)}</p><form id="planningEditForm"><input type="hidden" name="wo_id" value="${w.id}"><div class="grid2"><div class="field"><label>Date *</label><input name="date" type="date" required value="${date}"></div><div class="field"><label>Heure *</label><input name="time" type="time" required value="${time}"></div></div><div class="field"><label>Technicien</label><select name="technician_id"><option value="">Non affecté</option>${techs.map(t=>`<option value="${t.id}" ${w.technician_id===t.id?'selected':''}>${e(t.full_name)}</option>`).join('')}</select></div><div class="stack" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn" data-plan-close>Annuler</button>${w.due_at?'<button type="button" class="btn danger" data-plan-unschedule="'+w.id+'">Retirer du planning</button>':''}<button class="btn primary">Enregistrer</button></div></form></div>`;document.body.appendChild(wrap);
}

async function planningMove(woId,date,tech){
  if(!navigator.onLine)throw Error('Connexion requise pour modifier le planning');
  const w=S.wo.find(x=>x.id===woId);if(!w)throw Error('OT introuvable');
  const techId=tech==='keep'?w.technician_id:(tech==='unassigned'?null:tech||null);
  const due=pDueIso(date,pDueTime(w));
  await rpc('nx_assign_work_order',{p_work_order_id:w.id,p_team_id:w.team_id||null,p_technician_id:techId,p_due_at:due});
  await loadAll();planning();toast('Planning mis à jour');
}

if(!window.__maintenoPlanningEvents){
  window.__maintenoPlanningEvents=true;
  let dragId=null,searchTimer=null;
  document.addEventListener('click',async ev=>{
    const mode=ev.target.closest('[data-plan-mode]');if(mode){PLANNING_STATE.mode=mode.dataset.planMode;planning();return}
    const nav=ev.target.closest('[data-plan-nav]');if(nav){let a=pDate(PLANNING_STATE.anchor);if(nav.dataset.planNav==='today')a=new Date();else if(PLANNING_STATE.mode==='month')a.setMonth(a.getMonth()+(nav.dataset.planNav==='next'?1:-1));else a.setDate(a.getDate()+(nav.dataset.planNav==='next'?7:-7));PLANNING_STATE.anchor=pIso(a);planning();return}
    const edit=ev.target.closest('[data-plan-edit]');if(edit){ev.stopPropagation();planningEditModal(S.wo.find(w=>w.id===edit.dataset.planEdit));return}
    const close=ev.target.closest('[data-plan-close]');if(close){close.closest('.planModalWrap')?.remove();return}
    const uns=ev.target.closest('[data-plan-unschedule]');if(uns){try{if(!navigator.onLine)throw Error('Connexion requise');const w=S.wo.find(x=>x.id===uns.dataset.planUnschedule);await rpc('nx_assign_work_order',{p_work_order_id:w.id,p_team_id:w.team_id||null,p_technician_id:w.technician_id||null,p_due_at:null});uns.closest('.planModalWrap')?.remove();await loadAll();planning();toast('OT retiré du planning')}catch(x){toast(x.message,1)}return}
  });
  document.addEventListener('input',ev=>{if(ev.target.id==='planSearch'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{PLANNING_STATE.search=ev.target.value;planning()},250)}});
  document.addEventListener('change',ev=>{if(ev.target.id==='planPriority'){PLANNING_STATE.priority=ev.target.value;planning()}if(ev.target.id==='planTech'){PLANNING_STATE.technician=ev.target.value;planning()}});
  document.addEventListener('submit',async ev=>{if(ev.target.id!=='planningEditForm')return;ev.preventDefault();const o=Object.fromEntries(new FormData(ev.target));try{if(!navigator.onLine)throw Error('Connexion requise');const w=S.wo.find(x=>x.id===o.wo_id);await rpc('nx_assign_work_order',{p_work_order_id:w.id,p_team_id:w.team_id||null,p_technician_id:o.technician_id||null,p_due_at:pDueIso(o.date,o.time)});ev.target.closest('.planModalWrap')?.remove();await loadAll();planning();toast('OT planifié')}catch(x){toast(x.message,1)}});
  document.addEventListener('dragstart',ev=>{const c=ev.target.closest('[data-plan-drag]');if(!c)return;dragId=c.dataset.planDrag;ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',dragId)});
  document.addEventListener('dragover',ev=>{const z=ev.target.closest('[data-plan-drop]');if(!z)return;ev.preventDefault();z.classList.add('dragover');ev.dataTransfer.dropEffect='move'});
  document.addEventListener('dragleave',ev=>{const z=ev.target.closest('[data-plan-drop]');if(z)z.classList.remove('dragover')});
  document.addEventListener('drop',async ev=>{const z=ev.target.closest('[data-plan-drop]');if(!z)return;ev.preventDefault();z.classList.remove('dragover');const id=ev.dataTransfer.getData('text/plain')||dragId;dragId=null;if(!id)return;try{await planningMove(id,z.dataset.planDate,z.dataset.planTech)}catch(x){toast(x.message,1)}});
}

function meters(){shell(`<div class="row mobileStack"><div><h1 class="title">Compteurs</h1><p class="sub">Heures, cycles, énergie et relevés</p></div>${isMgr()?'<button class="btn primary" data-a="newmeter">+ Nouveau compteur</button>':''}</div><div class="grid2">${S.meters.map(m=>`<div class="card"><div class="row"><div><b>${e(m.name)}</b><div class="mut">${e(m.current_value??'—')} ${e(m.unit||'')} · ${e(m.meter_type)}</div></div>${isMgr()?`<button class="btn" data-meterread="${m.id}">Saisir relevé</button>`:''}</div><div class="mut">${e(S.assets.find(a=>a.id===m.asset_id)?.code||'Sans machine')}</div></div>`).join('')||'<div class="mut">Aucun compteur.</div>'}</div>`)}
function meterForm(){if(!isMgr()){S.page='meters';return render()}shell(`<button class="btn" data-p="meters">← Compteurs</button><h1 class="title">Nouveau compteur</h1><form id="meterCRUD" class="card"><div class="field"><label>Nom *</label><input name="name" required placeholder="Heures compresseur 1"></div><div class="grid2"><div class="field"><label>Machine</label><select name="asset_id"><option value="">—</option>${S.assets.map(a=>`<option value="${a.id}">${e(a.code)} · ${e(a.name)}</option>`).join('')}</select></div><div class="field"><label>Emplacement</label><select name="location_id"><option value="">—</option>${activeLocations().map(l=>`<option value="${l.id}">${e(l.path||l.name)}</option>`).join('')}</select></div></div><div class="grid3"><div class="field"><label>Type</label><select name="meter_type"><option value="hours">Heures</option><option value="cycles">Cycles</option><option value="energy">Énergie</option><option value="water">Eau</option><option value="other">Autre</option></select></div><div class="field"><label>Unité *</label><input name="unit" required value="h"></div><div class="field"><label>Valeur initiale</label><input name="current_value" type="number" step="any" value="0"></div></div><div class="field"><label>Valeur de rollover (optionnel)</label><input name="rollover_value" type="number" step="any"></div><button class="btn primary">Créer le compteur</button></form>`)}
function pm(){shell(`<div class="row mobileStack"><div><h1 class="title">Maintenance préventive</h1><p class="sub">Plans calendrier et compteur</p></div>${isMgr()?'<button class="btn primary" data-a="newpm">+ Nouveau plan</button>':''}</div><div class="card">${S.pm.map(p=>`<div class="listitem"><div class="row"><div><b>${e(p.name)}</b><div class="mut">${e(p.schedule_type)} · ${p.next_due_at?new Date(p.next_due_at).toLocaleString('fr-FR'):p.meter_interval?'tous les '+p.meter_interval+' '+e(S.meters.find(m=>m.id===p.meter_id)?.unit||''): 'déclenchement compteur'}</div><div class="mut">${e(S.assets.find(a=>a.id===p.asset_id)?.code||'Sans machine')} · ${e(p.priority)}</div></div>${pill(p.active?'active':'inactive')}</div></div>`).join('')||'<div class="mut">Aucun plan. Crée ton premier préventif.</div>'}</div>`)}
function pmForm(){if(!isMgr()){S.page='pm';return render()}shell(`<button class="btn" data-p="pm">← Préventif</button><h1 class="title">Nouveau plan préventif</h1><form id="pmCRUD" class="card"><div class="field"><label>Nom *</label><input name="name" required placeholder="Révision mensuelle compresseur"></div><div class="field"><label>Description</label><textarea name="description"></textarea></div><div class="grid2"><div class="field"><label>Machine</label><select name="asset_id"><option value="">—</option>${S.assets.map(a=>`<option value="${a.id}">${e(a.code)} · ${e(a.name)}</option>`).join('')}</select></div><div class="field"><label>Procédure publiée</label><select name="procedure_id"><option value="">—</option>${S.procedures.filter(p=>p.status==='published').map(p=>`<option value="${p.id}">${e(p.name)} v${p.version}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>Équipe</label><select name="team_id" id="pmTeam"><option value="">—</option>${S.teams.map(t=>`<option value="${t.id}">${e(t.name)}</option>`).join('')}</select></div><div class="field"><label>Technicien</label><select name="technician_id" id="pmTech"><option value="">—</option>${activeTechs().map(p=>`<option value="${p.id}">${e(p.full_name)}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>Déclenchement</label><select name="schedule_type" id="pmSchedule"><option value="calendar">Calendrier</option><option value="meter">Compteur</option></select></div><div class="field"><label>Priorité</label><select name="priority"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div></div><div id="pmCalendarBlock"><h3>Calendrier</h3><div class="grid3"><div class="field"><label>Fréquence</label><input name="frequency_value" type="number" min="1" step="1" value="1"></div><div class="field"><label>Unité</label><select name="frequency_unit"><option value="day">Jour</option><option value="week">Semaine</option><option value="month" selected>Mois</option><option value="year">Année</option></select></div><div class="field"><label>Prochaine échéance</label><input name="next_due_at" type="datetime-local"></div></div></div><div id="pmMeterBlock" style="display:none"><h3>Compteur</h3><div class="grid2"><div class="field"><label>Compteur</label><select name="meter_id"><option value="">—</option>${S.meters.map(m=>`<option value="${m.id}">${e(m.name)} (${e(m.current_value??0)} ${e(m.unit)})</option>`).join('')}</select></div><div class="field"><label>Intervalle</label><input name="meter_interval" type="number" min="0.01" step="any"></div></div></div></div><div class="field"><label>Anticipation (jours)</label><input name="lead_time_days" type="number" min="0" value="0"></div><button class="btn primary">Créer le plan</button></form>`)}
