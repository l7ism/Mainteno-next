// Mainteno Next — Technician quick intervention V1.
(function(){
  if(window.__maintenoQuickInterventionV1Loaded)return;
  window.__maintenoQuickInterventionV1Loaded=true;

  function isApprovedTechnician(){
    return S?.p?.role==='technician' && S.p.active!==false && (S.p.approval_status||'approved')==='approved';
  }

  function activeAssetsForQuick(){
    return (S.assets||[])
      .filter(a=>a.active!==false)
      .sort((a,b)=>String(a.code||a.name||'').localeCompare(String(b.code||b.name||''),'fr'));
  }

  function selectedAssetId(){
    const a=(S.assets||[]).find(x=>x.id===S.selected && x.active!==false);
    return a?.id||'';
  }

  function openQuickIntervention(prefillAssetId=''){
    if(!isApprovedTechnician()){
      toast('Cette action est réservée aux techniciens actifs et approuvés.',1);
      return;
    }
    if(!navigator.onLine){
      toast('Connexion requise pour créer un nouvel OT. Les OT existants restent utilisables hors ligne.',1);
      return;
    }

    const assets=activeAssetsForQuick();
    if(!assets.length){
      toast('Aucune machine active disponible.',1);
      return;
    }

    const preferred=prefillAssetId||selectedAssetId();
    const wrap=document.createElement('div');
    wrap.className='scanWrap';
    wrap.style.zIndex='20000';
    wrap.innerHTML=`<div class="scanBox" style="max-width:620px">
      <div class="row mobileStack">
        <div>
          <h2 style="margin:0">Nouvelle intervention</h2>
          <div class="mut">L’OT sera créé, affecté à toi et démarré immédiatement.</div>
        </div>
        <button type="button" class="btn" id="quickInterventionClose">Fermer</button>
      </div>
      <div class="notice" style="margin:12px 0">Le responsable sera notifié automatiquement. La validation finale de l’OT reste obligatoire.</div>
      <form id="quickInterventionForm">
        <div class="field">
          <label>Machine *</label>
          <select name="asset_id" required>
            <option value="">Choisir une machine</option>
            ${assets.map(a=>`<option value="${a.id}" ${a.id===preferred?'selected':''}>${e(a.code||'')} · ${e(a.name||'')}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Problème / intervention *</label>
          <input name="title" required maxlength="160" placeholder="Ex : fuite sur vérin porte">
        </div>
        <div class="field">
          <label>Description</label>
          <textarea name="description" maxlength="4000" placeholder="Décris rapidement ce que tu as constaté"></textarea>
        </div>
        <div class="grid2">
          <div class="field">
            <label>Priorité</label>
            <select name="priority">
              <option value="low">Basse</option>
              <option value="medium" selected>Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div class="field">
            <label>Catégorie</label>
            <input name="category" maxlength="100" placeholder="Mécanique, électrique…">
          </div>
        </div>
        <button class="btn primary" id="quickInterventionSubmit" style="width:100%">▶ Créer et commencer</button>
      </form>
    </div>`;
    document.body.appendChild(wrap);

    const form=wrap.querySelector('#quickInterventionForm');
    const close=()=>wrap.remove();
    wrap.querySelector('#quickInterventionClose').onclick=close;
    wrap.addEventListener('click',ev=>{if(ev.target===wrap)close()});

    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const b=wrap.querySelector('#quickInterventionSubmit');
      const fd=new FormData(form);
      const assetId=String(fd.get('asset_id')||'');
      const title=String(fd.get('title')||'').trim();
      const description=String(fd.get('description')||'').trim();
      const priority=String(fd.get('priority')||'medium');
      const category=String(fd.get('category')||'').trim();
      if(!assetId||!title)return;

      try{
        b.disabled=true;
        b.textContent='Création et démarrage…';
        let w=await rpc('nx_technician_create_and_start_work_order',{
          p_asset_id:assetId,
          p_title:title,
          p_description:description||null,
          p_priority:priority,
          p_category:category||null
        });
        if(Array.isArray(w))w=w[0];
        if(!w?.id)throw Error('OT créé mais réponse invalide');

        close();
        await loadAll();
        S.selected=w.id;
        S.page='woDetail';
        render();
        toast(`OT #${w.wo_number} créé et démarré`);
      }catch(err){
        b.disabled=false;
        b.textContent='▶ Créer et commencer';
        toast(err?.message||'Impossible de créer l’intervention',1);
      }
    });

    setTimeout(()=>wrap.querySelector('input[name="title"]')?.focus(),50);
  }

  window.openQuickIntervention=openQuickIntervention;

  function enhanceTechHome(){
    if(!isApprovedTechnician())return;
    const btn=document.querySelector('.techActions button[data-p="requests"]');
    if(!btn)return;
    delete btn.dataset.p;
    btn.dataset.quickIntervention='1';
    btn.innerHTML='<b>+</b>Intervenir<small>Créer et commencer</small>';
  }

  function enhanceTechWorkOrders(){
    if(!isApprovedTechnician())return;
    const content=document.querySelector('.content');
    if(!content)return;
    const header=content.querySelector('.row.mobileStack .stack');
    if(!header||header.querySelector('[data-quick-intervention]'))return;
    const b=document.createElement('button');
    b.className='btn primary';
    b.type='button';
    b.dataset.quickIntervention='1';
    b.textContent='+ Nouvelle intervention';
    header.insertBefore(b,header.firstChild);
  }

  function enhanceTechRequests(){
    if(!isApprovedTechnician()||S.page!=='requests')return;
    const content=document.querySelector('.content');
    if(!content)return;
    const header=content.querySelector('.row.mobileStack');
    const stack=header?.querySelector('.stack');
    if(stack&&!stack.querySelector('[data-quick-intervention]')){
      const b=document.createElement('button');
      b.className='btn primary';
      b.type='button';
      b.dataset.quickIntervention='1';
      b.textContent='▶ Créer et commencer';
      stack.insertBefore(b,stack.firstChild);
    }
    const sub=header?.querySelector('.sub');
    if(sub)sub.textContent='Demande = validation Responsable · Intervention directe = démarrage immédiat';
  }

  if(typeof techHome==='function'){
    const baseTechHome=techHome;
    techHome=function(){
      const r=baseTechHome.apply(this,arguments);
      setTimeout(enhanceTechHome,0);
      return r;
    };
  }

  if(typeof techWorkOrdersView==='function'){
    const baseTechWorkOrdersView=techWorkOrdersView;
    techWorkOrdersView=function(){
      const r=baseTechWorkOrdersView.apply(this,arguments);
      setTimeout(enhanceTechWorkOrders,0);
      return r;
    };
  }

  if(typeof requests==='function'){
    const baseRequests=requests;
    requests=function(){
      const r=baseRequests.apply(this,arguments);
      if(!isMgr())setTimeout(enhanceTechRequests,0);
      return r;
    };
  }

  document.addEventListener('click',ev=>{
    const b=ev.target.closest?.('[data-quick-intervention]');
    if(!b)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    openQuickIntervention();
  },true);
})();
