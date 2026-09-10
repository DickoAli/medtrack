import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionProfessionnels({ onBack, profile }) {
  const [professionnels, setProfessionnels] = useState([])
  const [establishments, setEstablishments] = useState([])
  const [commercialTargets, setCommercialTargets] = useState([])
  const [professionalEstablishments, setProfessionalEstablishments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterPotential, setFilterPotential] = useState('tous')
  const [detailProfessional, setDetailProfessional] = useState(null)
  const [addEstablishmentId, setAddEstablishmentId] = useState('')
  const [savingTarget, setSavingTarget] = useState(false)

  const [form, setForm] = useState({
    nom: '', prenom: '', specialite: '', type: '',
    establishment_id: '', telephone: '', email: '', notes: ''
  })

  const [targetForm, setTargetForm] = useState({
    priority: 'B', visit_frequency_default: 1, statut: 'actif', notes: ''
  })

  const TYPES = [
    { value: 'medecin_generaliste', label: 'Médecin généraliste' },
    { value: 'specialiste', label: 'Spécialiste' },
    { value: 'pharmacien', label: 'Pharmacien' },
    { value: 'infirmier', label: 'Infirmier' },
    { value: 'directeur', label: 'Directeur' },
    { value: 'autre', label: 'Autre' },
  ]

  const PRIORITY_COLORS = {
    A: 'bg-[#FDE8E8] text-[#DC2626]',
    B: 'bg-[#FEF3E2] text-[#B45309]',
    C: 'bg-[#EEF1F4] text-[#667085]'
  }
  const PRIORITY_SOLID = { A: 'bg-[#DC2626]', B: 'bg-[#F59E0B]', C: 'bg-[#98A2B3]' }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: p }, { data: e }, { data: ct }, { data: pe }] = await Promise.all([
      supabase.from('healthcare_professionals')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .order('nom'),
      supabase.from('establishments')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .eq('is_active', true)
        .order('nom'),
      supabase.from('commercial_targets')
        .select('*')
        .eq('agence_id', profile.agence_id),
      supabase.from('professional_establishments')
        .select('*, establishments(nom, type)')
        .eq('agence_id', profile.agence_id)
    ])
    setProfessionnels(p || [])
    setEstablishments(e || [])
    setCommercialTargets(ct || [])
    setProfessionalEstablishments(pe || [])
    setLoading(false)

    // Garder le detailProfessional synchronisé après un refetch
    if (detailProfessional) {
      const refreshed = (p || []).find(x => x.id === detailProfessional.id)
      if (refreshed) setDetailProfessional(refreshed)
    }
  }

  const getTarget = (professionalId) => commercialTargets.find(ct => ct.healthcare_professional_id === professionalId)
  const getEstablishmentsFor = (professionalId) => professionalEstablishments.filter(pe => pe.healthcare_professional_id === professionalId)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const resetForm = () => setForm({
    nom: '', prenom: '', specialite: '', type: '',
    establishment_id: '', telephone: '', email: '', notes: ''
  })

  // ===== Création / édition identité du professionnel =====
  const handleSave = async () => {
    if (!form.nom || !form.prenom) { alert('Nom et prénom obligatoires'); return }
    if (!form.type) { alert('Sélectionnez un type'); return }
    if (!editing && !form.establishment_id) { alert('Sélectionnez un établissement de départ'); return }
    setSaving(true)

    const identite = {
      nom: form.nom, prenom: form.prenom, specialite: form.specialite || null,
      type: form.type, telephone: form.telephone || null, email: form.email || null,
      notes: form.notes || null, agence_id: profile.agence_id,
      updated_at: new Date().toISOString()
    }

    if (editing) {
      await supabase.from('healthcare_professionals').update(identite).eq('id', editing)
    } else {
      const { data: created } = await supabase.from('healthcare_professionals').insert(identite).select().single()
      if (created) {
        // L'établissement choisi à la création devient l'établissement principal.
        // Le trigger trg_sync_primary_establishment répercute automatiquement
        // establishment_id sur healthcare_professionals.
        await supabase.from('professional_establishments').insert({
          agence_id: profile.agence_id,
          healthcare_professional_id: created.id,
          establishment_id: form.establishment_id,
          is_primary: true
        })
      }
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg(editing ? 'Professionnel modifié !' : 'Professionnel créé !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({
      nom: p.nom, prenom: p.prenom, specialite: p.specialite || '',
      type: p.type || '', establishment_id: '', telephone: p.telephone || '',
      email: p.email || '', notes: p.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce professionnel ? Sa fiche cible commerciale et ses établissements liés seront également supprimés.')) return
    await supabase.from('professional_establishments').delete().eq('healthcare_professional_id', id)
    await supabase.from('commercial_targets').delete().eq('healthcare_professional_id', id)
    await supabase.from('healthcare_professionals').delete().eq('id', id)
    if (detailProfessional?.id === id) setDetailProfessional(null)
    fetchAll()
  }

  // ===== Cible commerciale =====
  const openDetail = (p) => {
    setDetailProfessional(p)
    const t = getTarget(p.id)
    setTargetForm(t
      ? { priority: t.priority, visit_frequency_default: t.visit_frequency_default, statut: t.statut, notes: t.notes || '' }
      : { priority: 'B', visit_frequency_default: 1, statut: 'actif', notes: '' })
  }

  const handleQualify = async () => {
    if (!detailProfessional) return
    setSavingTarget(true)
    await supabase.from('commercial_targets').insert({
      agence_id: profile.agence_id,
      healthcare_professional_id: detailProfessional.id,
      priority: targetForm.priority,
      visit_frequency_default: parseInt(targetForm.visit_frequency_default) || 1,
      statut: targetForm.statut,
      notes: targetForm.notes || null,
      created_by: profile.id
    })
    setSavingTarget(false)
    setSuccessMsg('Professionnel qualifié comme cible commerciale !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleUpdateTarget = async () => {
    const t = getTarget(detailProfessional.id)
    if (!t) return
    setSavingTarget(true)
    await supabase.from('commercial_targets').update({
      priority: targetForm.priority,
      visit_frequency_default: parseInt(targetForm.visit_frequency_default) || 1,
      statut: targetForm.statut,
      notes: targetForm.notes || null,
      updated_at: new Date().toISOString()
    }).eq('id', t.id)
    setSavingTarget(false)
    setSuccessMsg('Cible commerciale mise à jour !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  // ===== Multi-établissement =====
  const handleAddEstablishment = async () => {
    if (!addEstablishmentId || !detailProfessional) return
    const already = getEstablishmentsFor(detailProfessional.id).some(pe => pe.establishment_id === addEstablishmentId)
    if (already) { alert('Cet établissement est déjà lié à ce professionnel'); return }
    const hasNoPrimary = getEstablishmentsFor(detailProfessional.id).length === 0
    await supabase.from('professional_establishments').insert({
      agence_id: profile.agence_id,
      healthcare_professional_id: detailProfessional.id,
      establishment_id: addEstablishmentId,
      is_primary: hasNoPrimary
    })
    setAddEstablishmentId('')
    fetchAll()
  }

  const handleRemoveEstablishment = async (peId) => {
    if (!confirm('Retirer cet établissement du professionnel ?')) return
    await supabase.from('professional_establishments').delete().eq('id', peId)
    fetchAll()
  }

  // Changement d'établissement principal — deux mises à jour séquentielles.
  // ⚠ Ce n'est PAS une vraie transaction atomique côté client (le SDK
  // Supabase JS ne permet pas de BEGIN/COMMIT multi-requêtes). En cas
  // d'échec du 2e appel, il resterait temporairement aucun établissement
  // principal — géré ici par un rollback manuel best-effort du 1er appel.
  const handleSetPrimary = async (peId) => {
    if (!detailProfessional) return
    const current = getEstablishmentsFor(detailProfessional.id).find(pe => pe.is_primary)
    if (current?.id === peId) return

    if (current) {
      await supabase.from('professional_establishments')
        .update({ is_primary: false }).eq('id', current.id)
    }
    const { error } = await supabase.from('professional_establishments')
      .update({ is_primary: true }).eq('id', peId)

    if (error && current) {
      // Rollback best-effort si la 2e étape échoue
      await supabase.from('professional_establishments')
        .update({ is_primary: true }).eq('id', current.id)
      alert('Erreur lors du changement d\'établissement principal, opération annulée.')
    } else {
      setSuccessMsg('Établissement principal mis à jour !')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
    fetchAll()
  }

  const filtered = professionnels.filter(p => {
    const matchSearch = `${p.nom} ${p.prenom} ${p.specialite || ''}`.toLowerCase().includes(search.toLowerCase())
    const target = getTarget(p.id)
    const matchPotential = filterPotential === 'tous'
      || (filterPotential === 'non_qualifie' && !target)
      || (target && target.priority === filterPotential)
    return matchSearch && matchPotential
  })

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  // ===== Vue détail (identité + cible + établissements) =====
  if (detailProfessional) {
    const target = getTarget(detailProfessional.id)
    const profEstablishments = getEstablishmentsFor(detailProfessional.id)
    const availableToAdd = establishments.filter(e => !profEstablishments.some(pe => pe.establishment_id === e.id))

    return (
      <div className="min-h-screen bg-[#F4F7F9]">
        <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
          <button onClick={() => setDetailProfessional(null)} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">{detailProfessional.prenom} {detailProfessional.nom}</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {detailProfessional.specialite || TYPES.find(t => t.value === detailProfessional.type)?.label || '—'}
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
            <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
          </div>
        )}

        <div className="p-5 flex flex-col gap-4 pb-10">

          {/* Identité rapide */}
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">Identité</p>
              <button onClick={() => handleEdit(detailProfessional)}
                className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️ Modifier</button>
            </div>
            <div className="flex flex-col gap-1 text-sm text-[#667085]">
              {detailProfessional.telephone && <p>📞 {detailProfessional.telephone}</p>}
              {detailProfessional.email && <p>✉️ {detailProfessional.email}</p>}
              {detailProfessional.notes && <p className="italic mt-1">{detailProfessional.notes}</p>}
            </div>
          </div>

          {/* Cible commerciale */}
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">Cible commerciale</p>

            {!target ? (
              <div className="text-center py-4">
                <p className="text-sm text-[#667085] mb-3">Ce professionnel n'est pas encore qualifié comme cible commerciale.</p>
                <button onClick={handleQualify} disabled={savingTarget}
                  className="bg-[#087F5B] text-white font-semibold py-2.5 px-5 rounded-lg text-sm">
                  {savingTarget ? '...' : '+ Qualifier comme cible'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Potentiel</label>
                  <div className="flex gap-2 mt-1">
                    {['A', 'B', 'C'].map(p => (
                      <button key={p} onClick={() => setTargetForm(f => ({ ...f, priority: p }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          targetForm.priority === p ? `${PRIORITY_SOLID[p]} text-white border-transparent` : 'bg-white text-[#98A2B3] border-[#DDE4EA]'
                        }`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Fréquence de visite recommandée (par mois)</label>
                  <input type="number" value={targetForm.visit_frequency_default}
                    onChange={e => setTargetForm(f => ({ ...f, visit_frequency_default: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" min="1" max="12" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Statut</label>
                  <select value={targetForm.statut} onChange={e => setTargetForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="ne_pas_visiter">Ne pas visiter</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Notes</label>
                  <textarea value={targetForm.notes} onChange={e => setTargetForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none" />
                </div>
                <button onClick={handleUpdateTarget} disabled={savingTarget}
                  className="w-full bg-[#087F5B] text-white font-semibold py-2.5 rounded-lg text-sm">
                  {savingTarget ? '...' : 'Enregistrer la cible commerciale'}
                </button>
                <p className="text-xs text-[#98A2B3]">
                  Ces valeurs servent de défaut. Une campagne peut les surcharger pour son propre contexte, sans modifier cette fiche.
                </p>
              </div>
            )}
          </div>

          {/* Établissements */}
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
              Établissements ({profEstablishments.length})
            </p>

            {profEstablishments.length === 0 ? (
              <p className="text-sm text-[#667085] mb-3">Aucun établissement lié.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {profEstablishments.map(pe => (
                  <div key={pe.id} className="flex items-center gap-3 bg-[#F4F7F9] rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#172B4D] truncate">{pe.establishments?.nom}</p>
                      <p className="text-xs text-[#667085]">{pe.establishments?.type}</p>
                    </div>
                    {pe.is_primary ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#E7F5EF] text-[#087F5B] flex-shrink-0">
                        ⭐ Principal
                      </span>
                    ) : (
                      <button onClick={() => handleSetPrimary(pe.id)}
                        className="text-xs font-semibold px-2 py-1 rounded-full bg-[#EEF1F4] text-[#667085] flex-shrink-0">
                        Définir principal
                      </button>
                    )}
                    <button onClick={() => handleRemoveEstablishment(pe.id)}
                      className="bg-[#FDE8E8] text-[#DC2626] px-2 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0">
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select value={addEstablishmentId} onChange={e => setAddEstablishmentId(e.target.value)}
                className="flex-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="">Ajouter un établissement...</option>
                {availableToAdd.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
              <button onClick={handleAddEstablishment} disabled={!addEstablishmentId}
                className={`px-4 py-3 rounded-lg text-sm font-semibold ${addEstablishmentId ? 'bg-[#172B4D] text-white' : 'bg-[#EEF1F4] text-[#98A2B3]'}`}>
                Ajouter
              </button>
            </div>
          </div>

          <button onClick={() => handleDelete(detailProfessional.id)}
            className="w-full bg-[#FDE8E8] text-[#DC2626] font-semibold py-3 rounded-lg text-sm">
            🗑️ Supprimer ce professionnel
          </button>
        </div>

        {showForm && (
          <ProfessionalForm
            form={form} set={set} editing={editing} saving={saving}
            establishments={establishments} TYPES={TYPES}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            onSave={handleSave}
          />
        )}
      </div>
    )
  }

  // ===== Vue liste =====
  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Professionnels de santé</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {professionnels.length} professionnel{professionnels.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Ajouter
        </button>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
          placeholder="🔍 Rechercher par nom, spécialité..." />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', 'A', 'B', 'C', 'non_qualifie'].map(p => (
            <button key={p} onClick={() => setFilterPotential(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                filterPotential === p ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
              }`}>
              {p === 'tous' ? 'Tous' : p === 'non_qualifie' ? 'Non qualifiés' : `Potentiel ${p}`}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
          <p className="text-[#087F5B] font-semibold">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <ProfessionalForm
          form={form} set={set} editing={editing} saving={saving}
          establishments={establishments} TYPES={TYPES}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}

      <div className="p-5 flex flex-col gap-3">
        <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">
          {filtered.length} professionnel{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">👨‍⚕️</p>
            <p className="text-[#667085] text-sm font-medium">Aucun professionnel trouvé</p>
          </div>
        ) : (
          filtered.map(p => {
            const target = getTarget(p.id)
            const profEstablishments = getEstablishmentsFor(p.id)
            const primary = profEstablishments.find(pe => pe.is_primary)
            return (
              <div key={p.id} onClick={() => openDetail(p)}
                className="bg-white rounded-xl p-4 border border-[#DDE4EA] cursor-pointer hover:border-[#087F5B] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {target ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[target.priority]}`}>
                          {target.priority}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF1F4] text-[#98A2B3]">
                          Non qualifié
                        </span>
                      )}
                      <p className="font-semibold text-[#172B4D]">{p.prenom} {p.nom}</p>
                    </div>
                    {p.specialite && <p className="text-xs text-[#667085] font-medium">{p.specialite}</p>}
                    {primary && <p className="text-xs text-[#667085]">🏥 {primary.establishments?.nom}</p>}
                    {profEstablishments.length > 1 && (
                      <p className="text-xs text-[#98A2B3]">+{profEstablishments.length - 1} autre{profEstablishments.length - 1 > 1 ? 's' : ''} établissement{profEstablishments.length - 1 > 1 ? 's' : ''}</p>
                    )}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {p.telephone && <span className="text-xs text-[#667085]">📞 {p.telephone}</span>}
                      {target && (
                        <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                          {target.visit_frequency_default}x/mois
                        </span>
                      )}
                      {target?.statut === 'ne_pas_visiter' && (
                        <span className="text-xs bg-[#FDE8E8] text-[#DC2626] font-semibold px-2 py-0.5 rounded-full">
                          ⛔ Ne pas visiter
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleEdit(p)}
                      className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                    <button onClick={() => handleDelete(p.id)}
                      className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ===== Formulaire identité (création / édition) =====
function ProfessionalForm({ form, set, editing, saving, establishments, TYPES, onCancel, onSave }) {
  return (
    <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
        <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
          {editing ? 'Modifier le professionnel' : 'Nouveau professionnel'}
        </h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Prénom *</label>
              <input value={form.prenom} onChange={e => set('prenom', e.target.value)}
                className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)}
                className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
              <option value="">Sélectionner...</option>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Spécialité</label>
            <input value={form.specialite} onChange={e => set('specialite', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
              placeholder="Ex: Cardiologue, Pédiatre..." />
          </div>

          {!editing && (
            <div>
              <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Établissement de départ *</label>
              <select value={form.establishment_id} onChange={e => set('establishment_id', e.target.value)}
                className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="">Sélectionner...</option>
                {establishments.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
              <p className="text-xs text-[#98A2B3] mt-1">
                D'autres établissements pourront être ajoutés ensuite depuis la fiche du professionnel.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
            <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
              placeholder="00223XXXXXXXX" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
              placeholder="Observations..." />
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
              Annuler
            </button>
            <button onClick={onSave} disabled={saving}
              className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
