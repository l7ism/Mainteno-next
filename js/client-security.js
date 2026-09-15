// Mainteno Next — client-side security hardening V1.
// Secure logout: never discard unsynced work, then purge sensitive local caches.
(function(){
  if(window.__maintenoClientSecurityV1Loaded)return;
  window.__maintenoClientSecurityV1Loaded=true;

  function sensitiveLocalKeys(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k)continue;
      if(
        k==='mainteno_next_session' ||
        k==='mainteno_snapshot' ||
        k==='mainteno_photo_resume' ||
        k.startsWith('draft_')
      ) keys.push(k);
    }
    return keys;
  }

  function clearSensitiveLocalStorage(){
    sensitiveLocalKeys().forEach(k=>localStorage.removeItem(k));
    try{sessionStorage.removeItem('mainteno_next_session')}catch{}
    try{sessionStorage.removeItem('mainteno_snapshot')}catch{}
  }

  async function queueItems(){
    if(typeof idbAll!=='function')return [];
    return await idbAll('queue').catch(()=>[]);
  }

  async function clearOfflineStores(){
    if(typeof openDB!=='function')return;
    const d=await openDB().catch(()=>null);
    if(!d)return;
    await new Promise((resolve,reject)=>{
      const names=['queue','files'].filter(n=>d.objectStoreNames.contains(n));
      if(!names.length)return resolve();
      const tx=d.transaction(names,'readwrite');
      names.forEach(n=>tx.objectStore(n).clear());
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    }).catch(()=>{});
  }

  async function secureLogout(){
    let q=await queueItems();

    if(q.length){
      if(!navigator.onLine){
        toast(`Impossible de quitter : ${q.length} action(s) non synchronisée(s). Reconnecte Internet puis synchronise.`,1);
        return;
      }

      toast(`Synchronisation de ${q.length} action(s) avant déconnexion…`);
      try{
        if(typeof syncQueue==='function')await syncQueue();
      }catch(err){
        toast('Synchronisation impossible : '+(err?.message||'erreur inconnue'),1);
        return;
      }

      q=await queueItems();
      if(q.length){
        const conflicts=q.filter(x=>x.status==='conflict').length;
        toast(
          conflicts
            ? `Déconnexion bloquée : ${conflicts} conflit(s) doivent être résolus.`
            : `Déconnexion bloquée : ${q.length} action(s) restent à synchroniser.`,
          1
        );
        return;
      }
    }

    clearSensitiveLocalStorage();
    await clearOfflineStores();

    try{
      if(typeof save==='function')save(null);
      if(typeof S!=='undefined' && S){
        S.s=null;
        S.u=null;
        S.p=null;
      }
    }catch{}

    // Reload removes sensitive in-memory state too.
    location.reload();
  }

  document.addEventListener('click',ev=>{
    const b=ev.target.closest?.('[data-a="logout"]');
    if(!b)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    secureLogout().catch(err=>toast(err?.message||'Erreur de déconnexion',1));
  },true);
})();
