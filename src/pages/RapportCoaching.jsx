import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function RapportCoaching({ onBack, profile }) {
  const [rapports, setRapports] = useState([])
  const [visites, setVisites] = useState([])
  const [delegates, setDelegates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterDelegate, setFilterDelegate] = useState('tous')
  const [form, setForm] = useState({
    visit_id: '',
    delegate_id: '',
    preparation_score: 3,
    product_knowledge_score: 3,
    presentation_score: 3,
    argumentation_score: 3,
    listening_score: 3,
    objection_handling_score: 3,
    conclusion_score: 3,
    strengths: '',
    improvements: '',
    recommendations: '',
    next_coaching_date: ''
  })

  const CRITERES = [
    { key: 'preparation_score', label: 'Préparation', icon: '📋' },
    { key: 'product_knowledge_score', label: 'Connaissance produit', icon: '💊' },
    { key: 'presentation_score', label: 'Présentation', icon: '🎯' },
    { key: 'argumentation_score', label: 'Argumentation', icon: '💬' },
    { key: 'listening_score', label: 'Écoute', icon: '👂' },
    { key: 'objection_handling_score', label: 'Gestion objections', icon: '🛡️' },
    { key: 'conclusion_score', label: 'Conclusion', icon: '✅' },
  ]

  const SCORE_LABELS = {
    1: 'Insuffisant',
    2: 'À améliorer',
    3: 'Satisfaisant',
    4: 'Bien',
    5: 'Excellent'
  }

  const SCORE_COLORS = {
    1: 'bg-rose-500',
    2: 'bg-orange-400',
    3: 'bg-amber-400',
    4: 'bg-teal-400',
    5: 'bg-green-500'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: r }, { data: v }, { data: d }] = await Promise.all([
      supabase.from('coaching_reports')
        .select('*, delegates(nom, prenom), visites(nom_contact, created_at, type_lieu)')
        .eq('evaluator_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('visites')
        .select('*, delegates(nom, prenom)')
        .eq('agence_id', profile.agence_id)
        .eq('visit_type', 'accompanied')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setRapports(r || [])
    setVisites(v || [])
    setDelegates(d || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    visit_id: '',
    delegate_id: '',
    preparation_score: 3,
    product_knowledge_score: 3,
    presentation_score: 3,
    argumentation_score: 3,
    listening_score: 3,
    objection_handling_score: 3,
    conclusion_score: 3,
    strengths: '',
    improvements: '',
    recommendations: '',
    next_coaching_date: ''
  })

  const globalScore = () => {
    const scores = CRITERES.map(c => parseInt(form[c.key]))
    return (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)
  }

  const handleSave = async () => {
    if (!form.delegate_id) { alert('Sélectionnez un délégué'); return }
    setSaving(true)

    await supabase.from('coaching_reports').insert({
      visit_id: form.visit_id || null,
      delegate_id: form.delegate_id,
      evaluator_id: profile.id,
      preparation_score: parseInt(form.preparation_score),
      product_knowledge_score: parseInt(form.product_knowledge_score),
      presentation_score: parseInt(form.presentation_score),
      argumentation_score: parseInt(form.argumentation_score),
      listening_score: parseInt(form.listening_score),
      objection_handling_score: parseInt(form.objection_handling_score),
      conclusion_score: parseInt(form.conclusion_score),
      global_score: parseFloat(globalScore()),
      strengths: form.strengths,
      improvements: form.improvements,
      recommendations: form.recommendations,
      next_coaching_date: form.next_coaching_date || null
    })

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Rapport de coaching enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const filtered = rapports.filter(r =>
    filterDelegate === 'tous' || r.delegate_id === filterDelegate
  )

  const avgByDelegate = delegates.map(d => {
    const raps = rapports.filter(r => r.delegate_id === d.id)
    if (raps.length === 0) return null
    const avg = (raps.reduce((s, r) => s + parseFloat(r.global_score), 0) / raps.length).toFixed(1)
    return { ...d, avg: parseFloat(avg), count: raps.length }
  }).filter(Boolean).sort((a, b) => b.avg - a.avg)

  const ScoreButton = ({ criterKey, value }) => (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => set(criterKey, s)}
            className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
              form[criterKey] >= s ? SCORE_COLORS[form[criterKey]] + ' text-white' : 'bg-slate-100 text-slate-400'
            }`}>
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 text-center">{SCORE_LABELS[form[criterKey]]}</p>
    </div>
  )

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
            <h1 className="text-white font-black text-lg">Coaching</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {rapports.length} rapport{rapports.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Évaluer
        </button>
      </div>

      {/* Filtre */}
      <div className="px-6 pt-4">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
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
            <h2 className="font-black text-blue-950 text-lg mb-4">Évaluation coaching</h2>
            <div className="flex flex-col gap-5">

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visite liée (optionnel)</label>
                <select value={form.visit_id} onChange={e => set('visit_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucune visite spécifique</option>
                  {visites
                    .filter(v => !form.delegate_id || v.delegate_id === form.delegate_id)
                    .map(v => (
                      <option key={v.id} value={v.id}>
                        {v.nom_contact || '—'} · {v.created_at?.slice(0, 10)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Score global preview */}
              <div className={`rounded-2xl p-4 text-center ${
                parseFloat(globalScore()) >= 4 ? 'bg-teal-50 border border-teal-200' :
                parseFloat(globalScore()) >= 3 ? 'bg-amber-50 border border-amber-200' :
                'bg-rose-50 border border-rose-200'
              }`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score global</p>
                <p className={`text-4xl font-black mt-1 ${
                  parseFloat(globalScore()) >= 4 ? 'text-teal-500' :
                  parseFloat(globalScore()) >= 3 ? 'text-amber-500' : 'text-rose-500'
                }`}>{globalScore()}</p>
                <p className="text-xs text-slate-400">sur 5</p>
              </div>

              {/* Critères */}
              {CRITERES.map(c => (
                <div key={c.key}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>{c.icon}</span> {c.label}
                  </label>
                  <ScoreButton criterKey={c.key} value={form[c.key]} />
                </div>
              ))}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Points forts</label>
                <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Ce que le délégué fait bien..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Points à améliorer</label>
                <textarea value={form.improvements} onChange={e => set('improvements', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Ce qui doit être amélioré..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommandations</label>
                <textarea value={form.recommendations} onChange={e => set('recommendations', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Actions concrètes à mettre en place..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prochain coaching</label>
                <input type="date" value={form.next_coaching_date}
                  onChange={e => set('next_coaching_date', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
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

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* Classement délégués */}
        {avgByDelegate.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Classement coaching
            </p>
            {avgByDelegate.map((d, i) => (
              <div key={d.id} className="bg-white rounded-2xl p-4 mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                    i === 0 ? 'bg-amber-400 text-white' :
                    i === 1 ? 'bg-slate-300 text-white' :
                    i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1">
                    <p className="font-black text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-slate-400">{d.count} évaluation{d.count > 1 ? 's' : ''}</p>
                  </div>
                  <p className={`font-black text-2xl ${
                    d.avg >= 4 ? 'text-teal-500' :
                    d.avg >= 3 ? 'text-amber-500' : 'text-rose-500'
                  }`}>{d.avg}</p>
                </div>
                <div className="bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${
                    d.avg >= 4 ? 'bg-teal-400' :
                    d.avg >= 3 ? 'bg-amber-400' : 'bg-rose-400'
                  }`} style={{ width: `${(d.avg / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Liste rapports */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          Rapports ({filtered.length})
        </p>
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-slate-400 text-sm font-bold">Aucun rapport de coaching</p>
            <p className="text-slate-300 text-xs mt-1">Cliquez sur "+ Évaluer" pour commencer</p>
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              r.global_score >= 4 ? 'border-teal-400' :
              r.global_score >= 3 ? 'border-amber-400' : 'border-rose-400'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-black text-blue-950 text-sm">
                    {r.delegates?.prenom} {r.delegates?.nom}
                  </p>
                  {r.visites && (
                    <p className="text-xs text-slate-400">
                      📋 {r.visites.nom_contact || '—'} · {r.visites.created_at?.slice(0, 10)}
                    </p>
                  )}
                  <p className="text-xs text-slate-300">
                    {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-3xl ${
                    r.global_score >= 4 ? 'text-teal-500' :
                    r.global_score >= 3 ? 'text-amber-500' : 'text-rose-500'
                  }`}>{parseFloat(r.global_score).toFixed(1)}</p>
                  <p className="text-xs text-slate-400">/ 5</p>
                </div>
              </div>

              {/* Scores détaillés */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {CRITERES.map(c => (
                  <div key={c.key} className="flex flex-col items-center gap-1">
                    <div className={`w-full h-1.5 rounded-full ${SCORE_COLORS[r[c.key]]}`} />
                    <span className="text-xs text-slate-400">{r[c.key]}</span>
                  </div>
                ))}
              </div>

              {r.strengths && (
                <div className="bg-teal-50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-bold text-teal-600 mb-1">✅ Points forts</p>
                  <p className="text-xs text-slate-600">{r.strengths}</p>
                </div>
              )}
              {r.improvements && (
                <div className="bg-amber-50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-bold text-amber-600 mb-1">⚠️ À améliorer</p>
                  <p className="text-xs text-slate-600">{r.improvements}</p>
                </div>
              )}
              {r.recommendations && (
                <div className="bg-blue-50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-bold text-blue-600 mb-1">💡 Recommandations</p>
                  <p className="text-xs text-slate-600">{r.recommendations}</p>
                </div>
              )}
              {r.next_coaching_date && (
                <p className="text-xs text-purple-500 font-bold mt-2">
                  📅 Prochain coaching : {new Date(r.next_coaching_date).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}