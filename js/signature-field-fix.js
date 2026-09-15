// Mainteno Next — required OT signature field fix V3.
// Technician-side, isolated DOM patch. No backend or work-order workflow changes.
(function(){
  if(window.__maintenoSignatureFieldFixV3Loaded)return;
  window.__maintenoSignatureFieldFixV3Loaded=true;

  function currentWorkOrder(){
    try{
      if(typeof S==='undefined' || !S || S.page!=='woDetail' || !S.selected || !Array.isArray(S.wo))return null;
      return S.wo.find(x=>x.id===S.selected)||null;
    }catch{return null}
  }

  function isTechnicianView(){
    try{
      if(typeof isMgr==='function' && isMgr())return false;
      return !!S?.u;
    }catch{return false}
  }

  function signatureCount(woId){
    try{
      return (S.atts||[]).filter(x=>
        x.entity_type==='work_order' &&
        x.entity_id===woId &&
        x.kind==='signature'
      ).length;
    }catch{return 0}
  }

  function buildSignatureBlock(w){
    const count=signatureCount(w.id);
    const block=document.createElement('div');
    block.className='card';
    block.id='woRequiredSignature';
    block.style.marginTop='12px';
    block.innerHTML=`<div class="row mobileStack">
      <div>
        <h3 style="margin:0 0 4px">Signature obligatoire</h3>
        <div class="mut">${count?`${count} signature(s) enregistrée(s)`:'Aucune signature enregistrée'}</div>
      </div>
      <button type="button" class="btn primary" data-a="wosignature">✍ ${count?'Refaire la signature':'Signer'}</button>
    </div>`;
    return block;
  }

  function injectSignatureField(){
    const old=document.getElementById('woRequiredSignature');
    const w=currentWorkOrder();

    if(!w || !isTechnicianView() || !w.signature_required || !['in_progress','on_hold'].includes(w.status)){
      if(old)old.remove();
      return;
    }

    // If the current rendered form already exposes the signature action, do not duplicate it.
    const existingAction=document.querySelector('[data-a="wosignature"]');
    if(existingAction){
      if(old && !old.contains(existingAction))old.remove();
      return;
    }

    if(old)return;

    const block=buildSignatureBlock(w);
    const closeForm=document.getElementById('closeWOAdvanced') || document.getElementById('closeWO');

    if(closeForm){
      closeForm.parentNode.insertBefore(block, closeForm);
      return;
    }

    // Fallback: show directly in technician OT detail even if a remote UI replaced/omitted the close form.
    const content=document.querySelector('#app .content') || document.querySelector('.content') || document.getElementById('app');
    if(content)content.appendChild(block);
  }

  let scheduled=false;
  function scheduleInject(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      try{injectSignatureField()}catch(err){console.warn('Mainteno signature field fix V3:',err)}
    });
  }

  const root=document.getElementById('app') || document.body;
  const observer=new MutationObserver(scheduleInject);
  observer.observe(root,{childList:true,subtree:true});

  document.addEventListener('DOMContentLoaded',scheduleInject,{once:true});
  window.addEventListener('load',scheduleInject,{once:true});
  window.addEventListener('pageshow',scheduleInject);

  setTimeout(scheduleInject,0);
  setTimeout(scheduleInject,300);
  setTimeout(scheduleInject,1000);
  setTimeout(scheduleInject,2500);
})();
