import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionCampagnes({ onBack, profile }) {
  const [campagnes, setCampagnes] = useState([])
  const [laboratoires, setLaboratoires] = useState([])
  const [produits, setProduits] = useState([])
  const [commercialTargets, setCommercialTargets] = useState([])
  const [delegates, setDelegates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    nom: '', description: '', laboratoire_id: '',
    start_date: '', end_date: '', statut: 'draft',
    visit_frequency: 1, visits_objective: '',
    produits_ids: [], targets_ids: []
  })

  const STATUT_COLORS = {
    draft: 'bg-[#EEF1F4] text-[#667085]',
    active: 'bg-[#E7F5EF] text-[#087F5B]',
    paused: 'bg-[#FEF3E2] text-[#B45309]',
    completed: 'bg-[#E8F0FE] text-[#2563EB]',
    cancelled: 'bg-[#FDE8E8] text-[#DC2626]'
  }
  const STATUT_LABELS = {
    draft: 'Brouillon', active: 'Active',
    paused: 'En pause', completed: 'Terminée', cancelled: 'Annulée'
  }
  const STATUT_BORDER = {
    draft: '#DDE4EA', active: '#087F5B', paused: '#F59E0B',
    completed: '#2563EB', cancelled: '#DC2626'
  }
  const PRIORITY_COLORS = {
    A: 'bg-[#FDE8E8] text-[#DC2626]',
    B: 'bg-[#FEF3E2] text-[#B45309]',
    C: 'bg-[#EEF1F4] text-[#667085]'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: c }, { data: l }, { data: p }, { data: ct }, { data: d }] = await Promise.all([
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).order('created_at', { ascending: false }),
      supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('commercial_targets')
        .select('*, healthcare_professionals(id, nom, prenom, specialite)')
        .eq('agence_id', profile.agence_id)
        .eq('statut', 'actif'),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id)
    ])
    setCampagnes(c || [])
    setLaboratoires(l || [])
    setProduits(p || [])
    setCommercialTargets(ct || [])
    setDelegates(d || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleItem = (key, id) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id]
    }))
  }

  const resetForm = () => setForm({
    nom: '', description: '', laboratoire_id: '',
    start_date: '', end_date: '', statut: 'draft',
    visit_frequency: 1, visits_objective: '',
    produits_ids: [], targets_ids: []
  })

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.laboratoire_id) { alert('Sélectionnez un laboratoire'); return }
    if (!form.start_date || !form.end_date) { alert('Les dates sont obligatoires'); return }
    setSaving(true)

    const data = {
      nom: form.nom, description: form.description,
      laboratoire_id: form.laboratoire_id,
      start_date: form.start_date, end_date: form.end_date,
      statut: form.statut,
      visit_frequency: parseInt(form.visit_frequency) || 1,
      visits_objective: form.visits_objective ? parseInt(form.visits_objective) : null,
      agence_id: profile.agence_id,
      created_by: profile.id,
      updated_at: new Date().toISOString()
    }

    let campaignId = editing

    if (editing) {
      const { error } = await supabase.from('campaigns').update(data).eq('id', editing)
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    } else {
      const { data: newCampaign, error } = await supabase.from('campaigns').insert(data).select().single()
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
      campaignId = newCampaign?.id
    }

    if (campaignId) {
      await supabase.from('campaign_products').delete().eq('campaign_id', campaignId)
      await supabase.from('campaign_targets').delete().eq('campaign_id', campaignId)

      if (form.produits_ids.length > 0) {
        await supabase.from('campaign_products').insert(
          form.produits_ids.map((pid, i) => ({
            campaign_id: campaignId, produit_id: pid, is_primary: i === 0
          }))
        )
      }

      if (form.targets_ids.length > 0) {
        const rows = form.targets_ids.map(commercialTargetId => {
          const ct = commercialTargets.find(x => x.id === commercialTargetId)
          return {
            agence_id: profile.agence_id,
            campaign_id: campaignId,
            commercial_target_id: commercialTargetId,
            healthcare_professional_id: ct?.healthcare_professional_id, // ancienne colonne, toujours NOT NULL — conservée jusqu'au nettoyage final
            priority: ct?.priority || 'B',
            visit_frequency: form.visit_frequency
          }
        })
        const { error: targetsError } = await supabase.from('campaign_targets').insert(rows)
        if (targetsError) {
          alert('La campagne a été enregistrée, mais l\'affectation des cibles a échoué : ' + targetsError.message)
        }
      }
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg('Campagne enregistrée !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = async (c) => {
    const { data: cp } = await supabase.from('campaign_products').select('produit_id').eq('campaign_id', c.id)
    const { data: ctar } = await supabase.from('campaign_targets').select('commercial_target_id').eq('campaign_id', c.id)

    setEditing(c.id)
    setForm({
      nom: c.nom, description: c.description || '',
      laboratoire_id: c.laboratoire_id,
      start_date: c.start_date, end_date: c.end_date,
      statut: c.statut, visit_frequency: c.visit_frequency || 1,
      visits_objective: c.visits_objective || '',
      produits_ids: cp?.map(x => x.produit_id) || [],
      targets_ids: ctar?.map(x => x.commercial_target_id) || []
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette campagne ? Les affectations de portefeuille liées à cette campagne devront être gérées séparément.')) return
    await supabase.from('campaign_products').delete().eq('campaign_id', id)
    await supabase.from('campaign_targets').delete().eq('campaign_id', id)
    await supabase.from('campaigns').delete().eq('id', id)
    fetchAll()
  }

  const changeStatut = async (id, statut) => {
    await supabase.from('campaigns').update({ statut }).eq('id', id)
    fetchAll()
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Campagnes</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs"
        >
          + Créer
        </button>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
          <p className="text-[#087F5B] font-semibold">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier la campagne' : 'Nouvelle campagne'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Lancement CardioPlus Q1 2025" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Début *</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Fin *</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Fréquence/mois</label>
                  <input type="number" value={form.visit_frequency} onChange={e => set('visit_frequency', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                    min="1" max="12" />
                  <p className="text-xs text-[#98A2B3] mt-1">Surcharge la fréquence par défaut de chaque cible pour cette campagne.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Objectif total</label>
                  <input type="number" value={form.visits_objective} onChange={e => set('visits_objective', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                    placeholder="Nb visites" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="draft">Brouillon</option>
                  <option value="active">Active</option>
                  <option value="paused">En pause</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Produits promus ({form.produits_ids.length} sélectionné{form.produits_ids.length > 1 ? 's' : ''})
                </label>
                {produits.length === 0 ? (
                  <p className="text-xs text-[#98A2B3] mt-2">
                    Aucun produit dans votre catalogue. Ajoutez-en depuis "Produits" (Produits &amp; business) avant de créer une campagne.
                  </p>
                ) : (() => {
                  const produitsFiltres = produits.filter(p => !form.laboratoire_id || p.laboratoire_id === form.laboratoire_id)
                  return produitsFiltres.length === 0 ? (
                    <p className="text-xs text-[#98A2B3] mt-2">
                      Aucun produit rattaché à ce laboratoire. {produits.length} produit{produits.length > 1 ? 's' : ''} existe{produits.length > 1 ? 'nt' : ''} au total dans d'autres laboratoires.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {produitsFiltres.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => toggleItem('produits_ids', p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            form.produits_ids.includes(p.id)
                              ? 'bg-[#087F5B] text-white border-[#087F5B]'
                              : 'bg-white text-[#667085] border-[#DDE4EA]'
                          }`}>
                          {p.nom}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Cibles ({form.targets_ids.length} sélectionnée{form.targets_ids.length > 1 ? 's' : ''})
                </label>
                {commercialTargets.length === 0 ? (
                  <p className="text-xs text-[#98A2B3] mt-2">
                    Aucune cible commerciale qualifiée. Qualifiez des professionnels depuis "Professionnels" d'abord.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {commercialTargets.map(ct => {
                      const pro = ct.healthcare_professionals
                      return (
                        <button key={ct.id} type="button"
                          onClick={() => toggleItem('targets_ids', ct.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-left ${
                            form.targets_ids.includes(ct.id)
                              ? 'bg-[#172B4D] text-white border-[#172B4D]'
                              : 'bg-white text-[#667085] border-[#DDE4EA]'
                          }`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                            form.targets_ids.includes(ct.id) ? 'bg-white/20 text-white' : PRIORITY_COLORS[ct.priority]
                          }`}>{ct.priority}</span>
                          <span className="truncate">{pro?.prenom} {pro?.nom}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-[#98A2B3] mt-1">
                  Le badge affiche le potentiel par défaut de chaque cible commerciale.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Objectifs, contexte..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3">
        {campagnes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-[#667085] text-sm font-medium">Aucune campagne créée</p>
            <p className="text-[#98A2B3] text-xs mt-1">Créez votre première campagne pour organiser les visites terrain</p>
          </div>
        ) : (
          campagnes.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${STATUT_BORDER[c.statut]}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-[#172B4D]">{c.nom}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut]}`}>
                      {STATUT_LABELS[c.statut]}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">🧪 {c.laboratoires?.nom}</p>
                  <p className="text-xs text-[#667085]">
                    📅 {new Date(c.start_date).toLocaleDateString('fr-FR')} → {new Date(c.end_date).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                      {c.visit_frequency}x/mois
                    </span>
                    {c.visits_objective && (
                      <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">
                        Obj: {c.visits_objective} visites
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    {c.statut === 'draft' && (
                      <button onClick={() => changeStatut(c.id, 'active')}
                        className="text-xs bg-[#E7F5EF] text-[#087F5B] font-semibold px-2 py-1 rounded-lg">
                        ▶ Activer
                      </button>
                    )}
                    {c.statut === 'active' && (
                      <button onClick={() => changeStatut(c.id, 'paused')}
                        className="text-xs bg-[#FEF3E2] text-[#B45309] font-semibold px-2 py-1 rounded-lg">
                        ⏸ Pause
                      </button>
                    )}
                    {c.statut === 'paused' && (
                      <button onClick={() => changeStatut(c.id, 'active')}
                        className="text-xs bg-[#E7F5EF] text-[#087F5B] font-semibold px-2 py-1 rounded-lg">
                        ▶ Reprendre
                      </button>
                    )}
                    {(c.statut === 'active' || c.statut === 'paused') && (
                      <button onClick={() => changeStatut(c.id, 'completed')}
                        className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-1 rounded-lg">
                        ✓ Terminer
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(c)}
                    className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                  <button onClick={() => handleDelete(c.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
