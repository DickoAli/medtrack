import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function PlanificationVisites({ onBack, profile }) {
  const [plans, setPlans] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [etablissements, setEtablissements] = useState([])
  const [companions, setCompanions] = useState([]) // managers et country managers pouvant accompagner
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [rescheduling, setRescheduling] = useState(false) // true = on choisit une nouvelle date
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
    pending: 'bg-[#FEF3E2] text-[#B45309]',
    confirmed: 'bg-[#E7F5EF] text-[#087F5B]',
    done: 'bg-[#E8F0FE] text-[#2563EB]',
    cancelled: 'bg-[#FDE8E8] text-[#DC2626]',
    rescheduled: 'bg-[#EEF1F4] text-[#667085]'
  }
  const STATUT_BORDER = {
    pending: '#F59E0B', confirmed: '#087F5B', done: '#2563EB', cancelled: '#DC2626', rescheduled: '#98A2B3'
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
        .select('*, commercial_targets(priority, healthcare_professionals(id, nom, prenom, specialite))')
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

  useEffect(() => {
    supabase.from('profiles')
      .select('id, role, managers(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .in('role', ['manager', 'country_manager'])
      .then(({ data, error }) => {
        if (error) console.error('Erreur chargement des managers:', error)
        setCompanions(data || [])
      })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Visite en duo : si c'est un manager qui planifie, il est proposé par défaut comme accompagnateur
  useEffect(() => {
    const duo = form.visit_type === 'accompanied' || form.visit_type === 'coaching'
    if (duo && !form.companion_id && ['manager', 'country_manager'].includes(profile.role)) {
      setForm(f => ({ ...f, companion_id: profile.id }))
    }
  }, [form.visit_type])

  const resetForm = () => setForm({
    delegate_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: '',
    visit_type: 'planned', planned_date: '',
    planned_time: '', planned_duration: 30,
    companion_id: '', notes: ''
  })

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

    let error
    if (editing) {
      ({ error } = await supabase.from('visit_plans')
        .update(rescheduling ? { ...data, statut: 'pending' } : data)
        .eq('id', editing))
    } else {
      // Statut explicite : l'app délégué n'affiche que 'pending' et 'confirmed',
      // on ne dépend donc plus d'une valeur par défaut en base.
      ({ error } = await supabase.from('visit_plans').insert({ ...data, statut: 'pending' }))
    }

    setSaving(false)
    if (error) {
      console.error('Erreur planification visite:', error)
      alert('La visite n\'a pas été enregistrée : ' + error.message)
      return
    }
    setShowForm(false)
    setEditing(null)
    setRescheduling(false)
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
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  const PlanCard = ({ p }) => (
    <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${STATUT_BORDER[p.statut]}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut]}`}>
              {STATUT_LABELS[p.statut]}
            </span>
            <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">
              {VISIT_TYPES[p.visit_type]}
            </span>
          </div>

          <p className="font-semibold text-[#172B4D] text-sm">
            {p.healthcare_professionals?.prenom} {p.healthcare_professionals?.nom}
          </p>
          <p className="text-xs text-[#667085]">
            👤 {p.delegates?.prenom} {p.delegates?.nom}
          </p>
          {p.establishments && (
            <p className="text-xs text-[#667085]">🏥 {p.establishments.nom}</p>
          )}
          {p.campaigns && (
            <p className="text-xs text-[#667085]">🎯 {p.campaigns.nom}</p>
          )}
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs font-semibold text-[#172B4D]">
              📅 {new Date(p.planned_date).toLocaleDateString('fr-FR')}
              {p.planned_time && ` à ${p.planned_time.slice(0, 5)}`}
            </span>
            {p.planned_duration && (
              <span className="text-xs text-[#667085]">⏱ {p.planned_duration} min</span>
            )}
          </div>
          {p.notes && <p className="text-xs text-[#667085] italic mt-1">{p.notes}</p>}

          {['pending', 'confirmed', 'rescheduled'].includes(p.statut) && (
            <div className="flex gap-2 mt-2">
              {p.statut !== 'confirmed' && (
                <button onClick={() => changeStatut(p.id, 'confirmed')}
                  className="text-xs bg-[#E7F5EF] text-[#087F5B] font-semibold px-2 py-1 rounded-lg">
                  ✓ Confirmer
                </button>
              )}
              <button onClick={() => changeStatut(p.id, 'cancelled')}
                className="text-xs bg-[#FDE8E8] text-[#DC2626] font-semibold px-2 py-1 rounded-lg">
                ✕ Annuler
              </button>
              <button onClick={() => { handleEdit(p); setRescheduling(true) }}
                className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-1 rounded-lg">
                ↻ Reprogrammer
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => handleEdit(p)}
            className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
          <button onClick={() => handleDelete(p.id)}
            className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Planification</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {plans.length} visite{plans.length > 1 ? 's' : ''} planifiée{plans.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs"
        >
          + Planifier
        </button>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', 'pending', 'confirmed', 'done', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                filterStatut === s ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
              }`}>
              {s === 'tous' ? 'Tous' : STATUT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {rescheduling ? 'Reprogrammer : choisissez la nouvelle date' : editing ? 'Modifier la planification' : 'Planifier une visite'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Délégué *</label>
                <select value={form.delegate_id} onChange={e => { set('delegate_id', e.target.value); set('healthcare_professional_id', '') }}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              {form.delegate_id && (
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                    Cible * ({ciblesDelegate.length} dans le portefeuille)
                  </label>
                  <select value={form.healthcare_professional_id} onChange={e => set('healthcare_professional_id', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                    <option value="">Sélectionner...</option>
                    {ciblesDelegate.filter(c => c.commercial_targets?.healthcare_professionals).map(c => (
                      <option key={c.id} value={c.commercial_targets.healthcare_professionals.id}>
                        [{c.priority}] {c.commercial_targets.healthcare_professionals.prenom} {c.commercial_targets.healthcare_professionals.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type de visite</label>
                <select value={form.visit_type} onChange={e => set('visit_type', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  {Object.entries(VISIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Campagne</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Établissement</label>
                <select value={form.establishment_id} onChange={e => set('establishment_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Date *</label>
                  <input type="date" value={form.planned_date} onChange={e => set('planned_date', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Heure</label>
                  <input type="time" value={form.planned_time} onChange={e => set('planned_time', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Durée prévue (min)</label>
                <input type="number" value={form.planned_duration} onChange={e => set('planned_duration', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  min="5" max="120" />
              </div>

              {(form.visit_type === 'accompanied' || form.visit_type === 'coaching') && (
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Manager accompagnateur</label>
                  <select value={form.companion_id} onChange={e => set('companion_id', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                    <option value="">Sélectionner le manager...</option>
                    {companions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.managers ? `${c.managers.prenom} ${c.managers.nom}` : 'Compte sans fiche'}
                        {' — '}{c.role === 'country_manager' ? 'Country Manager' : 'Manager'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#98A2B3] mt-1">Le manager qui accompagne le délégué pendant cette visite.</p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Instructions, objectifs..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null); setRescheduling(false) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? 'Enregistrement...' : 'Planifier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-[#667085] text-sm font-medium">Aucune visite planifiée</p>
          </div>
        ) : (
          <>
            {todayPlans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#B45309] uppercase tracking-wide mb-2">
                  Aujourd'hui ({todayPlans.length})
                </p>
                <div className="flex flex-col gap-3">
                  {todayPlans.map(p => <PlanCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
            {futurePlans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#087F5B] uppercase tracking-wide mb-2">
                  À venir ({futurePlans.length})
                </p>
                <div className="flex flex-col gap-3">
                  {futurePlans.map(p => <PlanCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
            {pastPlans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
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
