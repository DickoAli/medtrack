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
    delegate_id: '',
    campaign_id: '',
    mois: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    objectif_visites: 20,
    objectif_medecins: 10
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
    delegate_id: '',
    campaign_id: '',
    mois: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    objectif_visites: 20,
    objectif_medecins: 10
  })

  const handleSave = async () => {
    if (!form.delegate_id) { alert('Sélectionnez un délégué'); return }
    if (!form.mois) { alert('Sélectionnez un mois'); return }
    setSaving(true)

    const existing = objectifs.find(o =>
      o.delegate_id === form.delegate_id && o.mois === form.mois
    )

    if (existing) {
      await supabase.from('objectifs').update({
        objectif_visites: parseInt(form.objectif_visites),
        objectif_medecins: parseInt(form.objectif_medecins)
      }).eq('id', existing.id)
    } else {
      await supabase.from('objectifs').insert({
        delegate_id: form.delegate_id,
        mois: form.mois,
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
      v.delegate_id === delegateId &&
      v.statut === 'Réalisée' &&
      v.created_at >= monthStart &&
      v.created_at <= monthEnd
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

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Objectifs</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {MONTHS[filterMonth - 1]} {filterYear}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Définir
        </button>
      </div>

      {/* Filtre mois/année */}
      <div className="px-6 pt-4 grid grid-cols-2 gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="p-3 rounded-xl border border-slate-200 bg-white text-sm" />
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-black text-blue-950 text-lg mb-4">Définir un objectif</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mois *</label>
                <input type="month" value={form.mois} onChange={e => set('mois', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campagne (optionnel)</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Objectif visites
                </label>
                <input type="number" value={form.objectif_visites}
                  onChange={e => set('objectif_visites', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  min="1" max="200" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Objectif cibles à couvrir
                </label>
                <input type="number" value={form.objectif_medecins}
                  onChange={e => set('objectif_medecins', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  min="1" max="200" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vue globale du mois */}
      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* KPIs globaux */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-teal-400">
            <p className="text-xl font-black text-blue-950">
              {allDelegatesWithObjectifs.reduce((s, d) => s + d.stats.visites, 0)}
            </p>
            <p className="text-xs text-slate-500 font-bold mt-1">Visites</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-blue-400">
            <p className="text-xl font-black text-blue-950">
              {allDelegatesWithObjectifs.reduce((s, d) => s + (d.obj?.objectif_visites || 0), 0)}
            </p>
            <p className="text-xs text-slate-500 font-bold mt-1">Objectif</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-purple-400">
            <p className="text-xl font-black text-blue-950">
              {allDelegatesWithObjectifs.filter(d => d.obj).length > 0
                ? Math.round(allDelegatesWithObjectifs.filter(d => d.obj).reduce((s, d) => s + d.progressVisites, 0) / allDelegatesWithObjectifs.filter(d => d.obj).length)
                : 0}%
            </p>
            <p className="text-xs text-slate-500 font-bold mt-1">Moy.</p>
          </div>
        </div>

        {/* Délégués */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          Suivi par délégué
        </p>

        {allDelegatesWithObjectifs.map(d => (
          <div key={d.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
            !d.obj ? 'border-slate-200' :
            d.progressVisites >= 80 ? 'border-teal-400' :
            d.progressVisites >= 50 ? 'border-amber-400' : 'border-rose-400'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-black text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                {!d.obj && (
                  <p className="text-xs text-slate-400">Aucun objectif défini</p>
                )}
              </div>
              {d.obj && (
                <button onClick={() => {
                  set('delegate_id', d.id)
                  set('mois', `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
                  set('objectif_visites', d.obj.objectif_visites)
                  set('objectif_medecins', d.obj.objectif_medecins)
                  setShowForm(true)
                }} className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold">
                  ✏️
                </button>
              )}
            </div>

            {d.obj ? (
              <>
                {/* Visites */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 font-bold">Visites réalisées</span>
                    <span className={`font-black ${
                      d.progressVisites >= 80 ? 'text-teal-500' :
                      d.progressVisites >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{d.stats.visites} / {d.obj.objectif_visites} ({d.progressVisites}%)</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${
                      d.progressVisites >= 80 ? 'bg-teal-400' :
                      d.progressVisites >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                    }`} style={{ width: `${d.progressVisites}%` }} />
                  </div>
                </div>

                {/* Cibles */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 font-bold">Cibles couvertes</span>
                    <span className={`font-black ${
                      d.progressMedecins >= 80 ? 'text-teal-500' :
                      d.progressMedecins >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{d.stats.medecins} / {d.obj.objectif_medecins} ({d.progressMedecins}%)</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${
                      d.progressMedecins >= 80 ? 'bg-blue-400' :
                      d.progressMedecins >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                    }`} style={{ width: `${d.progressMedecins}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <button onClick={() => {
                set('delegate_id', d.id)
                set('mois', `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
                setShowForm(true)
              }} className="w-full bg-slate-50 text-slate-400 font-bold py-2 rounded-xl text-xs border border-dashed border-slate-200">
                + Définir un objectif
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

