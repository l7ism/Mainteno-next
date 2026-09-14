// Mainteno Next — UX Forms Layer
// Replaces the highest-impact browser prompt()/confirm() interactions with proper forms.
(function () {
  'use strict';

  const stop = (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };

  const dtLocal = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const copy = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 16);
  };

  const opt = (value, label, selected = false) =>
    `<option value="${e(value)}" ${selected ? 'selected' : ''}>${e(label)}</option>`;

  function openFormModal({ title, body, submitLabel = 'Enregistrer', danger = false, onSubmit, setup }) {
    const wrap = document.createElement('div');
    wrap.className = 'scanWrap';
    wrap.innerHTML = `<div class="scanBox" role="dialog" aria-modal="true" aria-label="${e(title)}">
      <div class="row mobileStack">
        <h3 style="margin:0">${e(title)}</h3>
        <button type="button" class="btn" data-ux-close>Fermer</button>
      </div>
      <form data-ux-form style="margin-top:12px">
        ${body}
        <div class="stack" style="justify-content:flex-end;margin-top:14px">
          <button type="button" class="btn" data-ux-close>Annuler</button>
          <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" data-ux-submit>${e(submitLabel)}</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelectorAll('[data-ux-close]').forEach((b) => (b.onclick = close));
    wrap.addEventListener('click', (ev) => {
      if (ev.target === wrap) close();
    });

    const form = wrap.querySelector('[data-ux-form]');
    const submit = wrap.querySelector('[data-ux-submit]');
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      submit.disabled = true;
      const oldText = submit.textContent;
      submit.textContent = 'Enregistrement…';
      try {
        const data = Object.fromEntries(new FormData(form));
        await onSubmit(data, form);
        close();
      } catch (err) {
        toast(err?.message || 'Erreur', 1);
        submit.disabled = false;
        submit.textContent = oldText;
      }
    };
    if (setup) setup(wrap, form);
    setTimeout(() => wrap.querySelector('input,select,textarea')?.focus(), 0);
    return wrap;
  }

  function openConfirmModal({ title, message, submitLabel = 'Confirmer', danger = false, onConfirm }) {
    return openFormModal({
      title,
      body: `<div class="notice" style="margin-top:8px">${e(message)}</div>`,
      submitLabel,
      danger,
      onSubmit: onConfirm,
    });
  }

  function techniciansForTeam(teamId) {
    const all = activeTechs();
    if (!teamId) return all;
    const ids = new Set(S.teamMembers.filter((m) => m.team_id === teamId).map((m) => m.user_id));
    return all.filter((p) => ids.has(p.id));
  }

  function fillTechSelect(el, teamId, selectedId = '') {
    if (!el) return;
    const techs = techniciansForTeam(teamId);
    el.innerHTML = '<option value="">Aucun</option>' + techs.map((p) => opt(p.id, `${p.full_name} · ${p.role}`, p.id === selectedId)).join('');
  }

  function openAssignWorkOrder() {
    const w = S.wo.find((x) => x.id === S.selected);
    if (!w) throw new Error('OT introuvable');
    openFormModal({
      title: `Affectation OT #${w.wo_number}`,
      body: `<div class="field"><label>Équipe</label><select name="team_id" data-ux-team><option value="">Aucune</option>${S.teams.map((t) => opt(t.id, t.name, t.id === w.team_id)).join('')}</select></div>
        <div class="field"><label>Technicien</label><select name="technician_id" data-ux-tech></select></div>
        <div class="field"><label>Échéance</label><input name="due_at" type="datetime-local" value="${e(dtLocal(w.due_at))}"></div>`,
      submitLabel: 'Mettre à jour',
      setup: (wrap) => {
        const team = wrap.querySelector('[data-ux-team]');
        const tech = wrap.querySelector('[data-ux-tech]');
        fillTechSelect(tech, team.value, w.technician_id || '');
        team.onchange = () => fillTechSelect(tech, team.value, '');
      },
      onSubmit: async (o) => {
        await rpc('nx_assign_work_order', {
          p_work_order_id: w.id,
          p_team_id: o.team_id || null,
          p_technician_id: o.technician_id || null,
          p_due_at: o.due_at ? new Date(o.due_at).toISOString() : null,
        });
        await loadAll();
        render();
        toast('Affectation mise à jour');
      },
    });
  }

  function openNewSite() {
    openFormModal({
      title: 'Nouveau site',
      body: `<div class="field"><label>Nom du site *</label><input name="name" required placeholder="Color Wash"></div>
        <div class="field"><label>Code</label><input name="code" placeholder="CW"></div>
        <div class="field"><label>Adresse</label><textarea name="address"></textarea></div>
        <div class="field"><label>Description</label><textarea name="description"></textarea></div>`,
      submitLabel: 'Créer le site',
      onSubmit: async (o) => {
        await rpc('nx_create_location', { p_name: o.name, p_code: o.code || null, p_location_type: 'site', p_parent_id: null, p_address: o.address || null, p_description: o.description || null });
        await loadAll(); render(); toast('Site créé');
      },
    });
  }

  function openNewZone() {
    const sites = S.locations.filter((l) => l.location_type === 'site');
    if (!sites.length) throw new Error('Crée d’abord un site');
    openFormModal({
      title: 'Nouvelle zone',
      body: `<div class="field"><label>Site parent *</label><select name="parent_id" required><option value="">Choisir…</option>${sites.map((l) => opt(l.id, l.path || l.name)).join('')}</select></div>
        <div class="field"><label>Nom de la zone *</label><input name="name" required placeholder="Production"></div>
        <div class="field"><label>Code</label><input name="code"></div>
        <div class="field"><label>Description</label><textarea name="description"></textarea></div>`,
      submitLabel: 'Créer la zone',
      onSubmit: async (o) => {
        await rpc('nx_create_location', { p_name: o.name, p_code: o.code || null, p_location_type: 'zone', p_parent_id: o.parent_id, p_address: null, p_description: o.description || null });
        await loadAll(); render(); toast('Zone créée');
      },
    });
  }

  function openNewLocation() {
    const parents = S.locations.filter((l) => ['zone', 'location'].includes(l.location_type));
    if (!parents.length) throw new Error('Crée d’abord une zone');
    openFormModal({
      title: 'Nouvel emplacement',
      body: `<div class="field"><label>Parent *</label><select name="parent_id" required><option value="">Choisir…</option>${parents.map((l) => opt(l.id, l.path || l.name)).join('')}</select></div>
        <div class="field"><label>Nom *</label><input name="name" required placeholder="Ligne Vortex"></div>
        <div class="field"><label>Code</label><input name="code"></div>
        <div class="field"><label>Description</label><textarea name="description"></textarea></div>`,
      submitLabel: 'Créer l’emplacement',
      onSubmit: async (o) => {
        await rpc('nx_create_location', { p_name: o.name, p_code: o.code || null, p_location_type: 'location', p_parent_id: o.parent_id, p_address: null, p_description: o.description || null });
        await loadAll(); render(); toast('Emplacement créé');
      },
    });
  }

  function openNewTeam() {
    openFormModal({
      title: 'Nouvelle équipe',
      body: `<div class="field"><label>Nom de l’équipe *</label><input name="name" required placeholder="Équipe maintenance jour"></div>
        <div class="field"><label>Description</label><textarea name="description"></textarea></div>`,
      submitLabel: 'Créer l’équipe',
      onSubmit: async (o) => {
        await rpc('nx_create_team', { p_name: o.name, p_description: o.description || null });
        await loadAll(); render(); toast('Équipe créée');
      },
    });
  }

  function openAddMember(teamId) {
    const team = S.teams.find((t) => t.id === teamId);
    const currentIds = new Set(S.teamMembers.filter((m) => m.team_id === teamId).map((m) => m.user_id));
    const choices = activeTechs().filter((p) => !currentIds.has(p.id));
    if (!choices.length) throw new Error('Tous les utilisateurs disponibles sont déjà dans cette équipe');
    openFormModal({
      title: `Ajouter un membre · ${team?.name || 'Équipe'}`,
      body: `<div class="field"><label>Membre *</label><select name="user_id" required><option value="">Choisir…</option>${choices.map((p) => opt(p.id, `${p.full_name} · ${p.role}`)).join('')}</select></div>
        <label class="check"><input type="checkbox" name="is_lead"> Responsable de l’équipe</label>`,
      submitLabel: 'Ajouter',
      onSubmit: async (o) => {
        await rpc('nx_set_team_member', { p_team_id: teamId, p_user_id: o.user_id, p_is_lead: o.is_lead === 'on' });
        await loadAll(); render(); toast('Membre ajouté');
      },
    });
  }

  function openAssignAssetLocation() {
    const asset = S.assets.find((a) => a.id === S.selected);
    const locations = S.locations.filter((l) => l.location_type === 'location');
    if (!asset) throw new Error('Machine introuvable');
    if (!locations.length) throw new Error('Aucun emplacement disponible');
    openFormModal({
      title: `Affecter ${asset.code}`,
      body: `<div class="field"><label>Emplacement *</label><select name="location_id" required><option value="">Choisir…</option>${locations.map((l) => opt(l.id, l.path || l.name, l.id === asset.location_id)).join('')}</select></div>`,
      submitLabel: 'Affecter',
      onSubmit: async (o) => {
        await rpc('nx_assign_asset_location', { p_asset_id: asset.id, p_location_id: o.location_id });
        await loadAll(); render(); toast('Machine affectée');
      },
    });
  }

  function openStockAdjustment(partId) {
    const p = S.parts.find((x) => x.id === partId);
    if (!p) throw new Error('Pièce introuvable');
    openFormModal({
      title: `Ajuster stock · ${p.reference || ''} ${p.name}`,
      body: `<div class="notice">Stock actuel : <b>${e(p.quantity_on_hand)}</b></div>
        <div class="field"><label>Variation *</label><input name="delta" type="number" step="any" required placeholder="+10 ou -2"></div>
        <div class="mut">Valeur positive = entrée, valeur négative = sortie.</div>
        <div class="field"><label>Motif *</label><input name="reason" required value="Inventaire"></div>`,
      submitLabel: 'Ajuster',
      onSubmit: async (o) => {
        const delta = Number(o.delta);
        if (!Number.isFinite(delta) || delta === 0) throw new Error('Saisis une variation différente de 0');
        await rpc('nx_adjust_part_stock', { p_part_id: partId, p_delta: delta, p_reason: o.reason });
        await loadAll(); render(); toast('Stock ajusté');
      },
    });
  }

  function openMeterReading(meterId) {
    const m = S.meters.find((x) => x.id === meterId);
    if (!m) throw new Error('Compteur introuvable');
    openFormModal({
      title: `Nouveau relevé · ${m.name}`,
      body: `<div class="notice">Dernière valeur : <b>${e(m.current_value ?? '—')} ${e(m.unit || '')}</b></div>
        <div class="field"><label>Nouvelle valeur (${e(m.unit || '')}) *</label><input name="reading" type="number" step="any" required value="${e(m.current_value ?? 0)}"></div>
        <div class="field"><label>Note</label><textarea name="notes" placeholder="Optionnel"></textarea></div>`,
      submitLabel: 'Enregistrer le relevé',
      onSubmit: async (o) => {
        const reading = Number(o.reading);
        if (!Number.isFinite(reading)) throw new Error('Valeur invalide');
        const r = await rpc('nx_record_meter_reading', { p_meter_id: meterId, p_reading: reading, p_notes: o.notes || null });
        await loadAll(); render();
        toast(`Relevé enregistré${r?.work_orders_created ? ` · ${r.work_orders_created} OT généré(s)` : ''}`);
      },
    });
  }

  function openHoldWorkOrder() {
    openFormModal({
      title: 'Mettre l’OT en attente',
      body: `<div class="field"><label>Motif *</label><textarea name="reason" required>Attente pièce</textarea></div>`,
      submitLabel: 'Mettre en attente',
      onSubmit: async (o) => {
        await queueOrRun('hold_work_order', S.selected, { reason: o.reason });
        if (navigator.onLine) await loadAll();
        render(); toast('OT mis en attente');
      },
    });
  }

  function openValidateWorkOrder() {
    openFormModal({
      title: 'Valider l’OT',
      body: `<div class="field"><label>Commentaire de validation</label><textarea name="comment" placeholder="Optionnel"></textarea></div>`,
      submitLabel: 'Valider',
      onSubmit: async (o) => {
        if (!navigator.onLine) throw new Error('Connexion requise');
        await rpc('nx_validate_work_order', { p_work_order_id: S.selected, p_comment: o.comment || null });
        await loadAll(); render(); toast('OT validé');
      },
    });
  }

  function openReopenWorkOrder() {
    openFormModal({
      title: 'Renvoyer l’OT',
      body: `<div class="field"><label>Motif de reprise *</label><textarea name="reason" required></textarea></div>`,
      submitLabel: 'Renvoyer au technicien',
      danger: true,
      onSubmit: async (o) => {
        if (!navigator.onLine) throw new Error('Connexion requise');
        await rpc('nx_reopen_work_order', { p_work_order_id: S.selected, p_reason: o.reason });
        await loadAll(); render(); toast('OT renvoyé');
      },
    });
  }

  function openDeclineRequest(requestId) {
    const r = S.requests.find((x) => x.id === requestId);
    openFormModal({
      title: 'Refuser la demande',
      body: `<div class="notice">${e(r?.title || 'Demande')}</div><div class="field"><label>Motif du refus *</label><textarea name="comment" required></textarea></div>`,
      submitLabel: 'Refuser',
      danger: true,
      onSubmit: async (o) => {
        await rpc('nx_decline_work_request', { p_request_id: requestId, p_comment: o.comment });
        await loadAll(); render(); toast('Demande refusée');
      },
    });
  }

  function openResolveException(exceptionId) {
    const x = S.exceptions.find((z) => z.id === exceptionId);
    openFormModal({
      title: 'Résoudre l’anomalie de procédure',
      body: `<div class="notice">${e(x?.message || 'Anomalie')}</div><div class="field"><label>Note de résolution *</label><textarea name="note" required></textarea></div>`,
      submitLabel: 'Marquer résolue',
      onSubmit: async (o) => {
        if (!navigator.onLine) throw new Error('Connexion requise');
        await rpc('nx_resolve_procedure_exception', { p_exception_id: exceptionId, p_resolution_note: o.note });
        await loadAll(); render(); toast('Anomalie résolue');
      },
    });
  }

  function openPublicPortal() {
    openFormModal({
      title: 'Nouveau portail QR',
      body: `<div class="field"><label>Nom *</label><input name="name" required value="Demande maintenance"></div>
        <div class="field"><label>Machine</label><select name="asset_id"><option value="">Aucune</option>${S.assets.map((a) => opt(a.id, `${a.code} · ${a.name}`)).join('')}</select></div>
        <div class="field"><label>Emplacement</label><select name="location_id"><option value="">Aucun</option>${S.locations.filter((l) => l.location_type === 'location').map((l) => opt(l.id, l.path || l.name)).join('')}</select></div>
        <div class="field"><label>Équipe destinataire</label><select name="team_id"><option value="">Aucune</option>${S.teams.map((t) => opt(t.id, t.name)).join('')}</select></div>
        <div class="field"><label>Priorité par défaut</label><select name="priority"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div>`,
      submitLabel: 'Créer le portail',
      onSubmit: async (o) => {
        const p = await rpc('nx_create_request_portal', { p_name: o.name, p_asset_id: o.asset_id || null, p_location_id: o.location_id || null, p_assigned_team_id: o.team_id || null, p_default_priority: o.priority || 'medium' });
        await loadAll(); render();
        if (p?.token) await navigator.clipboard.writeText(location.origin + '/#/request/' + p.token).catch(() => {});
        toast('Portail créé, lien copié');
      },
    });
  }

  function openTechnicianQuickWo() {
    const asset = S.assets.find((x) => x.id === S.selected);
    if (!asset) throw new Error('Machine introuvable');
    openFormModal({
      title: `Créer un OT · ${asset.code}`,
      body: `<div class="field"><label>Titre *</label><input name="title" required value="${e('Intervention sur ' + asset.name)}"></div>`,
      submitLabel: 'Créer l’OT',
      onSubmit: async (o) => {
        const c = (await ins('nx_work_orders', { title: o.title, asset_id: asset.id, location_id: asset.location_id || null, type: 'corrective', priority: 'medium', technician_id: S.u.id, status: 'assigned', created_by: S.u.id, assigned_at: new Date().toISOString() }))[0];
        await loadAll(); S.selected = c.id; S.page = 'woDetail'; render(); toast('OT créé');
      },
    });
  }

  function confirmProcedureDelete(stepId) {
    openConfirmModal({
      title: 'Supprimer l’étape',
      message: 'Cette étape sera supprimée du brouillon de procédure.',
      submitLabel: 'Supprimer',
      danger: true,
      onConfirm: async () => {
        await rpc('nx_delete_procedure_step', { p_step_id: stepId });
        S.editStepId = null; await loadAll(); render(); toast('Étape supprimée');
      },
    });
  }

  function confirmProcedurePublish(procedureId) {
    openConfirmModal({
      title: 'Publier la procédure',
      message: 'Après publication, cette version devient immuable. Pour la modifier ensuite, il faudra créer une nouvelle version.',
      submitLabel: 'Publier',
      onConfirm: async () => {
        await rpc('nx_publish_procedure', { p_procedure_id: procedureId });
        await loadAll(); render(); toast('Procédure publiée');
      },
    });
  }

  function confirmRemovePart(lineId) {
    openConfirmModal({
      title: 'Retourner la pièce au stock',
      message: 'La consommation sera retirée de l’OT et la quantité sera remise en stock.',
      submitLabel: 'Retourner au stock',
      danger: true,
      onConfirm: async () => {
        if (!navigator.onLine) throw new Error('Connexion requise pour retourner une pièce');
        await rpc('nx_remove_work_order_part', { p_line_id: lineId });
        await loadAll(); render(); toast('Pièce remise en stock');
      },
    });
  }

  function confirmDiscardSync(actionId) {
    openConfirmModal({
      title: 'Abandonner le conflit',
      message: 'Cette action locale en conflit sera supprimée. Elle ne sera plus synchronisée avec le serveur.',
      submitLabel: 'Abandonner',
      danger: true,
      onConfirm: async () => {
        if (!navigator.onLine) throw new Error('Connexion requise pour abandonner un conflit');
        try {
          await rpc('nx_discard_mobile_sync_failure', { p_action_id: actionId, p_reason: 'Abandonné depuis le centre de synchronisation' });
        } catch (err) {
          if (!/not found/i.test(err?.message || '')) throw err;
        }
        await idbDel('queue', actionId);
        await idbDel('files', actionId).catch(() => {});
        await showSync(); render(); toast('Conflit abandonné');
      },
    });
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button,[data-adjustpart],[data-meterread],[data-addmember],[data-declinerequest],[data-resolveexception],[data-delstep],[data-publishprocedure],[data-removepart],[data-dropsync]');
    if (!t) return;

    try {
      if (t.dataset.adjustpart) { stop(ev); return openStockAdjustment(t.dataset.adjustpart); }
      if (t.dataset.meterread) { stop(ev); return openMeterReading(t.dataset.meterread); }
      if (t.dataset.addmember) { stop(ev); return openAddMember(t.dataset.addmember); }
      if (t.dataset.declinerequest) { stop(ev); return openDeclineRequest(t.dataset.declinerequest); }
      if (t.dataset.resolveexception) { stop(ev); return openResolveException(t.dataset.resolveexception); }
      if (t.dataset.delstep) { stop(ev); return confirmProcedureDelete(t.dataset.delstep); }
      if (t.dataset.publishprocedure) { stop(ev); return confirmProcedurePublish(t.dataset.publishprocedure); }
      if (t.dataset.removepart) { stop(ev); return confirmRemovePart(t.dataset.removepart); }
      if (t.dataset.dropsync) { stop(ev); return confirmDiscardSync(t.dataset.dropsync); }

      const a = t.dataset.a;
      if (a === 'assignwo') { stop(ev); return openAssignWorkOrder(); }
      if (a === 'newsite') { stop(ev); return openNewSite(); }
      if (a === 'newzone') { stop(ev); return openNewZone(); }
      if (a === 'newlocation') { stop(ev); return openNewLocation(); }
      if (a === 'newteam') { stop(ev); return openNewTeam(); }
      if (a === 'assignassetlocation') { stop(ev); return openAssignAssetLocation(); }
      if (a === 'newportal') { stop(ev); return openPublicPortal(); }
      if (a === 'holdwo') { stop(ev); return openHoldWorkOrder(); }
      if (a === 'validatewo') { stop(ev); return openValidateWorkOrder(); }
      if (a === 'reopenwo') { stop(ev); return openReopenWorkOrder(); }
      if (a === 'createwo' && !isMgr()) { stop(ev); return openTechnicianQuickWo(); }
    } catch (err) {
      stop(ev);
      toast(err?.message || 'Erreur', 1);
    }
  }, true);
})();
