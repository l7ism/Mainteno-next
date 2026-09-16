// Mainteno Next — Technician account approval workflow V1.
(function(){
  if(window.__maintenoAccountApprovalV1Loaded)return;
  window.__maintenoAccountApprovalV1Loaded=true;

  let approvals=[];
  let approvalsLoading=false;

  function fmtDate(v){
    if(!v)return '—';
    try{return new Date(v).toLocaleString('fr-FR')}catch{return String(v)}
  }

  function statusHtml(a){
    if(a.approval_status==='rejected'){
      return '<span class="pill red">REFUSÉ</span>';
    }
    if(!a.email_confirmed){
      return '<span class="pill orange">E-MAIL NON CONFIRMÉ</span>';
    }
    return '<span class="pill blue">À APPROUVER</span>';
  }

  function approvalActions(a){
    if(a.approval_status==='rejected'){
      return `<div class="stack">
        ${!a.email_confirmed?`<button class="btn" data-account-resend="${a.user_id}" data-email="${e(a.email)}">Renvoyer l’e-mail</button>`:''}
        <button class="btn primary" data-account-approve="${a.user_id}" ${a.email_confirmed?'':'disabled'}>Approuver</button>
      </div>`;
    }
    return `<div class="stack">
      ${!a.email_confirmed?`<button class="btn" data-account-resend="${a.user_id}" data-email="${e(a.email)}">Renvoyer l’e-mail</button>`:''}
      <button class="btn primary" data-account-approve="${a.user_id}" ${a.email_confirmed?'':'disabled'}>Approuver</button>
      <button class="btn danger" data-account-reject="${a.user_id}">Refuser</button>
    </div>`;
  }

  function approvalRows(){
    if(approvalsLoading)return '<div class="mut">Chargement des comptes…</div>';
    if(!approvals.length)return '<div class="notice good">Aucun compte technicien en attente.</div>';

    return approvals.map(a=>`
      <div class="listitem">
        <div class="row mobileStack">
          <div style="min-width:0">
            <div class="row" style="justify-content:flex-start;gap:8px;flex-wrap:wrap">
              <b>${e(a.full_name||'Technicien')}</b>
              ${statusHtml(a)}
            </div>
            <div class="mut">${e(a.email||'')}</div>
            <div class="mut">
              Inscription : ${e(fmtDate(a.created_at))}
              ${a.confirmation_sent_at?` · e-mail envoyé : ${e(fmtDate(a.confirmation_sent_at))}`:''}
            </div>
            ${a.approval_status==='rejected'&&a.rejection_reason?`<div class="notice bad" style="margin-top:8px">Motif : ${e(a.rejection_reason)}</div>`:''}
            ${!a.email_confirmed?'<div class="notice" style="margin-top:8px">Le responsable ne peut approuver ce compte qu’après confirmation de l’adresse e-mail.</div>':''}
          </div>
          ${approvalActions(a)}
        </div>
      </div>
    `).join('');
  }

  function renderApprovalCard(){
    const host=document.getElementById('accountApprovalCard');
    if(!host)return;
    const pending=approvals.filter(x=>x.approval_status==='pending').length;
    host.innerHTML=`
      <div class="row mobileStack">
        <div>
          <h3 style="margin:0">Comptes techniciens</h3>
          <div class="mut">${pending} compte(s) en attente · validation Responsable obligatoire</div>
        </div>
        <button class="btn" data-account-refresh>↻ Actualiser</button>
      </div>
      <div style="margin-top:12px">${approvalRows()}</div>`;
  }

  function mountApprovalCard(){
    if(!isMgr()||S.page!=='organization')return;
    const content=document.querySelector('.content');
    if(!content)return;

    let card=document.getElementById('accountApprovalCard');
    if(!card){
      card=document.createElement('div');
      card.id='accountApprovalCard';
      card.className='card';
      card.style.marginTop='12px';
      const firstGrid=content.querySelector('.grid2');
      if(firstGrid)content.insertBefore(card,firstGrid);
      else content.appendChild(card);
    }
    renderApprovalCard();
    loadApprovals();
  }

  async function loadApprovals(){
    if(!isMgr()||approvalsLoading)return;
    approvalsLoading=true;
    renderApprovalCard();
    try{
      const r=await rpc('nx_pending_account_approvals',{});
      approvals=Array.isArray(r)?r:[];
    }catch(err){
      const host=document.getElementById('accountApprovalCard');
      if(host)host.innerHTML=`<h3>Comptes techniciens</h3><div class="notice bad">${e(err?.message||'Impossible de charger les comptes')}</div>`;
      return;
    }finally{
      approvalsLoading=false;
    }
    renderApprovalCard();
  }

  async function approveAccount(id){
    const a=approvals.find(x=>x.user_id===id);
    if(!a)return;
    if(!a.email_confirmed){
      toast('L’e-mail doit être confirmé avant approbation.',1);
      return;
    }
    if(!confirm(`Approuver le compte de ${a.full_name} ?`))return;

    await rpc('nx_approve_technician_account',{p_user_id:id});
    toast('Compte technicien approuvé');
    await loadAll();
    await loadApprovals();
    if(S.page==='organization')organization();
  }

  async function rejectAccount(id){
    const a=approvals.find(x=>x.user_id===id);
    if(!a)return;
    const reason=prompt(`Motif du refus pour ${a.full_name} :`,'') ?? null;
    if(reason===null)return;
    await rpc('nx_reject_technician_account',{p_user_id:id,p_reason:reason||null});
    toast('Compte technicien refusé');
    await loadApprovals();
  }

  async function resendConfirmation(email){
    if(!email)throw Error('Adresse e-mail manquante');
    if(!window.supabase?.createClient)throw Error('Service Auth indisponible');

    const c=window.supabase.createClient(SB,KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });

    const {error}=await c.auth.resend({type:'signup',email});
    if(error)throw error;
    toast('E-mail de confirmation renvoyé');
    setTimeout(loadApprovals,800);
  }

  // Extend the existing Organisation screen without replacing its business logic.
  if(typeof organization==='function'){
    const baseOrganization=organization;
    organization=function(){
      const r=baseOrganization.apply(this,arguments);
      if(isMgr())setTimeout(mountApprovalCard,0);
      return r;
    };
  }

  // Improve login message for pending/rejected accounts.
  if(typeof login==='function'){
    const baseLogin=login;
    login=async function(email,password){
      try{
        return await baseLogin(email,password);
      }catch(originalErr){
        let friendly=null;
        if(S.s?.access_token){
          try{
            const rows=await rpc('nx_my_account_state',{});
            const st=Array.isArray(rows)?rows[0]:rows;
            if(st && !st.active){
              if(st.approval_status==='pending'){
                friendly=st.email_confirmed
                  ? 'Compte en attente d’approbation par le responsable.'
                  : 'Confirme d’abord ton e-mail. Le responsable pourra ensuite approuver ton compte.';
              }else if(st.approval_status==='rejected'){
                friendly='Compte refusé par le responsable.';
              }else{
                friendly='Compte désactivé.';
              }
            }
          }catch{}
        }

        if(friendly){
          try{
            save(null);
            localStorage.removeItem('mainteno_snapshot');
            S.s=null;S.u=null;S.p=null;
          }catch{}
          throw Error(friendly);
        }
        throw originalErr;
      }
    };
  }

  document.addEventListener('click',async ev=>{
    const refresh=ev.target.closest?.('[data-account-refresh]');
    const approve=ev.target.closest?.('[data-account-approve]');
    const reject=ev.target.closest?.('[data-account-reject]');
    const resend=ev.target.closest?.('[data-account-resend]');
    if(!refresh&&!approve&&!reject&&!resend)return;

    ev.preventDefault();
    ev.stopPropagation();

    try{
      if(refresh)return await loadApprovals();
      if(approve)return await approveAccount(approve.dataset.accountApprove);
      if(reject)return await rejectAccount(reject.dataset.accountReject);
      if(resend)return await resendConfirmation(resend.dataset.email);
    }catch(err){
      toast(err?.message||'Erreur compte technicien',1);
    }
  },true);

  // If Organisation is already open after a hot reload.
  setTimeout(()=>{if(S?.u&&isMgr()&&S.page==='organization')mountApprovalCard()},1200);
})();
