// Mainteno Next — manager gallery for photos/signatures on completed work orders.
(function(){
  if(window.__maintenoClosedPhotosLoaded)return;
  window.__maintenoClosedPhotosLoaded=true;

  const baseWoDetail=woDetail;

  function closedMediaStyles(){
    if(document.getElementById('closedMediaStyles'))return;
    const s=document.createElement('style');
    s.id='closedMediaStyles';
    s.textContent=`
      .closedMediaSections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}
      .closedMediaGroup h4{margin:0 0 8px}
      .closedMediaGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
      .closedMediaItem{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
      .closedMediaThumb{display:block;width:100%;aspect-ratio:4/3;border:0;padding:0;background:#f3f4f6;cursor:pointer;overflow:hidden}
      .closedMediaThumb img{width:100%;height:100%;object-fit:cover;display:block}
      .closedMediaLoading{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:120px;color:var(--mut);font-size:11px;text-align:center;padding:12px}
      .closedMediaMeta{padding:8px;font-size:10px;color:var(--mut);line-height:1.35}
      .closedMediaMeta b{display:block;color:var(--text);font-size:11px;margin-bottom:2px}
      .closedMediaEmpty{color:var(--mut);font-size:11px;padding:8px 0}
      .closedMediaModal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:20px}
      .closedMediaModalBox{max-width:min(1100px,96vw);max-height:94vh;display:flex;flex-direction:column;gap:10px;align-items:center}
      .closedMediaModal img{max-width:100%;max-height:82vh;object-fit:contain;border-radius:10px;background:#fff}
      .closedMediaModalBar{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;color:white}
      .closedMediaModal .btn{background:white;color:#111827}
      @media(max-width:760px){.closedMediaSections{grid-template-columns:1fr}.closedMediaGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(s);
  }

  function mediaLabel(kind){
    return ({before:'Avant',after:'Après',signature:'Signature'})[kind]||'Fichier';
  }

  function mediaUploader(att){
    return S.profiles.find(p=>p.id===att.uploaded_by)?.full_name||'Technicien';
  }

  function mediaDate(att){
    if(!att.created_at)return 'Date inconnue';
    try{return new Date(att.created_at).toLocaleString('fr-FR')}catch{return 'Date inconnue'}
  }

  function encodeStoragePath(path){
    return String(path||'').split('/').map(encodeURIComponent).join('/');
  }

  async function signedMediaUrl(att){
    const path=encodeStoragePath(att.storage_path);
    const r=await fetch(`${SB}/storage/v1/object/sign/mainteno-next-media/${path}`,{
      method:'POST',
      headers:{
        apikey:KEY,
        Authorization:'Bearer '+S.s.access_token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({expiresIn:3600})
    });
    let j=null;
    try{j=await r.json()}catch{}
    if(!r.ok)throw Error(j?.message||j?.error||'Impossible de charger la photo');
    let u=j?.signedURL||j?.signedUrl||j?.signed_url;
    if(!u)throw Error('URL photo indisponible');
    return /^https?:\/\//i.test(u)?u:SB+(u.startsWith('/')?'':'/')+u;
  }

  function mediaItems(atts){
    return atts.map(att=>`<div class="closedMediaItem" data-closed-media-item="${att.id}">
      <button type="button" class="closedMediaThumb" data-closed-media-open="${att.id}" disabled>
        <span class="closedMediaLoading">Chargement…</span>
      </button>
      <div class="closedMediaMeta"><b>${e(mediaLabel(att.kind))}</b>${e(mediaUploader(att))}<br>${e(mediaDate(att))}</div>
    </div>`).join('');
  }

  function group(title,atts){
    return `<section class="closedMediaGroup"><h4>${e(title)} <span class="mut">(${atts.length})</span></h4>${atts.length?`<div class="closedMediaGrid">${mediaItems(atts)}</div>`:'<div class="closedMediaEmpty">Aucun fichier.</div>'}</section>`;
  }

  function closedMediaCard(atts){
    const before=atts.filter(a=>a.kind==='before'&&String(a.mime_type||'').startsWith('image/'));
    const after=atts.filter(a=>a.kind==='after'&&String(a.mime_type||'').startsWith('image/'));
    const signatures=atts.filter(a=>a.kind==='signature'&&String(a.mime_type||'').startsWith('image/'));
    if(!before.length&&!after.length&&!signatures.length)return '';
    return `<div class="card" id="closedWoMedia"><div class="row mobileStack"><div><h3 style="margin:0">Photos de l’intervention</h3><div class="mut">Photos conservées après finalisation de l’OT.</div></div><span class="pill blue">${before.length+after.length+signatures.length} fichier(s)</span></div><div class="closedMediaSections">${group('Avant',before)}${group('Après',after)}${signatures.length?group('Signature',signatures):''}</div></div>`;
  }

  async function hydrateClosedMedia(atts){
    for(const att of atts){
      const item=document.querySelector(`[data-closed-media-item="${att.id}"]`);
      if(!item)continue;
      const btn=item.querySelector('[data-closed-media-open]');
      try{
        const url=await signedMediaUrl(att);
        if(!document.body.contains(item))return;
        btn.innerHTML=`<img src="${e(url)}" alt="${e(mediaLabel(att.kind))}" loading="lazy">`;
        btn.disabled=false;
        btn.dataset.mediaUrl=url;
        btn.dataset.mediaTitle=mediaLabel(att.kind)+' · '+mediaDate(att);
      }catch(err){
        btn.innerHTML=`<span class="closedMediaLoading">${e(err.message||'Photo indisponible')}</span>`;
      }
    }
  }

  function openMedia(url,title){
    if(!url)return;
    const wrap=document.createElement('div');
    wrap.className='closedMediaModal';
    wrap.innerHTML=`<div class="closedMediaModalBox"><div class="closedMediaModalBar"><b>${e(title||'Photo')}</b><button type="button" class="btn" data-close-media>Fermer</button></div><img src="${e(url)}" alt="${e(title||'Photo')}"></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',ev=>{if(ev.target===wrap||ev.target.closest('[data-close-media]'))wrap.remove()});
  }

  woDetail=function(){
    baseWoDetail();
    const w=S.wo.find(x=>x.id===S.selected);
    if(!w||!isMgr()||!['completed','validated'].includes(w.status))return;
    const atts=S.atts.filter(x=>x.entity_type==='work_order'&&x.entity_id===w.id&&['before','after','signature'].includes(x.kind));
    const card=closedMediaCard(atts);
    if(!card)return;
    closedMediaStyles();
    const content=A.querySelector('.content');
    if(!content)return;
    content.insertAdjacentHTML('beforeend',card);
    hydrateClosedMedia(atts);
  };

  document.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-closed-media-open]');
    if(!b||b.disabled)return;
    openMedia(b.dataset.mediaUrl,b.dataset.mediaTitle);
  });
})();
