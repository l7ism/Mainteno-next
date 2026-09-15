// Mainteno Next — Manager MFA Security V1.
// Mandatory TOTP enrollment/challenge for admin, manager and supervisor accounts.
(function(){
  if(window.__maintenoManagerMfaV1Loaded)return;
  window.__maintenoManagerMfaV1Loaded=true;

  const MANAGER_ROLES=new Set(['admin','manager','supervisor']);
  let gateRunning=false;

  function jwtPayload(token){
    try{
      let p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      p+='='.repeat((4-p.length%4)%4);
      return JSON.parse(decodeURIComponent(Array.from(atob(p)).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
    }catch{return {}}
  }

  function isManagerProfile(p){return !!p&&MANAGER_ROLES.has(p.role)}

  function syncSession(session){
    if(!session)return;
    save(session);
    S.s=session;
    S.u=session.user||S.u;
  }

  function makeClient(){
    if(!window.supabase?.createClient)throw Error('Module MFA Supabase indisponible');
    return window.supabase.createClient(SB,KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
  }

  async function clientForCurrentSession(){
    if(!S.s?.access_token||!S.s?.refresh_token)throw Error('Session MFA indisponible');
    const c=makeClient();
    const {data,error}=await c.auth.setSession({
      access_token:S.s.access_token,
      refresh_token:S.s.refresh_token
    });
    if(error)throw error;
    if(data?.session)syncSession(data.session);
    return c;
  }

  function mfaModal(title,bodyHtml){
    const wrap=document.createElement('div');
    wrap.className='scanWrap';
    wrap.style.zIndex='20000';
    wrap.innerHTML=`<div class="scanBox" style="max-width:480px">
      <h2 style="margin-top:0">${e(title)}</h2>
      ${bodyHtml}
      <div id="mfaError" class="notice bad" style="display:none;margin-top:10px"></div>
      <div class="mut" style="margin-top:12px">La double authentification est obligatoire pour les comptes Responsable.</div>
    </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function showError(wrap,msg){
    const x=wrap.querySelector('#mfaError');
    if(!x)return;
    x.textContent=msg||'Erreur MFA';
    x.style.display='block';
  }

  async function abandonMfa(wrap){
    try{wrap?.remove()}catch{}
    try{
      save(null);
      S.s=null;S.u=null;S.p=null;
      localStorage.removeItem('mainteno_snapshot');
    }catch{}
    location.reload();
  }

  function challengeScreen(c,factor){
    return new Promise((resolve,reject)=>{
      const wrap=mfaModal('Vérification en deux étapes',`
        <p>Entre le code à 6 chiffres de ton application d’authentification.</p>
        <div class="field"><label>Code de sécurité</label><input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></div>
        <div class="stack">
          <button class="btn primary" id="mfaVerify">Vérifier</button>
          <button class="btn" id="mfaLogout">Quitter</button>
        </div>`);
      const code=wrap.querySelector('#mfaCode');
      setTimeout(()=>code?.focus(),50);

      wrap.querySelector('#mfaLogout').onclick=()=>{abandonMfa(wrap);reject(Error('MFA annulée'))};
      wrap.querySelector('#mfaVerify').onclick=async()=>{
        const b=wrap.querySelector('#mfaVerify');
        try{
          b.disabled=true;
          const value=(code.value||'').trim();
          if(!/^\d{6,8}$/.test(value))throw Error('Entre un code valide.');
          const ch=await c.auth.mfa.challenge({factorId:factor.id});
          if(ch.error)throw ch.error;
          const vr=await c.auth.mfa.verify({factorId:factor.id,challengeId:ch.data.id,code:value});
          if(vr.error)throw vr.error;
          if(vr.data?.session)syncSession(vr.data.session);
          else{
            const gs=await c.auth.getSession();
            if(gs.data?.session)syncSession(gs.data.session);
          }
          const aal=jwtPayload(S.s?.access_token||'').aal;
          if(aal!=='aal2')throw Error('La session MFA n’a pas atteint le niveau AAL2.');
          wrap.remove();
          resolve(true);
        }catch(err){
          showError(wrap,err?.message||'Code incorrect');
          b.disabled=false;
          code.select();
        }
      };
      code.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();wrap.querySelector('#mfaVerify').click()}});
    });
  }

  async function enrollmentScreen(c){
    // Remove stale unverified TOTP enrollments when possible.
    const lf=await c.auth.mfa.listFactors();
    if(lf.error)throw lf.error;
    const stale=(lf.data?.all||[]).filter(f=>f.factor_type==='totp'&&f.status!=='verified');
    for(const f of stale){
      try{await c.auth.mfa.unenroll({factorId:f.id})}catch{}
    }

    const en=await c.auth.mfa.enroll({
      factorType:'totp',
      friendlyName:'Mainteno Responsable'
    });
    if(en.error)throw en.error;

    const factor=en.data;
    const qr=factor?.totp?.qr_code||'';
    const secret=factor?.totp?.secret||'';

    return new Promise((resolve,reject)=>{
      const wrap=mfaModal('Sécuriser le compte Responsable',`
        <p>Scanne ce QR code avec <b>Google Authenticator</b>, <b>Authy</b>, <b>1Password</b> ou une application TOTP compatible.</p>
        <div style="display:flex;justify-content:center;margin:14px 0">
          ${qr?`<img src="${e(qr)}" alt="QR MFA" style="width:220px;max-width:75%;background:white;padding:8px;border-radius:12px;border:1px solid #ddd">`:''}
        </div>
        ${secret?`<div class="field"><label>Clé manuelle de secours pour l’enrôlement</label><div style="font-family:monospace;word-break:break-all;padding:10px;border:1px solid var(--line);border-radius:8px">${e(secret)}</div></div>`:''}
        <div class="field"><label>Code généré par l’application</label><input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></div>
        <div class="stack">
          <button class="btn primary" id="mfaEnable">Activer la double authentification</button>
          <button class="btn" id="mfaLogout">Quitter</button>
        </div>`);
      const code=wrap.querySelector('#mfaCode');
      setTimeout(()=>code?.focus(),50);

      wrap.querySelector('#mfaLogout').onclick=()=>{abandonMfa(wrap);reject(Error('MFA annulée'))};
      wrap.querySelector('#mfaEnable').onclick=async()=>{
        const b=wrap.querySelector('#mfaEnable');
        try{
          b.disabled=true;
          const value=(code.value||'').trim();
          if(!/^\d{6,8}$/.test(value))throw Error('Entre le code affiché dans ton application Authenticator.');
          const ch=await c.auth.mfa.challenge({factorId:factor.id});
          if(ch.error)throw ch.error;
          const vr=await c.auth.mfa.verify({factorId:factor.id,challengeId:ch.data.id,code:value});
          if(vr.error)throw vr.error;
          if(vr.data?.session)syncSession(vr.data.session);
          else{
            const gs=await c.auth.getSession();
            if(gs.data?.session)syncSession(gs.data.session);
          }
          const aal=jwtPayload(S.s?.access_token||'').aal;
          if(aal!=='aal2')throw Error('Activation MFA incomplète.');
          wrap.remove();
          resolve(true);
        }catch(err){
          showError(wrap,err?.message||'Impossible d’activer la double authentification');
          b.disabled=false;
          code.select();
        }
      };
      code.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();wrap.querySelector('#mfaEnable').click()}});
    });
  }

  async function ensureManagerMfa(){
    if(!isManagerProfile(S.p))return true;
    if(gateRunning)return false;
    gateRunning=true;
    try{
      const c=await clientForCurrentSession();

      const currentAal=jwtPayload(S.s?.access_token||'').aal;
      if(currentAal==='aal2')return true;

      const lf=await c.auth.mfa.listFactors();
      if(lf.error)throw lf.error;
      const factors=(lf.data?.totp||lf.data?.all||[]).filter(f=>
        (f.factor_type==='totp'||f.type==='totp') && f.status==='verified'
      );

      if(factors.length){
        await challengeScreen(c,factors[0]);
      }else{
        await enrollmentScreen(c);
      }

      return jwtPayload(S.s?.access_token||'').aal==='aal2';
    }finally{
      gateRunning=false;
    }
  }

  // Replace the original login flow so manager MFA happens BEFORE loadAll/dashboard.
  const baseLogin=login;
  login=async function(email,password){
    let r=await fetch(SB+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    });
    let j=await r.json();
    if(!r.ok)throw Error(j.error_description||j.msg||j.message||'Connexion impossible');

    save(j);
    S.u=j.user;

    // Fetch only the current profile first; manager MFA is decided before loading sensitive manager data.
    const p=await sel('profiles','select=*&id=eq.'+S.u.id);
    S.p=p[0];
    if(!S.p?.active)throw Error('Compte désactivé');

    if(isManagerProfile(S.p)){
      const ok=await ensureManagerMfa();
      if(!ok)throw Error('Double authentification requise');
    }

    await loadAll();
  };

  // Existing logged-in manager sessions are gated too after deployment/reload.
  async function gateExistingManager(){
    if(gateRunning||!S?.u||!isManagerProfile(S.p))return;
    try{
      const ok=await ensureManagerMfa();
      if(ok){
        await loadAll();
        render();
        toast('Compte Responsable sécurisé par MFA');
      }
    }catch(err){
      toast(err?.message||'MFA requise',1);
    }
  }

  addEventListener('load',()=>setTimeout(gateExistingManager,1200),{once:true});
  addEventListener('pageshow',()=>setTimeout(gateExistingManager,500));
})();
