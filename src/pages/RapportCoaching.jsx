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
    visit_id: '', delegate_id: '',
    preparation_score: 3, product_knowledge_score: 3, presentation_score: 3,
    argumentation_score: 3, listening_score: 3, objection_handling_score: 3,
    conclusion_score: 3, strengths: '', improvements: '', recommendations: '',
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

  const SCORE_LABELS = { 1: 'Insuffisant', 2: 'À améliorer', 3: 'Satisfaisant', 4: 'Bien', 5: 'Excellent' }
  const SCORE_COLORS = { 1: '#DC2626', 2: '#F59E0B', 3: '#F59E0B', 4: '#087F5B', 5: '#16A34A' }

  // Grille de notation — décrit le comportement observé à chaque niveau,
  // pour que deux managers notent la même prestation de façon cohérente.
  const RUBRIC = {
    preparation_score: {
      1: 'Arrive sans avoir consulté l\'historique du professionnel, ne sait pas qui il va voir.',
      2: 'Connaît le nom du professionnel mais ignore l\'historique des visites précédentes.',
      3: 'A consulté l\'historique mais n\'a pas défini d\'objectif clair pour cette visite.',
      4: 'Objectif de visite clair, connaît le contexte (dernière visite, produits déjà présentés).',
      5: 'Objectif précis, anticipe les besoins du professionnel, prépare les supports adaptés à son profil.',
    },
    product_knowledge_score: {
      1: 'Ne connaît pas les caractéristiques de base du produit (dosage, indication).',
      2: 'Connaît les bases mais hésite ou se trompe sur des détails importants.',
      3: 'Maîtrise les informations essentielles mais reste approximatif sur les données cliniques.',
      4: 'Maîtrise complète des caractéristiques, posologie, et principales données cliniques.',
      5: 'Maîtrise experte, capable de répondre à des questions cliniques pointues sans notes.',
    },
    presentation_score: {
      1: 'Lit un support sans reformuler, présentation mécanique.',
      2: 'Présente le produit mais de façon désorganisée ou trop longue.',
      3: 'Présentation claire mais générique, identique quel que soit l\'interlocuteur.',
      4: 'Présentation structurée, adaptée au temps disponible et à l\'interlocuteur.',
      5: 'Présentation fluide, engageante, parfaitement calibrée à la spécialité du professionnel.',
    },
    argumentation_score: {
      1: 'Ne présente aucun argument clinique, aucune réponse aux réserves.',
      2: 'Argumente mais de façon désorganisée, ne répond pas aux objections.',
      3: 'Argumentation correcte mais générique, peu adaptée au profil du praticien.',
      4: 'Argumentation structurée et adaptée, répond aux objections courantes.',
      5: 'Argumentation experte, anticipe les objections, s\'appuie sur des données cliniques précises.',
    },
    listening_score: {
      1: 'Monologue, n\'interagit pas avec les remarques du professionnel.',
      2: 'Écoute superficiellement, coupe la parole ou ignore les questions posées.',
      3: 'Écoute correctement mais ne rebondit pas sur ce qui est dit.',
      4: 'Écoute active, reformule et adapte son discours aux réactions du professionnel.',
      5: 'Écoute experte, détecte les besoins non exprimés et ajuste la visite en conséquence.',
    },
    objection_handling_score: {
      1: 'Se décontenance ou abandonne face à une objection.',
      2: 'Répond aux objections mais de façon défensive ou peu convaincante.',
      3: 'Répond correctement aux objections courantes et attendues.',
      4: 'Traite les objections avec assurance, s\'appuie sur des faits concrets.',
      5: 'Transforme l\'objection en opportunité, renforce la relation de confiance.',
    },
    conclusion_score: {
      1: 'Quitte sans conclusion ni prochaine étape définie.',
      2: 'Conclut vaguement, sans engagement clair du professionnel.',
      3: 'Résume la visite mais sans fixer de prochaine action précise.',
      4: 'Conclut avec un engagement clair et une prochaine étape définie.',
      5: 'Conclusion qui sécurise un engagement concret et planifie la suite avec précision.',
    },
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
    visit_id: '', delegate_id: '',
    preparation_score: 3, product_knowledge_score: 3, presentation_score: 3,
    argumentation_score: 3, listening_score: 3, objection_handling_score: 3,
    conclusion_score: 3, strengths: '', improvements: '', recommendations: '',
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
      strengths: form.strengths, improvements: form.improvements,
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

  const filtered = rapports.filter(r => filterDelegate === 'tous' || r.delegate_id === filterDelegate)

  const avgByDelegate = delegates.map(d => {
    const raps = rapports.filter(r => r.delegate_id === d.id)
    if (raps.length === 0) return null
    const avg = (raps.reduce((s, r) => s + parseFloat(r.global_score), 0) / raps.length).toFixed(1)
    return { ...d, avg: parseFloat(avg), count: raps.length }
  }).filter(Boolean).sort((a, b) => b.avg - a.avg)

  const scoreColor = (v) => v >= 4 ? '#087F5B' : v >= 3 ? '#F59E0B' : '#DC2626'

  const ScoreButton = ({ criterKey }) => (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => set(criterKey, s)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: form[criterKey] >= s ? SCORE_COLORS[form[criterKey]] : '#EEF1F4',
              color: form[criterKey] >= s ? '#fff' : '#98A2B3'
            }}>
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-[#98A2B3] text-center">{SCORE_LABELS[form[criterKey]]}</p>
      {RUBRIC[criterKey]?.[form[criterKey]] && (
        <div className="bg-[#F4F7F9] rounded-lg p-2.5 mt-1">
          <p className="text-xs text-[#172B4D] leading-snug">
            {RUBRIC[criterKey][form[criterKey]]}
          </p>
        </div>
      )}
    </div>
  )

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
            <h1 className="text-white font-semibold text-base">Coaching</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {rapports.length} rapport{rapports.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Évaluer
        </button>
      </div>

      <div className="px-5 pt-4">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Évaluation coaching</h2>
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Visite liée (optionnel)</label>
                <select value={form.visit_id} onChange={e => set('visit_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucune visite spécifique</option>
                  {visites.filter(v => !form.delegate_id || v.delegate_id === form.delegate_id).map(v => (
                    <option key={v.id} value={v.id}>{v.nom_contact || '—'} · {v.created_at?.slice(0, 10)}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl p-4 text-center border" style={{ background: '#F4F7F9', borderColor: scoreColor(parseFloat(globalScore())) + '33' }}>
                <p className="text-xs font-medium text-[#667085] uppercase tracking-wide">Score global</p>
                <p className="text-3xl font-semibold mt-1" style={{ color: scoreColor(parseFloat(globalScore())) }}>{globalScore()}</p>
                <p className="text-xs text-[#98A2B3]">sur 5</p>
              </div>

              {CRITERES.map(c => (
                <div key={c.key}>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-2 flex items-center gap-1">
                    <span>{c.icon}</span> {c.label}
                  </label>
                  <ScoreButton criterKey={c.key} />
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Points forts</label>
                <textarea value={form.strengths} onChange={e => set('strengths', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Ce que le délégué fait bien..." />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Points à améliorer</label>
                <textarea value={form.improvements} onChange={e => set('improvements', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Ce qui doit être amélioré..." />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Recommandations</label>
                <textarea value={form.recommendations} onChange={e => set('recommendations', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Actions concrètes à mettre en place..." />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Prochain coaching</label>
                <input type="date" value={form.next_coaching_date}
                  onChange={e => set('next_coaching_date', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
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
        {avgByDelegate.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">Classement coaching</p>
            {avgByDelegate.map((d, i) => (
              <div key={d.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 text-white`}
                    style={{ background: i === 0 ? '#F59E0B' : i === 1 ? '#98A2B3' : i === 2 ? '#B45309' : '#DDE4EA' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-[#667085]">{d.count} évaluation{d.count > 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-semibold text-2xl" style={{ color: scoreColor(d.avg) }}>{d.avg}</p>
                </div>
                <div className="bg-[#EEF1F4] rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${(d.avg / 5) * 100}%`, background: scoreColor(d.avg) }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Rapports ({filtered.length})</p>
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-[#667085] text-sm font-medium">Aucun rapport de coaching</p>
            <p className="text-[#98A2B3] text-xs mt-1">Cliquez sur "+ Évaluer" pour commencer</p>
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${scoreColor(r.global_score)}` }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-[#172B4D] text-sm">{r.delegates?.prenom} {r.delegates?.nom}</p>
                  {r.visites && (
                    <p className="text-xs text-[#667085]">
                      📋 {r.visites.nom_contact || '—'} · {r.visites.created_at?.slice(0, 10)}
                    </p>
                  )}
                  <p className="text-xs text-[#98A2B3]">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-2xl" style={{ color: scoreColor(r.global_score) }}>{parseFloat(r.global_score).toFixed(1)}</p>
                  <p className="text-xs text-[#98A2B3]">/ 5</p>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-3">
                {CRITERES.map(c => (
                  <div key={c.key} className="flex flex-col items-center gap-1">
                    <div className="w-full h-1.5 rounded-full" style={{ background: SCORE_COLORS[r[c.key]] }} />
                    <span className="text-xs text-[#98A2B3]">{r[c.key]}</span>
                  </div>
                ))}
              </div>

              {r.strengths && (
                <div className="bg-[#E7F5EF] rounded-lg p-3 mb-2">
                  <p className="text-xs font-semibold text-[#087F5B] mb-1">✅ Points forts</p>
                  <p className="text-xs text-[#667085]">{r.strengths}</p>
                </div>
              )}
              {r.improvements && (
                <div className="bg-[#FEF3E2] rounded-lg p-3 mb-2">
                  <p className="text-xs font-semibold text-[#B45309] mb-1">⚠️ À améliorer</p>
                  <p className="text-xs text-[#667085]">{r.improvements}</p>
                </div>
              )}
              {r.recommendations && (
                <div className="bg-[#E8F0FE] rounded-lg p-3 mb-2">
                  <p className="text-xs font-semibold text-[#2563EB] mb-1">💡 Recommandations</p>
                  <p className="text-xs text-[#667085]">{r.recommendations}</p>
                </div>
              )}
              {r.next_coaching_date && (
                <p className="text-xs text-[#2563EB] font-semibold mt-2">
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
