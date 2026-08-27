import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function PlanificationVisites({ onBack, profile }) {
  const [plans, setPlans] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [etablissements, setEtablissements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterDelegate, setFilterDelegate] = useState('tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [form, setForm] = useState({
    delegate_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: '',
    visit_type: 'planned', planned_date: '',
    planned_time: '', planned_duration: 30,
    companion_id: '', notes: ''
  })

  const VISIT_TYPES = {
    planned: 'Planifiée', accompanied: 'Accompagnée',
    coaching: 'Coaching', followup: 'Suivi', unplanned: 'Non planifiée'
  }
  const STATUT_COLORS = {
    pending: 'bg-amber-100 text-amber-600',
    confirmed: 'bg-teal-100 text-teal-600',
    done: 'bg-blue-100 text-blue-600',
    cancelled: 'bg-rose-100 text-rose-500',
    rescheduled: 'bg-purple-100 text-purple-600'
  }
  const STATUT_LABELS = {
    pending: 'En attente', confirmed: 'Confirmée',
    done: 'Réalisée', cancelled: 'Annulée', rescheduled: 'Reprogrammée'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: pl }, { data: d }, { data: c }, { data: po }, { data: e }] = await Promise.all([
      supabase.from('visit_plans')
        .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, potential), establishments(nom), campaigns(nom)')
        .eq('agence_id', profile.agence_id)
        .order('planned_date', { ascending: true }),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).eq('statut', 'active'),
      supabase.from('delegate_portfolios')
        .select('*, healthcare_professionals(id, nom, prenom, potential, specialite)')
        .eq('agence_id', profile.agence_id),
      supabase.from('establishments').select('*').eq('agence_id', profile.agence_id).eq('is_active', true).order('nom')
    ])
    setPlans(pl || [])
    setDelegates(d || [])
    setCampagnes(c || [])
    setPortfolios(po || [])
    setEtablissements(e || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    delegate_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: '',
    visit_type: 'planned', planned_date: '',
    planned_time: '', planned_duration: 30,
    companion_id: '', notes: ''
  })

  // Cibles disponibles selon délégué sélectionné
  const ciblesDelegate = portfolios.filter(p => p.delegate_id === form.delegate_id)

  const handleSave = async () => {
    if (!form.delegate_id) { alert('Sélectionnez un délégué'); return }
    if (!form.healthcare_professional_id) { alert('Sélectionnez une cible'); return }
    if (!form.planned_date) { alert('La date est obligatoire'); return }
    setSaving(true)

    const data = {
      agence_id: profile.agence_id,
      delegate_id: form.delegate_id,
      healthcare_professional_id: form.healthcare_professional_id,
      establishment_id: form.establishment_id || null,
      campaign_id: form.campaign_id || null,
      visit_type: form.visit_type,
      planned_date: form.planned_date,
      planned_time: form.planned_time || null,
      planned_duration: parseInt(form.planned_duration) || 30,
      companion_id: form.companion_id || null,
      notes: form.notes,
      created_by: profile.id,
      updated_at: new Date().toISOString()
    }

    if (editing) {
      await supabase.from('visit_plans').update(data).eq('id', editing)
    } else {
      await supabase.from('visit_plans').insert(data)
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg('Visite planifiée !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({
      delegate_id: p.delegate_id,
      healthcare_professional_id: p.healthcare_professional_id,
      establishment_id: p.establishment_id || '',
      campaign_id: p.campaign_id || '',
      visit_type: p.visit_type || 'planned',
      planned_date: p.planned_date,
      planned_time: p.planned_time || '',
      planned_duration: p.planned_duration || 30,
      companion_id: p.companion_id || '',
      notes: p.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette planification ?')) return
    await supabase.from('visit_plans').delete().eq('id', id)
    fetchAll()
  }

  const changeStatut = async (id, statut) => {
    await supabase.from('visit_plans').update({ statut }).eq('id', id)
    fetchAll()
  }

  const filtered = plans.filter(p => {
    const matchDelegate = filterDelegate === 'tous' || p.delegate_id === filterDelegate
    const matchStatut = filterStatut === 'tous' || p.statut === filterStatut
    return matchDelegate && matchStatut
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayPlans = filtered.filter(p => p.planned_date === today)
  const futurePlans = filtered.filter(p => p.planned_date > today)
  const pastPlans = filtered.filter(p => p.planned_date < today)

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  const PlanCard = ({ p }) => (
    <div className={`bg-white rounded-2xl p-4 border-l-4 ${
      p.statut === 'confirmed' ? 'border-teal-400' :
      p.statut === 'done' ? 'border-blue-400' :
      p.statut === 'cancelled' ? 'border-rose-400' :
      p.statut === 'rescheduled' ? 'border-purple-400' : 'border-amber-400'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut]}`}>
              {STATUT_LABELS[p.statut]}
            </span>
            <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
              {VISIT_TYPES[p.visit_type]}
            </span>
          </div>

          <p className="font-black text-blue-950 text-sm">
            {p.healthcare_professionals?.prenom} {p.healthcare_professionals?.nom}
          </p>
          <p className="text-xs text-slate-400">
            👤 {p.delegates?.prenom} {p.delegates?.nom}
          </p>
          {p.establishments && (
            <p className="text-xs text-slate-400">🏥 {p.establishments.nom}</p>
          )}
          {p.campaigns && (
            <p className="text-xs text-slate-400">🎯 {p.campaigns.nom}</p>
          )}
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs font-bold text-blue-950">
              📅 {new Date(p.planned_date).toLocaleDateString('fr-FR')}
              {p.planned_time && ` à ${p.planned_time.slice(0, 5)}`}
            </span>
            {p.planned_duration && (
              <span className="text-xs text-slate-400">⏱ {p.planned_duration} min</span>
            )}
          </div>
          {p.notes && <p className="text-xs text-slate-400 italic mt-1">{p.notes}</p>}

          {/* Actions */}
          {p.statut === 'pending' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => changeStatut(p.id, 'confirmed')}
                className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-1 rounded-lg">
                ✓ Confirmer
              </button>
              <button onClick={() => changeStatut(p.id, 'cancelled')}
                className="text-xs bg-rose-50 text-rose-500 font-bold px-2 py-1 rounded-lg">
                ✕ Annuler
              </button>
              <button onClick={() => changeStatut(p.id, 'rescheduled')}
                className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-1 rounded-lg">
                ↻ Reprogrammer
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => handleEdit(p)}
            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
          <button onClick={() => handleDelete(p.id)}
            className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Planification</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {plans.length} visite{plans.length > 1 ? 's' : ''} planifiée{plans.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Planifier
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', 'pending', 'confirmed', 'done', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                filterStatut === s ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              {s === 'tous' ? 'Tous' : STATUT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier la planification' : 'Planifier une visite'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Délégué *</label>
                <select value={form.delegate_id} onChange={e => { set('delegate_id', e.target.value); set('healthcare_professional_id', '') }}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              {form.delegate_id && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Cible * ({ciblesDelegate.length} dans le portefeuille)
                  </label>
                  <select value={form.healthcare_professional_id} onChange={e => set('healthcare_professional_id', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                    <option value="">Sélectionner...</option>
                    {ciblesDelegate.map(c => (
                      <option key={c.id} value={c.healthcare_professionals.id}>
                        [{c.healthcare_professionals.potential}] {c.healthcare_professionals.prenom} {c.healthcare_professionals.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de visite</label>
                <select value={form.visit_type} onChange={e => set('visit_type', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  {Object.entries(VISIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campagne</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Établissement</label>
                <select value={form.establishment_id} onChange={e => set('establishment_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date *</label>
                  <input type="date" value={form.planned_date} onChange={e => set('planned_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Heure</label>
                  <input type="time" value={form.planned_time} onChange={e => set('planned_time', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Durée prévue (min)</label>
                <input type="number" value={form.planned_duration} onChange={e => set('planned_duration', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  min="5" max="120" />
              </div>

              {form.visit_type === 'accompanied' || form.visit_type === 'coaching' ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manager accompagnateur</label>
                  <input value={form.companion_id} onChange={e => set('companion_id', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="ID du manager..." />
                </div>
              ) : null}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Instructions, objectifs..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? 'Enregistrement...' : 'Planifier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste par période */}
      <div className="p-6 flex flex-col gap-4 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-slate-400 text-sm font-bold">Aucune visite planifiée</p>
          </div>
        ) : (
          <>
            {todayPlans.length > 0 && (
              <div>
                <p className="text-xs font-black text-amber-500 uppercase tracking-wider mb-2">
                  Aujourd'hui ({todayPlans.length})
                </p>
                <div className="flex flex-col gap-3">
                  {todayPlans.map(p => <PlanCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
            {futurePlans.length > 0 && (
              <div>
                <p className="text-xs font-black text-teal-500 uppercase tracking-wider mb-2">
                  À venir ({futurePlans.length})
                </p>
                <div className="flex flex-col gap-3">
                  {futurePlans.map(p => <PlanCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
            {pastPlans.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  Passées ({pastPlans.length})
                </p>
                <div className="flex flex-col gap-3">
                  {pastPlans.map(p => <PlanCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}