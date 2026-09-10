import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionObjectifs({ onBack, profile }) {
  const [objectifs, setObjectifs] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [form, setForm] = useState({
    delegate_id: '', campaign_id: '',
    mois: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    objectif_visites: 20, objectif_medecins: 10
  })

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: o }, { data: d }, { data: c }, { data: v }] = await Promise.all([
      supabase.from('objectifs').select('*, delegates(nom, prenom)').eq('agence_id', profile.agence_id).order('mois', { ascending: false }),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).eq('statut', 'active'),
      supabase.from('visites').select('delegate_id, statut, created_at, healthcare_professional_id').eq('agence_id', profile.agence_id)
    ])
    setObjectifs(o || [])
    setDelegates(d || [])
    setCampagnes(c || [])
    setVisites(v || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    delegate_id: '', campaign_id: '',
    mois: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    objectif_visites: 20, objectif_medecins: 10
  })

  const handleSave = async () => {
    if (!form.delegate_id) { alert('Sélectionnez un délégué'); return }
    if (!form.mois) { alert('Sélectionnez un mois'); return }
    setSaving(true)

    const existing = objectifs.find(o => o.delegate_id === form.delegate_id && o.mois === form.mois)

    if (existing) {
      await supabase.from('objectifs').update({
        objectif_visites: parseInt(form.objectif_visites),
        objectif_medecins: parseInt(form.objectif_medecins)
      }).eq('id', existing.id)
    } else {
      await supabase.from('objectifs').insert({
        delegate_id: form.delegate_id, mois: form.mois,
        objectif_visites: parseInt(form.objectif_visites),
        objectif_medecins: parseInt(form.objectif_medecins),
        agence_id: profile.agence_id
      })
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Objectif enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const getStats = (delegateId, mois) => {
    const [year, month] = mois.split('-').map(Number)
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`
    const dvs = visites.filter(v =>
      v.delegate_id === delegateId && v.statut === 'Réalisée' &&
      v.created_at >= monthStart && v.created_at <= monthEnd
    )
    const medecins = new Set(dvs.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size
    return { visites: dvs.length, medecins }
  }

  const filteredObjectifs = objectifs.filter(o => {
    const [y, m] = o.mois.split('-').map(Number)
    return m === filterMonth && y === filterYear
  })

  const allDelegatesWithObjectifs = delegates.map(d => {
    const obj = filteredObjectifs.find(o => o.delegate_id === d.id)
    const stats = getStats(d.id, `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
    const progressVisites = obj ? Math.min(Math.round((stats.visites / obj.objectif_visites) * 100), 100) : 0
    const progressMedecins = obj ? Math.min(Math.round((stats.medecins / obj.objectif_medecins) * 100), 100) : 0
    return { ...d, obj, stats, progressVisites, progressMedecins }
  })

  const progressColor = (v) => v >= 80 ? '#087F5B' : v >= 50 ? '#F59E0B' : '#DC2626'

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
            <h1 className="text-white font-semibold text-base">Objectifs</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {MONTHS[filterMonth - 1]} {filterYear}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Définir
        </button>
      </div>

      <div className="px-5 pt-4 grid grid-cols-2 gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Définir un objectif</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mois *</label>
                <input type="month" value={form.mois} onChange={e => set('mois', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Campagne (optionnel)</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Objectif visites</label>
                <input type="number" value={form.objectif_visites}
                  onChange={e => set('objectif_visites', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  min="1" max="200" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Objectif cibles à couvrir</label>
                <input type="number" value={form.objectif_medecins}
                  onChange={e => set('objectif_medecins', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  min="1" max="200" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 pb-10">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
            <p className="text-lg font-semibold text-[#172B4D]">
              {allDelegatesWithObjectifs.reduce((s, d) => s + d.stats.visites, 0)}
            </p>
            <p className="text-xs text-[#667085] mt-1">Visites</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
            <p className="text-lg font-semibold text-[#172B4D]">
              {allDelegatesWithObjectifs.reduce((s, d) => s + (d.obj?.objectif_visites || 0), 0)}
            </p>
            <p className="text-xs text-[#667085] mt-1">Objectif</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]">
            <p className="text-lg font-semibold text-[#172B4D]">
              {allDelegatesWithObjectifs.filter(d => d.obj).length > 0
                ? Math.round(allDelegatesWithObjectifs.filter(d => d.obj).reduce((s, d) => s + d.progressVisites, 0) / allDelegatesWithObjectifs.filter(d => d.obj).length)
                : 0}%
            </p>
            <p className="text-xs text-[#667085] mt-1">Moy.</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Suivi par délégué</p>

        {allDelegatesWithObjectifs.map(d => (
          <div key={d.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${d.obj ? progressColor(d.progressVisites) : '#DDE4EA'}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                {!d.obj && <p className="text-xs text-[#98A2B3]">Aucun objectif défini</p>}
              </div>
              {d.obj && (
                <button onClick={() => {
                  set('delegate_id', d.id)
                  set('mois', `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
                  set('objectif_visites', d.obj.objectif_visites)
                  set('objectif_medecins', d.obj.objectif_medecins)
                  setShowForm(true)
                }} className="bg-[#E8F0FE] text-[#2563EB] px-2 py-1 rounded-lg text-xs font-semibold">
                  ✏️
                </button>
              )}
            </div>

            {d.obj ? (
              <>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#667085] font-medium">Visites réalisées</span>
                    <span className="font-semibold" style={{ color: progressColor(d.progressVisites) }}>
                      {d.stats.visites} / {d.obj.objectif_visites} ({d.progressVisites}%)
                    </span>
                  </div>
                  <div className="bg-[#EEF1F4] rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all"
                      style={{ width: `${d.progressVisites}%`, background: progressColor(d.progressVisites) }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#667085] font-medium">Cibles couvertes</span>
                    <span className="font-semibold" style={{ color: progressColor(d.progressMedecins) }}>
                      {d.stats.medecins} / {d.obj.objectif_medecins} ({d.progressMedecins}%)
                    </span>
                  </div>
                  <div className="bg-[#EEF1F4] rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all"
                      style={{ width: `${d.progressMedecins}%`, background: '#2563EB' }} />
                  </div>
                </div>
              </>
            ) : (
              <button onClick={() => {
                set('delegate_id', d.id)
                set('mois', `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
                setShowForm(true)
              }} className="w-full bg-[#F4F7F9] text-[#98A2B3] font-semibold py-2 rounded-lg text-xs border border-dashed border-[#DDE4EA]">
                + Définir un objectif
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
