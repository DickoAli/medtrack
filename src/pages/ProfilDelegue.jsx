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
  const progressColor = v => v >= 80 ? '#087F5B' : v >= 50 ? '#F59E0B' : '#DC2626'

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
          <h1 className="text-white font-semibold text-base">Mon profil</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            {profile.delegates?.prenom} {profile.delegates?.nom}
          </p>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">
        <div className="bg-[#172B4D] rounded-xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-[#087F5B] flex items-center justify-center font-semibold text-white text-2xl flex-shrink-0">
            {profile.delegates?.prenom?.[0]}{profile.delegates?.nom?.[0]}
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{profile.delegates?.prenom} {profile.delegates?.nom}</p>
            <p className="text-[#9AA9C2] text-xs font-medium">Délégué médical</p>
            <div className="flex gap-2 mt-2">
              <span className="bg-[#087F5B] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {stats.totalVisites} visites
              </span>
              <span className="bg-white/10 text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-white/20">
                {portfolio.length} cibles
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">
            {currentMonth} {currentYear}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.realisees}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Réalisées</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.objectif}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Objectif</p>
            </div>
          </div>

          {stats.objectif > 0 && (
            <div className="bg-white rounded-xl p-4 mt-3 border border-[#DDE4EA]">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-[#667085] uppercase tracking-wide">Progression objectif</span>
                <span className="font-semibold" style={{ color: progressColor(stats.progression) }}>{stats.progression}%</span>
              </div>
              <div className="bg-[#EEF1F4] rounded-full h-3">
                <div className="h-3 rounded-full transition-all" style={{ width: `${stats.progression}%`, background: progressColor(stats.progression) }} />
              </div>
              <p className="text-xs text-[#98A2B3] mt-1 text-center">
                {stats.realisees} / {stats.objectif} visites réalisées
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">Qualité des visites</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.avgScore}</p>
              <p className="text-xs text-[#667085] mt-1">Score moy.</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #16A34A' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.validated}</p>
              <p className="text-xs text-[#667085] mt-1">✅ Validées</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #DC2626' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.suspicious}</p>
              <p className="text-xs text-[#667085] mt-1">🚨 Suspectes</p>
            </div>
          </div>
        </div>

        {stats.avgCoaching && (
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Score coaching</p>
              <p className="text-2xl font-semibold" style={{ color: progressColor(parseFloat(stats.avgCoaching) * 20) }}>{stats.avgCoaching}/5</p>
            </div>
            <div className="bg-[#EEF1F4] rounded-full h-2">
              <div className="h-2 rounded-full" style={{ width: `${(parseFloat(stats.avgCoaching) / 5) * 100}%`, background: progressColor(parseFloat(stats.avgCoaching) * 20) }} />
            </div>
            <p className="text-xs text-[#98A2B3] mt-1">{coaching.length} évaluation{coaching.length > 1 ? 's' : ''}</p>
          </div>
        )}

        <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
          <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-4">
            Activité 6 derniers mois
          </p>
          <div className="flex items-end gap-2 h-24">
            {visitesParMois.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs font-semibold text-[#087F5B]">{m.count > 0 ? m.count : ''}</p>
                <div className="w-full rounded-t-lg bg-[#087F5B] transition-all"
                  style={{ height: `${m.count > 0 ? Math.max((m.count / maxVisites) * 80, 4) : 4}px` }} />
                <p className="text-xs text-[#98A2B3]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">
            Mon portefeuille ({portfolio.length} cibles)
          </p>
          {portfolio.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border border-[#DDE4EA]">
              <p className="text-[#667085] text-sm">Aucune cible assignée</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {portfolio.slice(0, 5).map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-[#DDE4EA]">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                    p.healthcare_professionals?.potential === 'A' ? 'bg-[#FDE8E8] text-[#DC2626]' :
                    p.healthcare_professionals?.potential === 'B' ? 'bg-[#FEF3E2] text-[#B45309]' :
                    'bg-[#EEF1F4] text-[#667085]'
                  }`}>
                    {p.healthcare_professionals?.potential}
                  </span>
                  <p className="text-sm font-medium text-[#172B4D]">
                    {p.healthcare_professionals?.prenom} {p.healthcare_professionals?.nom}
                  </p>
                  <span className="ml-auto text-xs text-[#98A2B3]">{p.visit_frequency}x/mois</span>
                </div>
              ))}
              {portfolio.length > 5 && (
                <p className="text-xs text-[#98A2B3] text-center">+{portfolio.length - 5} autres cibles</p>
              )}
            </div>
          )}
        </div>

        {coaching.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">Dernier coaching</p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#98A2B3]">{new Date(coaching[0].created_at).toLocaleDateString('fr-FR')}</p>
              <p className="font-semibold text-2xl" style={{ color: progressColor(coaching[0].global_score * 20) }}>{parseFloat(coaching[0].global_score).toFixed(1)}/5</p>
            </div>
            {coaching[0].strengths && (
              <div className="bg-[#E7F5EF] rounded-lg p-3 mb-2">
                <p className="text-xs font-semibold text-[#087F5B] mb-1">✅ Points forts</p>
                <p className="text-xs text-[#667085]">{coaching[0].strengths}</p>
              </div>
            )}
            {coaching[0].improvements && (
              <div className="bg-[#FEF3E2] rounded-lg p-3">
                <p className="text-xs font-semibold text-[#B45309] mb-1">⚠️ À améliorer</p>
                <p className="text-xs text-[#667085]">{coaching[0].improvements}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
