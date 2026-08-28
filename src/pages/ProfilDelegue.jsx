import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ProfilDelegue({ profile, onBack }) {
  const [stats, setStats] = useState(null)
  const [coaching, setCoaching] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`

    const [{ data: v }, { data: c }, { data: p }, { data: o }] = await Promise.all([
      supabase.from('visites').select('*').eq('delegate_id', profile.delegate_id).order('created_at', { ascending: false }),
      supabase.from('coaching_reports').select('*').eq('delegate_id', profile.delegate_id).order('created_at', { ascending: false }),
      supabase.from('delegate_portfolios').select('*, healthcare_professionals(nom, prenom, potential)').eq('delegate_id', profile.delegate_id).eq('is_active', true),
      supabase.from('objectifs').select('*').eq('delegate_id', profile.delegate_id).eq('mois', `${currentYear}-${String(currentMonth).padStart(2, '0')}`)
    ])

    const visitesMonth = (v || []).filter(x => x.created_at >= monthStart)
    const realisees = visitesMonth.filter(x => x.statut === 'Réalisée')
    const validated = (v || []).filter(x => x.confidence_status === 'validated')
    const suspicious = (v || []).filter(x => x.confidence_status === 'suspicious')
    const avgScore = (v || []).filter(x => x.confidence_score !== null).length > 0
      ? Math.round((v || []).filter(x => x.confidence_score !== null).reduce((s, x) => s + x.confidence_score, 0) / (v || []).filter(x => x.confidence_score !== null).length)
      : 0
    const avgCoaching = (c || []).length > 0
      ? ((c || []).reduce((s, x) => s + parseFloat(x.global_score), 0) / (c || []).length).toFixed(1)
      : null
    const objectif = o?.[0]?.objectif_visites || 0
    const progression = objectif > 0 ? Math.min(Math.round((realisees.length / objectif) * 100), 100) : 0

    setStats({ visitesMonth: visitesMonth.length, realisees: realisees.length, objectif, progression, avgScore, avgCoaching, validated: validated.length, suspicious: suspicious.length, totalVisites: (v || []).length })
    setVisites(v || [])
    setCoaching(c || [])
    setPortfolio(p || [])
    setLoading(false)
  }

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const currentMonth = MONTHS[new Date().getMonth()]
  const currentYear = new Date().getFullYear()

  const visitesParMois = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const count = visites.filter(v => {
      const vd = new Date(v.created_at)
      return vd.getMonth() + 1 === m && vd.getFullYear() === y && v.statut === 'Réalisée'
    }).length
    return { label: MONTHS[m - 1], count }
  })

  const maxVisites = Math.max(...visitesParMois.map(v => v.count), 1)

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
          <h1 className="text-white font-black text-lg">Mon profil</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            {profile.delegates?.prenom} {profile.delegates?.nom}
          </p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* Carte identité */}
        <div className="bg-blue-950 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-400 flex items-center justify-center font-black text-blue-950 text-2xl flex-shrink-0">
            {profile.delegates?.prenom?.[0]}{profile.delegates?.nom?.[0]}
          </div>
          <div>
            <p className="text-white font-black text-lg">{profile.delegates?.prenom} {profile.delegates?.nom}</p>
            <p className="text-teal-400 text-xs font-bold">Délégué médical</p>
            <div className="flex gap-2 mt-2">
              <span className="bg-teal-400 text-blue-950 text-xs font-black px-2 py-0.5 rounded-full">
                {stats.totalVisites} visites
              </span>
              <span className="bg-slate-700 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {portfolio.length} cibles
              </span>
            </div>
          </div>
        </div>

        {/* KPIs mois en cours */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
            {currentMonth} {currentYear}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{stats.realisees}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Réalisées</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{stats.objectif}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Objectif</p>
            </div>
          </div>

          {/* Barre progression objectif */}
          {stats.objectif > 0 && (
            <div className="bg-white rounded-2xl p-4 mt-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Progression objectif</span>
                <span className={`font-black ${stats.progression >= 80 ? 'text-teal-500' : stats.progression >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {stats.progression}%
                </span>
              </div>
              <div className="bg-slate-100 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${
                  stats.progression >= 80 ? 'bg-teal-400' :
                  stats.progression >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                }`} style={{ width: `${stats.progression}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1 text-center">
                {stats.realisees} / {stats.objectif} visites réalisées
              </p>
            </div>
          )}
        </div>

        {/* Score anti-triche */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Qualité des visites</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{stats.avgScore}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">Score moy.</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-green-400">
              <p className="text-2xl font-black text-blue-950">{stats.validated}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">✅ Validées</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-rose-400">
              <p className="text-2xl font-black text-blue-950">{stats.suspicious}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">🚨 Suspectes</p>
            </div>
          </div>
        </div>

        {/* Score coaching */}
        {stats.avgCoaching && (
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Score coaching</p>
              <p className={`text-3xl font-black ${
                parseFloat(stats.avgCoaching) >= 4 ? 'text-teal-500' :
                parseFloat(stats.avgCoaching) >= 3 ? 'text-amber-500' : 'text-rose-500'
              }`}>{stats.avgCoaching}/5</p>
            </div>
            <div className="bg-slate-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${
                parseFloat(stats.avgCoaching) >= 4 ? 'bg-teal-400' :
                parseFloat(stats.avgCoaching) >= 3 ? 'bg-amber-400' : 'bg-rose-400'
              }`} style={{ width: `${(parseFloat(stats.avgCoaching) / 5) * 100}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{coaching.length} évaluation{coaching.length > 1 ? 's' : ''}</p>
          </div>
        )}

        {/* Graphique 6 derniers mois */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
            Activité 6 derniers mois
          </p>
          <div className="flex items-end gap-2 h-24">
            {visitesParMois.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs font-black text-teal-500">{m.count > 0 ? m.count : ''}</p>
                <div className="w-full rounded-t-lg bg-teal-400 transition-all"
                  style={{ height: `${m.count > 0 ? Math.max((m.count / maxVisites) * 80, 4) : 4}px` }} />
                <p className="text-xs text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Portefeuille */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
            Mon portefeuille ({portfolio.length} cibles)
          </p>
          {portfolio.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-slate-400 text-sm">Aucune cible assignée</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {portfolio.slice(0, 5).map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-3 flex items-center gap-3">
                  <span className={`text-xs font-black px-2 py-1 rounded-full flex-shrink-0 ${
                    p.healthcare_professionals?.potential === 'A' ? 'bg-rose-100 text-rose-600' :
                    p.healthcare_professionals?.potential === 'B' ? 'bg-amber-100 text-amber-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {p.healthcare_professionals?.potential}
                  </span>
                  <p className="text-sm font-bold text-blue-950">
                    {p.healthcare_professionals?.prenom} {p.healthcare_professionals?.nom}
                  </p>
                  <span className="ml-auto text-xs text-slate-400">{p.visit_frequency}x/mois</span>
                </div>
              ))}
              {portfolio.length > 5 && (
                <p className="text-xs text-slate-400 text-center">+{portfolio.length - 5} autres cibles</p>
              )}
            </div>
          )}
        </div>

        {/* Dernier coaching */}
        {coaching.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Dernier coaching
            </p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">
                {new Date(coaching[0].created_at).toLocaleDateString('fr-FR')}
              </p>
              <p className={`font-black text-2xl ${
                coaching[0].global_score >= 4 ? 'text-teal-500' :
                coaching[0].global_score >= 3 ? 'text-amber-500' : 'text-rose-500'
              }`}>{parseFloat(coaching[0].global_score).toFixed(1)}/5</p>
            </div>
            {coaching[0].strengths && (
              <div className="bg-teal-50 rounded-xl p-3 mb-2">
                <p className="text-xs font-bold text-teal-600 mb-1">✅ Points forts</p>
                <p className="text-xs text-slate-600">{coaching[0].strengths}</p>
              </div>
            )}
            {coaching[0].improvements && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-600 mb-1">⚠️ À améliorer</p>
                <p className="text-xs text-slate-600">{coaching[0].improvements}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}