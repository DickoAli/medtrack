import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function VisiteDetail({ visite, onBack, profile }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    result: '', interest_level: '', objections: '',
    competitor_products: '', questions: '', samples_given: 0,
    next_action: '', next_visit_date: '', notes: ''
  })

  useEffect(() => { fetchReport() }, [])

  const fetchReport = async () => {
    const { data } = await supabase
      .from('visit_reports')
      .select('*')
      .eq('visit_id', visite.id)
      .single()
    if (data) {
      setReport(data)
      setForm({
        result: data.result || '',
        interest_level: data.interest_level || '',
        objections: data.objections || '',
        competitor_products: data.competitor_products || '',
        questions: data.questions || '',
        samples_given: data.samples_given || 0,
        next_action: data.next_action || '',
        next_visit_date: data.next_visit_date || '',
        notes: data.notes || ''
      })
    }
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const data = {
      visit_id: visite.id,
      ...form,
      samples_given: parseInt(form.samples_given) || 0,
      submitted_at: new Date().toISOString()
    }

    if (report) {
      await supabase.from('visit_reports').update(data).eq('id', report.id)
    } else {
      await supabase.from('visit_reports').insert(data)
    }

    // Recalculer le score de confiance
    await supabase.rpc('calculate_confidence_score', { visit_id: visite.id })

    setSaving(false)
    setSuccessMsg('Compte rendu enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchReport()
  }

  const RESULTS = [
    { value: 'positive', label: '👍 Positif', color: 'bg-teal-100 text-teal-600' },
    { value: 'neutral', label: '😐 Neutre', color: 'bg-slate-100 text-slate-500' },
    { value: 'negative', label: '👎 Négatif', color: 'bg-rose-100 text-rose-500' },
    { value: 'absent', label: '🚫 Absent', color: 'bg-amber-100 text-amber-600' },
  ]

  const INTEREST = [
    { value: 'high', label: '🔥 Élevé', color: 'bg-rose-100 text-rose-600' },
    { value: 'medium', label: '👌 Moyen', color: 'bg-amber-100 text-amber-600' },
    { value: 'low', label: '❄️ Faible', color: 'bg-blue-100 text-blue-600' },
    { value: 'none', label: '⭕ Aucun', color: 'bg-slate-100 text-slate-500' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-black text-lg">Compte rendu</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            {visite.nom_contact || '—'} · {visite.created_at?.slice(0, 10)}
          </p>
        </div>
      </div>

      {/* Info visite */}
      <div className="mx-6 mt-4 bg-white rounded-2xl p-4">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            visite.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'
          }`}>{visite.statut}</span>
          {visite.confidence_score !== null && visite.confidence_score !== undefined && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              visite.confidence_status === 'validated' ? 'bg-green-100 text-green-600' :
              visite.confidence_status === 'to_check' ? 'bg-amber-100 text-amber-600' :
              'bg-rose-100 text-rose-500'
            }`}>Score: {visite.confidence_score}pts</span>
          )}
          {visite.produit && (
            <span className="text-xs font-bold text-slate-400">💊 {visite.produit}</span>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* Résultat */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Résultat de la visite</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {RESULTS.map(r => (
              <button key={r.value} onClick={() => set('result', r.value)}
                className={`py-3 rounded-xl text-sm font-black border transition-colors ${
                  form.result === r.value
                    ? 'bg-blue-950 text-white border-blue-950'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intérêt */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Niveau d'intérêt</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {INTEREST.map(i => (
              <button key={i.value} onClick={() => set('interest_level', i.value)}
                className={`py-3 rounded-xl text-sm font-black border transition-colors ${
                  form.interest_level === i.value
                    ? 'bg-blue-950 text-white border-blue-950'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}>
                {i.label}
              </button>
            ))}
          </div>
        </div>

        {/* Objections */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objections soulevées</label>
          <textarea value={form.objections} onChange={e => set('objections', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-20 resize-none"
            placeholder="Ex: Prix trop élevé, préfère la concurrence..." />
        </div>

        {/* Concurrents */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produits concurrents mentionnés</label>
          <input value={form.competitor_products} onChange={e => set('competitor_products', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            placeholder="Ex: Efferalgan, Paracétamol générique..." />
        </div>

        {/* Questions */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Questions posées par le médecin</label>
          <textarea value={form.questions} onChange={e => set('questions', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-20 resize-none"
            placeholder="Questions scientifiques, posologie, interactions..." />
        </div>

        {/* Échantillons */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Échantillons remis</label>
          <input type="number" value={form.samples_given} onChange={e => set('samples_given', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            min="0" max="100" />
        </div>

        {/* Prochaine action */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prochaine action</label>
          <input value={form.next_action} onChange={e => set('next_action', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            placeholder="Ex: Envoyer documentation, rappeler dans 2 semaines..." />
        </div>

        {/* Prochaine visite */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date prochaine visite</label>
          <input type="date" value={form.next_visit_date} onChange={e => set('next_visit_date', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm" />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes complémentaires</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-20 resize-none"
            placeholder="Observations générales..." />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm">
          {saving ? 'Enregistrement...' : report ? 'Mettre à jour le compte rendu' : 'Enregistrer le compte rendu'}
        </button>
      </div>
    </div>
  )
}