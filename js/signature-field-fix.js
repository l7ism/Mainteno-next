// Mainteno Next — restore required work-order signature field in the advanced close form only.
(function(){
  if(window.__maintenoSignatureFieldFixLoaded)return;
  window.__maintenoSignatureFieldFixLoaded=true;

  function applySignatureFieldFix(){
    if(window.__maintenoSignatureFieldFixApplied)return;
    if(typeof closeForm!=='function')return;

    const baseCloseForm=closeForm;
    closeForm=function(w,d){
      let html=baseCloseForm(w,d);
      if(!w?.signature_required)return html;
      // The legacy form already has the signature control. Do not duplicate it.
      if(String(html).includes('data-a="wosignature"'))return html;

      const sigCount=(S.atts||[]).filter(x=>
        x.entity_type==='work_order' &&
        x.entity_id===w.id &&
        x.kind==='signature'
      ).length;

      const block=`<div class="notice" id="woRequiredSignature" style="margin-bottom:12px">
        <div class="row mobileStack">
          <div>
            <b>Signature obligatoire</b>
            <div class="mut">${sigCount?`${sigCount} signature(s) enregistrée(s)`:'Aucune signature enregistrée'}</div>
          </div>
          <button type="button" class="btn primary" data-a="wosignature">✍ ${sigCount?'Refaire la signature':'Signer'}</button>
        </div>
      </div>`;

      // Put the signature requirement before the first technical field.
      const marker='<div class="field">';
      if(String(html).includes(marker))return String(html).replace(marker,block+marker);
      return String(html).replace('</form>',block+'</form>');
    };

    window.__maintenoSignatureFieldFixApplied=true;

    // If an OT detail is already open when the remote advanced UI finishes loading,
    // refresh only that current view so the signature field appears immediately.
    if(S?.u && S.page==='woDetail' && S.selected){
      try{render()}catch{}
    }
  }

  // Remote UI modules are appended after local scripts by the production build.
  // Apply after they have executed so this small patch is the final closeForm wrapper.
  addEventListener('load',applySignatureFieldFix,{once:true});
  setTimeout(applySignatureFieldFix,0);
})();
