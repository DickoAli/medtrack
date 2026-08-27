import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionCampagnes({ onBack, profile }) {
  const [campagnes, setCampagnes] = useState([])
  const [laboratoires, setLaboratoires] = useState([])
  const [produits, setProduits] = useState([])
  const [professionnels, setProfessionnels] = useState([])
  const [delegates, setDelegates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
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
    draft: 'bg-slate-100 text-slate-500',
    active: 'bg-teal-100 text-teal-600',
    paused: 'bg-amber-100 text-amber-600',
    completed: 'bg-blue-100 text-blue-600',
    cancelled: 'bg-rose-100 text-rose-500'
  }
  const STATUT_LABELS = {
    draft: 'Brouillon', active: 'Active',
    paused: 'En pause', completed: 'Terminée', cancelled: 'Annulée'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: c }, { data: l }, { data: p }, { data: hcp }, { data: d }] = await Promise.all([
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).order('created_at', { ascending: false }),
      supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id).eq('statut', 'actif'),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('statut_produit', 'Normal'),
      supabase.from('healthcare_professionals').select('*').eq('agence_id', profile.agence_id).eq('statut', 'actif'),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id)
    ])
    setCampagnes(c || [])
    setLaboratoires(l || [])
    setProduits(p || [])
    setProfessionnels(hcp || [])
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
      await supabase.from('campaigns').update(data).eq('id', editing)
    } else {
      const { data: newCampaign } = await supabase.from('campaigns').insert(data).select().single()
      campaignId = newCampaign?.id
    }

    if (campaignId) {
      // Supprimer anciens produits et cibles
      await supabase.from('campaign_products').delete().eq('campaign_id', campaignId)
      await supabase.from('campaign_targets').delete().eq('campaign_id', campaignId)

      // Insérer nouveaux produits
      if (form.produits_ids.length > 0) {
        await supabase.from('campaign_products').insert(
          form.produits_ids.map((pid, i) => ({
            campaign_id: campaignId,
            produit_id: pid,
            is_primary: i === 0
          }))
        )
      }

      // Insérer nouvelles cibles
      if (form.targets_ids.length > 0) {
        await supabase.from('campaign_targets').insert(
          form.targets_ids.map(hid => ({
            campaign_id: campaignId,
            healthcare_professional_id: hid,
            visit_frequency: form.visit_frequency
          }))
        )
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
    const { data: ct } = await supabase.from('campaign_targets').select('healthcare_professional_id').eq('campaign_id', c.id)

    setEditing(c.id)
    setForm({
      nom: c.nom, description: c.description || '',
      laboratoire_id: c.laboratoire_id,
      start_date: c.start_date, end_date: c.end_date,
      statut: c.statut, visit_frequency: c.visit_frequency || 1,
      visits_objective: c.visits_objective || '',
      produits_ids: cp?.map(x => x.produit_id) || [],
      targets_ids: ct?.map(x => x.healthcare_professional_id) || []
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette campagne ?')) return
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Campagnes</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Créer
        </button>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier la campagne' : 'Nouvelle campagne'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Lancement CardioPlus Q1 2025" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Début *</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fin *</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fréquence/mois</label>
                  <input type="number" value={form.visit_frequency} onChange={e => set('visit_frequency', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    min="1" max="12" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objectif total</label>
                  <input type="number" value={form.visits_objective} onChange={e => set('visits_objective', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nb visites" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="draft">Brouillon</option>
                  <option value="active">Active</option>
                  <option value="paused">En pause</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>

              {/* Produits */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Produits promus ({form.produits_ids.length} sélectionné{form.produits_ids.length > 1 ? 's' : ''})
                </label>
                <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {produits
                    .filter(p => !form.laboratoire_id || p.laboratoire_id === form.laboratoire_id)
                    .map(p => (
                      <button key={p.id} type="button"
                        onClick={() => toggleItem('produits_ids', p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          form.produits_ids.includes(p.id)
                            ? 'bg-teal-400 text-blue-950 border-teal-400'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}>
                        {p.nom}
                      </button>
                    ))}
                </div>
              </div>

              {/* Cibles */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cibles ({form.targets_ids.length} sélectionné{form.targets_ids.length > 1 ? 's' : ''})
                </label>
                <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {professionnels.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => toggleItem('targets_ids', p.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors text-left ${
                        form.targets_ids.includes(p.id)
                          ? 'bg-blue-950 text-white border-blue-950'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                        p.potential === 'A' ? 'bg-rose-500 text-white' :
                        p.potential === 'B' ? 'bg-amber-400 text-white' : 'bg-slate-300 text-white'
                      }`}>{p.potential}</span>
                      {p.prenom} {p.nom}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Objectifs, contexte..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="p-6 flex flex-col gap-3">
        {campagnes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-slate-400 text-sm font-bold">Aucune campagne créée</p>
            <p className="text-slate-300 text-xs mt-1">Créez votre première campagne pour organiser les visites terrain</p>
          </div>
        ) : (
          campagnes.map(c => (
            <div key={c.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              c.statut === 'active' ? 'border-teal-400' :
              c.statut === 'paused' ? 'border-amber-400' :
              c.statut === 'completed' ? 'border-blue-400' :
              c.statut === 'cancelled' ? 'border-rose-400' : 'border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-black text-blue-950">{c.nom}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut]}`}>
                      {STATUT_LABELS[c.statut]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">🧪 {c.laboratoires?.nom}</p>
                  <p className="text-xs text-slate-400">
                    📅 {new Date(c.start_date).toLocaleDateString('fr-FR')} → {new Date(c.end_date).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                      {c.visit_frequency}x/mois
                    </span>
                    {c.visits_objective && (
                      <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">
                        Obj: {c.visits_objective} visites
                      </span>
                    )}
                  </div>

                  {/* Actions statut */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {c.statut === 'draft' && (
                      <button onClick={() => changeStatut(c.id, 'active')}
                        className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-1 rounded-lg">
                        ▶ Activer
                      </button>
                    )}
                    {c.statut === 'active' && (
                      <button onClick={() => changeStatut(c.id, 'paused')}
                        className="text-xs bg-amber-50 text-amber-600 font-bold px-2 py-1 rounded-lg">
                        ⏸ Pause
                      </button>
                    )}
                    {c.statut === 'paused' && (
                      <button onClick={() => changeStatut(c.id, 'active')}
                        className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-1 rounded-lg">
                        ▶ Reprendre
                      </button>
                    )}
                    {(c.statut === 'active' || c.statut === 'paused') && (
                      <button onClick={() => changeStatut(c.id, 'completed')}
                        className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded-lg">
                        ✓ Terminer
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(c)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(c.id)}
                    className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}