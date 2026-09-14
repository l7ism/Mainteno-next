// Mainteno Next — technician mobile home and field-oriented work order views.

function techAssignedOrders(){
  return S.wo.filter(w=>w.technician_id===S.u?.id);
}

function techClosed(w){
  return ['completed','validated','cancelled'].includes(w.status);
}

function techPriorityLabel(v){
  return ({urgent:'Urgente',high:'Haute',medium:'Moyenne',low:'Basse'})[v]||v||'—';
}

function techDueInfo(w){
  if(!w.due_at)return{text:'Sans échéance',cls:''};
  const due=new Date(w.due_at),now=new Date(),diff=due-now;

  if(!techClosed(w)&&diff<0){
    const h=Math.max(1,Math.round(Math.abs(diff)/3600000));
    return{
      text:`En retard · ${h<24?h+' h':Math.round(h/24)+' j'}`,
      cls:'overdue'
    };
  }

  if(diff>=0&&diff<=86400000){
    const h=Math.max(1,Math.round(diff/3600000));
    return{text:`Échéance dans ${h} h`,cls:'soon'};
  }

  return{
    text:'Échéance '+due.toLocaleString('fr-FR',{
      day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
    }),
    cls:''
  };
}

function techOrderScore(w){
  const p={urgent:400,high:300,medium:200,low:100}[w.priority]||0;
  const s={in_progress:80,on_hold:60,assigned:40,open:30}[w.status]||0;
  const overdue=w.due_at&&!techClosed(w)&&new Date(w.due_at)<new Date()?1000:0;
  const due=w.due_at
    ?Math.max(0,100-Math.min(100,(new Date(w.due_at)-Date.now())/3600000))
    :0;

  return overdue+p+s+due;
}

function techSortOrders(arr){
  return [...arr].sort((a,b)=>techOrderScore(b)-techOrderScore(a));
}

function techWoCard(w,active=false){
  const a=S.assets.find(x=>x.id===w.asset_id);
  const d=techDueInfo(w);

  return `<div class="techWoCard ${active?'techActive':''}" data-wo="${w.id}">
    <div class="techWoTop">
      <div>
        <div class="mut">OT #${e(w.wo_number)} · ${e(a?.code||'Sans machine')}</div>
        <div class="techWoTitle">${e(w.title)}</div>
      </div>
      ${pill(w.status)}
    </div>
    <div class="techWoMeta">
      <span>${e(techPriorityLabel(w.priority))}</span>
      <span>${e(w.type||'OT')}</span>
      ${w.category?`<span>${e(w.category)}</span>`:''}
    </div>
    <div class="techDue ${d.cls}">${e(d.text)}</div>
  </div>`;
}

function techHome(){
  if(isMgr()){
    S.page='dashboard';
    return render();
  }

  const all=techAssignedOrders();
  const open=all.filter(w=>!techClosed(w));
  const active=techSortOrders(
    open.filter(w=>['in_progress','on_hold'].includes(w.status))
  )[0]||null;
  const overdue=open.filter(
    w=>w.due_at&&new Date(w.due_at)<new Date()
  );
  const urgent=open.filter(w=>['urgent','high'].includes(w.priority));
  const queue=(S.syncQueue||[]).length;
  const next=techSortOrders(
    open.filter(w=>w.id!==active?.id)
  ).slice(0,5);
  const first=(S.p?.full_name||'').trim().split(/\s+/)[0]||'Technicien';

  shell(`
    <div class="card techHero">
      <div class="mut">Accueil terrain</div>
      <h1 class="title">Bonjour ${e(first)}</h1>
      <p class="sub">Voici ce qui demande ton attention maintenant.</p>
      <div class="techStatus">
        <span><span class="statusDot ${navigator.onLine?'':'off'}"></span>${navigator.onLine?'En ligne':'Hors ligne'}</span>
        <span>${queue?queue+' action(s) à synchroniser':'Synchronisation à jour'}</span>
      </div>
    </div>

    <div class="techActions">
      <button class="techAction" data-a="scan">
        <b>⌗</b>Scanner
        <small>Identifier une machine</small>
      </button>
      <button class="techAction" data-p="workorders">
        <b>☰</b>Mes OT
        <small>${open.length} ouvert(s)</small>
      </button>
      <button class="techAction" data-p="requests">
        <b>!</b>Demande
        <small>Signaler un problème</small>
      </button>
      <button class="techAction" data-p="syncconflicts">
        <b>↻</b>Sync
        <small>${queue?queue+' en attente':'À jour'}</small>
      </button>
    </div>

    <div class="techStats">
      <div class="techStat">
        <b>${open.length}</b>
        <span>OT ouverts</span>
      </div>
      <div class="techStat ${urgent.length?'warnStat':''}">
        <b>${urgent.length}</b>
        <span>Prioritaires</span>
      </div>
      <div class="techStat ${overdue.length?'hot':''}">
        <b>${overdue.length}</b>
        <span>En retard</span>
      </div>
    </div>

    ${active?`
      <div class="techSectionTitle">
        <h2>Intervention en cours</h2>
        <button class="btn" data-wo="${active.id}">Ouvrir</button>
      </div>
      ${techWoCard(active,true)}
    `:''}

    <div class="techSectionTitle">
      <h2>${active?'À faire ensuite':'Priorités terrain'}</h2>
      <button class="btn" data-p="workorders">Tout voir</button>
    </div>

    ${next.length
      ?next.map(w=>techWoCard(w)).join('')
      :'<div class="card techEmpty">Aucun OT ouvert qui t’est affecté.</div>'
    }
  `);
}

function techWorkOrdersView(){
  const all=techAssignedOrders();
  const open=techSortOrders(all.filter(w=>!techClosed(w)));
  const active=open.filter(w=>['in_progress','on_hold'].includes(w.status));
  const pending=open.filter(w=>!['in_progress','on_hold'].includes(w.status));
  const recent=[...all]
    .filter(techClosed)
    .sort((a,b)=>new Date(b.completed_at||b.updated_at||0)-new Date(a.completed_at||a.updated_at||0))
    .slice(0,5);

  shell(`
    <div class="row mobileStack">
      <div>
        <h1 class="title">Mes OT</h1>
        <p class="sub">${open.length} intervention(s) ouverte(s)</p>
      </div>
      <div class="stack">
        <button class="btn" data-p="techhome">Accueil</button>
        <button class="btn primary" data-a="scan">⌗ Scanner</button>
      </div>
    </div>

    ${active.length?`
      <div class="techSectionTitle"><h2>En cours</h2></div>
      ${active.map(w=>techWoCard(w,true)).join('')}
    `:''}

    <div class="techSectionTitle">
      <h2>À faire</h2>
      <span class="pill blue">${pending.length}</span>
    </div>

    ${pending.length
      ?pending.map(w=>techWoCard(w)).join('')
      :'<div class="card techEmpty">Aucun autre OT à traiter.</div>'
    }

    ${recent.length?`
      <div class="techSectionTitle"><h2>Récemment terminés</h2></div>
      <div class="card">
        ${recent.map(woRow).join('')}
      </div>
    `:''}
  `);
}
