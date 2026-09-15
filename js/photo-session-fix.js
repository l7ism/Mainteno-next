// Mainteno Next — mobile photo/session reliability fix only.
(function(){
  if(window.__maintenoPhotoSessionFixLoaded)return;
  window.__maintenoPhotoSessionFixLoaded=true;

  const RESUME_KEY='mainteno_photo_resume';

  function msg(err){return String(err?.message||err||'')}
  function authExpired(err){return /session expir|refresh.?token|invalid.?token|jwt.*expir|token.*expir|not authenticated/i.test(msg(err))}
  function storedSession(){try{return JSON.parse(localStorage.getItem('mainteno_next_session')||'null')}catch{return null}}

  // Do not destroy a valid technician session because Android/iOS briefly lost network
  // while returning from the camera. Real expired/invalid sessions still propagate.
  const baseApi=api;
  api=async function(p,o={},retry=1){
    try{return await baseApi(p,o,retry)}
    catch(err){
      if(p==='/auth/v1/user'&&!authExpired(err)){
        const st=storedSession();
        if(st?.user)return st.user;
      }
      throw err;
    }
  };

  const baseLoadAll=loadAll;
  loadAll=async function(){
    try{return await baseLoadAll()}
    catch(err){
      if(authExpired(err))throw err;
      const st=storedSession();
      if(st?.user){
        restoreSnapshot();
        S.u=S.u||st.user;
        console.warn('Mainteno: temporary refresh failure, cached technician session kept.',err);
        return;
      }
      throw err;
    }
  };

  function saveResume(kind,woId){
    try{localStorage.setItem(RESUME_KEY,JSON.stringify({kind,woId,at:Date.now()}))}catch{}
  }
  function clearResume(){try{localStorage.removeItem(RESUME_KEY)}catch{}}
  function readResume(){try{return JSON.parse(localStorage.getItem(RESUME_KEY)||'null')}catch{return null}}

  // If the OS killed/reloaded the PWA while the native camera was open,
  // return the technician to the same work order instead of the home/login flow.
  let resumeAttempts=0;
  function resumeWorkOrder(){
    const x=readResume();
    if(!x||!x.woId||Date.now()-Number(x.at||0)>15*60*1000){if(x)clearResume();return}
    if(S.u&&Array.isArray(S.wo)&&S.wo.some(w=>w.id===x.woId)){
      S.selected=x.woId;
      S.page='woDetail';
      render();
      return;
    }
    if(++resumeAttempts<20)setTimeout(resumeWorkOrder,300);
  }
  setTimeout(resumeWorkOrder,300);
  addEventListener('pageshow',()=>{resumeAttempts=0;setTimeout(resumeWorkOrder,250)});

  async function queuePhoto(woId,kind,file,reason){
    const ext=(file.name?.split('.').pop()||((file.type||'').includes('png')?'png':'jpg')).toLowerCase();
    await enqueue('photo_upload',woId,{kind,mime:file.type||'image/jpeg',caption:kind==='before'?'Avant intervention':'Après intervention',ext},file);
    clearResume();
    toast(reason||'Photo conservée localement — synchronisation en attente');
  }

  async function postStorage(path,file){
    return fetch(SB+'/storage/v1/object/mainteno-next-media/'+path,{
      method:'POST',
      headers:{
        apikey:KEY,
        Authorization:'Bearer '+S.s.access_token,
        'Content-Type':file.type||'image/jpeg',
        'x-upsert':'false'
      },
      body:file
    });
  }

  async function safePhotoUpload(kind,file,woId){
    if(!file)return;
    if(!navigator.onLine){await queuePhoto(woId,kind,file,'Photo gardée hors ligne');return}

    const actionId=crypto.randomUUID();
    const ext=(file.name?.split('.').pop()||((file.type||'').includes('png')?'png':'jpg')).toLowerCase();
    const path=`work-orders/${woId}/${kind}-${Date.now()}-${actionId}.${ext}`;
    let rr;

    try{
      rr=await postStorage(path,file);
      if(rr.status===401&&S.s?.refresh_token){
        try{await rf();rr=await postStorage(path,file)}
        catch(err){await queuePhoto(woId,kind,file,'Session réseau renouvelée plus tard — photo conservée localement');return}
      }
    }catch(err){
      await queuePhoto(woId,kind,file,'Réseau interrompu — photo conservée localement');
      return;
    }

    if(!rr.ok){
      if([408,429].includes(rr.status)||rr.status>=500){
        await queuePhoto(woId,kind,file,'Upload temporairement indisponible — photo conservée localement');
        return;
      }
      throw Error('Échec upload photo ('+rr.status+')');
    }

    const payload={storage_path:path,kind,mime_type:file.type||'image/jpeg',caption:kind==='before'?'Avant intervention':'Après intervention'};
    const eventAt=new Date().toISOString();
    try{
      const sr=await rpc('nx_sync_mobile_action',{p_action_id:actionId,p_action_type:'photo_attachment',p_entity_id:woId,p_payload:payload,p_event_at:eventAt});
      if(sr?.status==='failed')throw Error(sr.error||'Enregistrement photo refusé');
    }catch(err){
      // File is already safely stored; queue only the metadata registration.
      await idbPut('queue',{id:actionId,type:'photo_attachment',entity:woId,payload,at:eventAt,status:'pending'});
      await showSync();
      clearResume();
      toast('Photo envoyée — enregistrement Mainteno en attente');
      return;
    }

    clearResume();
    await loadAll();
    S.selected=woId;
    S.page='woDetail';
    render();
    toast('Photo ajoutée');
  }

  function cameraStyles(){
    if(document.getElementById('maintenoPhotoCameraStyles'))return;
    const s=document.createElement('style');
    s.id='maintenoPhotoCameraStyles';
    s.textContent=`
      .mnCamWrap{position:fixed;inset:0;z-index:10050;background:#000;display:flex;align-items:center;justify-content:center}
      .mnCamBox{width:min(760px,100vw);height:100%;max-height:100vh;display:flex;flex-direction:column;background:#050505;color:#fff}
      .mnCamHead{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;gap:10px}
      .mnCamView{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000}
      .mnCamView video,.mnCamView img{width:100%;height:100%;object-fit:contain;background:#000}
      .mnCamActions{display:flex;gap:10px;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#0b0b0b}
      .mnCamActions .btn{flex:1;min-height:48px}
      .mnCamShutter{font-size:18px;font-weight:700}
    `;
    document.head.appendChild(s);
  }

  function fallbackPicker(kind,woId){
    const input=document.getElementById(kind==='before'?'beforeFile':'afterFile');
    if(!input)throw Error('Sélecteur photo indisponible');
    saveResume(kind,woId);
    input.value='';
    input.onchange=async()=>{
      const f=input.files?.[0];
      if(!f){clearResume();return}
      try{await safePhotoUpload(kind,f,woId)}catch(err){clearResume();toast(err.message||'Erreur photo',1)}
    };
    input.click();
  }

  async function inAppCamera(kind,woId){
    cameraStyles();
    saveResume(kind,woId);
    const wrap=document.createElement('div');
    wrap.className='mnCamWrap';
    wrap.innerHTML=`<div class="mnCamBox">
      <div class="mnCamHead"><b>${kind==='before'?'Photo avant intervention':'Photo après intervention'}</b><button type="button" class="btn" data-mncam-cancel>Fermer</button></div>
      <div class="mnCamView"><video playsinline autoplay muted></video></div>
      <div class="mnCamActions"><button type="button" class="btn primary mnCamShutter" data-mncam-shot>📷 Prendre la photo</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const video=wrap.querySelector('video'),view=wrap.querySelector('.mnCamView'),actions=wrap.querySelector('.mnCamActions');
    let stream=null,blob=null,previewUrl=null;

    const stop=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}};
    const close=(keepResume=false)=>{stop();if(previewUrl)URL.revokeObjectURL(previewUrl);wrap.remove();if(!keepResume)clearResume()};
    wrap.querySelector('[data-mncam-cancel]').onclick=()=>close(false);

    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
      video.srcObject=stream;
      await video.play().catch(()=>{});
    }catch(err){
      close(true);
      return fallbackPicker(kind,woId);
    }

    wrap.querySelector('[data-mncam-shot]').onclick=async()=>{
      try{
        const vw=video.videoWidth||1280,vh=video.videoHeight||720,max=1920,scale=Math.min(1,max/Math.max(vw,vh));
        const c=document.createElement('canvas');c.width=Math.max(1,Math.round(vw*scale));c.height=Math.max(1,Math.round(vh*scale));
        c.getContext('2d').drawImage(video,0,0,c.width,c.height);
        blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('Capture impossible')),'image/jpeg',0.88));
        stop();
        previewUrl=URL.createObjectURL(blob);
        view.innerHTML=`<img src="${previewUrl}" alt="Aperçu photo">`;
        actions.innerHTML='<button type="button" class="btn" data-mncam-retake>Reprendre</button><button type="button" class="btn primary" data-mncam-use>✓ Valider la photo</button>';
        actions.querySelector('[data-mncam-retake]').onclick=async()=>{
          if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}
          wrap.remove();
          try{await inAppCamera(kind,woId)}catch(e){clearResume();toast(e.message||'Erreur caméra',1)}
        };
        actions.querySelector('[data-mncam-use]').onclick=async ev=>{
          const b=ev.currentTarget;b.disabled=true;b.textContent='Envoi…';
          try{
            const f=new File([blob],`${kind}-${Date.now()}.jpg`,{type:'image/jpeg'});
            close(true);
            await safePhotoUpload(kind,f,woId);
          }catch(err){clearResume();toast(err.message||'Erreur photo',1)}
        };
      }catch(err){toast(err.message||'Capture impossible',1)}
    };
  }

  // Override only the Before/After work-order photo action.
  photoAction=async function(kind){
    const woId=S.selected;
    if(!woId)return;
    try{
      if(window.isSecureContext&&navigator.mediaDevices?.getUserMedia)return await inAppCamera(kind,woId);
      return fallbackPicker(kind,woId);
    }catch(err){
      clearResume();
      toast(err.message||'Erreur caméra',1);
    }
  };
})();
