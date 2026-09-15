// Mainteno Next — required OT signature field fix V2.
// Isolated DOM-level patch: does not replace work-order logic or backend behavior.
(function(){
  if(window.__maintenoSignatureFieldFixV2Loaded)return;
  window.__maintenoSignatureFieldFixV2Loaded=true;

  function currentWorkOrder(){
    if(!window.S || S.page!=='woDetail' || !S.selected || !Array.isArray(S.wo))return null;
    return S.wo.find(x=>x.id===S.selected)||null;
  }

  function signatureCount(woId){
    return (S.atts||[]).filter(x=>
      x.entity_type==='work_order' &&
      x.entity_id===woId &&
      x.kind==='signature'
    ).length;
  }

  function buildSignatureBlock(w){
    const count=signatureCount(w.id);
    const block=document.createElement('div');
    block.className='notice';
    block.id='woRequiredSignature';
    block.style.marginBottom='12px';
    block.innerHTML=`<div class="row mobileStack">
      <div>
        <b>Signature obligatoire</b>
        <div class="mut">${count?`${count} signature(s) enregistrée(s)`:'Aucune signature enregistrée'}</div>
      </div>
      <button type="button" class="btn primary" data-a="wosignature">✍ ${count?'Refaire la signature':'Signer'}</button>
    </div>`;
    return block;
  }

  function injectSignatureField(){
    const w=currentWorkOrder();
    if(!w || !w.signature_required)return;

    // The advanced UI uses #closeWOAdvanced. The legacy form uses #closeWO.
    const form=document.getElementById('closeWOAdvanced') || document.getElementById('closeWO');
    if(!form)return;

    // If the form already contains the real signature action, leave it untouched.
    if(form.querySelector('[data-a="wosignature"]'))return;

    // Remove a stale block from a previous render if present outside this form.
    const old=document.getElementById('woRequiredSignature');
    if(old)old.remove();

    const block=buildSignatureBlock(w);
    const firstField=form.querySelector('.field');
    if(firstField)firstField.before(block);
    else form.prepend(block);
  }

  let scheduled=false;
  function scheduleInject(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      try{injectSignatureField()}catch(err){console.warn('Mainteno signature field fix:',err)}
    });
  }

  // Watch the app because the advanced WO UI is loaded after local modules and can
  // replace the close form at any time during render/navigation.
  const root=document.getElementById('app') || document.body;
  const observer=new MutationObserver(scheduleInject);
  observer.observe(root,{childList:true,subtree:true});

  // Cover initial render, cached PWA restore and slow remote UI loading.
  document.addEventListener('DOMContentLoaded',scheduleInject,{once:true});
  window.addEventListener('load',scheduleInject,{once:true});
  setTimeout(scheduleInject,0);
  setTimeout(scheduleInject,500);
  setTimeout(scheduleInject,1500);
})();
