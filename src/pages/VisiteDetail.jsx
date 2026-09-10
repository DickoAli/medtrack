import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function VisiteDetail({ visite, onBack, profile }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    result: '', interest_level: '', objections: '', competitor_products: '',
    questions: '', samples_given: 0, next_action: '', next_visit_date: '', notes: ''
  })

  useEffect(() => { fetchReport() }, [])

  const fetchReport = async () => {
    const { data } = await supabase.from('visit_reports').select('*').eq('visit_id', visite.id).single()
    if (data) {
      setReport(data)
      setForm({
        result: data.result || '', interest_level: data.interest_level || '',
        objections: data.objections || '', competitor_products: data.competitor_products || '',
        questions: data.questions || '', samples_given: data.samples_given || 0,
        next_action: data.next_action || '', next_visit_date: data.next_visit_date || '',
        notes: data.notes || ''
      })
    }
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const data = { visit_id: visite.id, ...form, samples_given: parseInt(form.samples_given) || 0, submitted_at: new Date().toISOString() }

    if (report) {
      await supabase.from('visit_reports').update(data).eq('id', report.id)
    } else {
      await supabase.from('visit_reports').insert(data)
    }

    await supabase.rpc('calculate_confidence_score', { visit_id: visite.id })

    setSaving(false)
    setSuccessMsg('Compte rendu enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchReport()
  }

  const RESULTS = [
    { value: 'positive', label: '👍 Positif' },
    { value: 'neutral', label: '😐 Neutre' },
    { value: 'negative', label: '👎 Négatif' },
    { value: 'absent', label: '🚫 Absent' },
  ]
  const INTEREST = [
    { value: 'high', label: '🔥 Élevé' },
    { value: 'medium', label: '👌 Moyen' },
    { value: 'low', label: '❄️ Faible' },
    { value: 'none', label: '⭕ Aucun' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-semibold text-base">Compte rendu</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            {visite.nom_contact || '—'} · {visite.created_at?.slice(0, 10)}
          </p>
        </div>
      </div>

      <div className="mx-5 mt-4 bg-white rounded-xl p-4 border border-[#DDE4EA]">
        <div className="flex gap-3 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            visite.statut === 'Réalisée' ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
          }`}>{visite.statut}</span>
          {visite.confidence_score !== null && visite.confidence_score !== undefined && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              visite.confidence_status === 'validated' ? 'bg-[#E9F9EE] text-[#16A34A]' :
              visite.confidence_status === 'to_check' ? 'bg-[#FEF3E2] text-[#B45309]' :
              'bg-[#FDE8E8] text-[#DC2626]'
            }`}>Score: {visite.confidence_score}pts</span>
          )}
          {visite.produit && (
            <span className="text-xs font-semibold text-[#667085]">💊 {visite.produit}</span>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 pb-10">
        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Résultat de la visite</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {RESULTS.map(r => (
              <button key={r.value} onClick={() => set('result', r.value)}
                className={`py-3 rounded-lg text-sm font-semibold border transition-colors ${
                  form.result === r.value ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Niveau d'intérêt</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {INTEREST.map(i => (
              <button key={i.value} onClick={() => set('interest_level', i.value)}
                className={`py-3 rounded-lg text-sm font-semibold border transition-colors ${
                  form.interest_level === i.value ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Objections soulevées</label>
          <textarea value={form.objections} onChange={e => set('objections', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-20 resize-none"
            placeholder="Ex: Prix trop élevé, préfère la concurrence..." />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Produits concurrents mentionnés</label>
          <input value={form.competitor_products} onChange={e => set('competitor_products', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
            placeholder="Ex: Efferalgan, Paracétamol générique..." />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Questions posées par le médecin</label>
          <textarea value={form.questions} onChange={e => set('questions', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-20 resize-none"
            placeholder="Questions scientifiques, posologie, interactions..." />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Échantillons remis</label>
          <input type="number" value={form.samples_given} onChange={e => set('samples_given', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
            min="0" max="100" />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Prochaine action</label>
          <input value={form.next_action} onChange={e => set('next_action', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
            placeholder="Ex: Envoyer documentation, rappeler dans 2 semaines..." />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Date prochaine visite</label>
          <input type="date" value={form.next_visit_date} onChange={e => set('next_visit_date', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
        </div>

        <div>
          <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Notes complémentaires</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-20 resize-none"
            placeholder="Observations générales..." />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-[#087F5B] text-white font-semibold py-4 rounded-xl text-sm">
          {saving ? 'Enregistrement...' : report ? 'Mettre à jour le compte rendu' : 'Enregistrer le compte rendu'}
        </button>
      </div>
    </div>
  )
}
