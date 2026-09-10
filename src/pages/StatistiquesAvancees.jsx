import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function StatistiquesAvancees({ onBack, profile }) {
  const [visites, setVisites] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('couverture')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterCampaign, setFilterCampaign] = useState('tous')

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: v }, { data: d }, { data: c }, { data: p }, { data: o }] = await Promise.all([
      supabase.from('visites').select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom), campaigns(nom), establishments(nom, territory_id)').eq('agence_id', profile.agence_id),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('delegate_portfolios').select('*, healthcare_professionals(nom, prenom)').eq('agence_id', profile.agence_id).eq('is_active', true),
      supabase.from('objectifs').select('*').eq('agence_id', profile.agence_id)
    ])
    setVisites(v || [])
    setDelegates(d || [])
    setCampagnes(c || [])
    setPortfolios(p || [])
    setObjectifs(o || [])
    setLoading(false)
  }

  const filteredVisites = visites.filter(v => {
    const matchMonth = new Date(v.created_at).getMonth() + 1 === filterMonth
    const matchYear = new Date(v.created_at).getFullYear() === filterYear
    const matchCampaign = filterCampaign === 'tous' || v.campaign_id === filterCampaign
    return matchMonth && matchYear && matchCampaign
  })

  const couvertureDelegate = delegates.map(d => {
    const cibles = portfolios.filter(p => p.delegate_id === d.id)
    const visitesD = filteredVisites.filter(v => v.delegate_id === d.id && v.healthcare_professional_id)
    const ciblesVisitees = new Set(visitesD.map(v => v.healthcare_professional_id)).size
    const couverture = cibles.length > 0 ? Math.round((ciblesVisitees / cibles.length) * 100) : 0
    const obj = objectifs.find(o => o.delegate_id === d.id && o.mois === `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
    return {
      ...d, totalCibles: cibles.length, ciblesVisitees, couverture,
      totalVisites: filteredVisites.filter(v => v.delegate_id === d.id).length,
      objectif: obj?.objectif_visites || 0,
      realisees: filteredVisites.filter(v => v.delegate_id === d.id && v.statut === 'Réalisée').length
    }
  }).sort((a, b) => b.couverture - a.couverture)

  const produitsCount = {}
  filteredVisites.forEach(v => {
    if (v.produit) {
      v.produit.split(',').forEach(p => {
        const nom = p.trim()
        if (nom) produitsCount[nom] = (produitsCount[nom] || 0) + 1
      })
    }
  })
  const topProduits = Object.entries(produitsCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const statsCampagnes = campagnes.map(c => {
    const cvs = filteredVisites.filter(v => v.campaign_id === c.id)
    const realisees = cvs.filter(v => v.statut === 'Réalisée')
    const validees = cvs.filter(v => v.confidence_status === 'validated')
    const suspectes = cvs.filter(v => v.confidence_status === 'suspicious')
    const progress = c.visits_objective > 0 ? Math.min(Math.round((realisees.length / c.visits_objective) * 100), 100) : 0
    return { ...c, total: cvs.length, realisees: realisees.length, validees: validees.length, suspectes: suspectes.length, progress }
  }).filter(c => c.total > 0)

  const totalAvecScore = filteredVisites.filter(v => v.confidence_score !== null)
  const avgScore = totalAvecScore.length > 0
    ? Math.round(totalAvecScore.reduce((s, v) => s + v.confidence_score, 0) / totalAvecScore.length) : 0
  const validated = filteredVisites.filter(v => v.confidence_status === 'validated').length
  const toCheck = filteredVisites.filter(v => v.confidence_status === 'to_check').length
  const suspicious = filteredVisites.filter(v => v.confidence_status === 'suspicious').length

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
          <h1 className="text-white font-semibold text-base">Statistiques avancées</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            {filteredVisites.length} visites · {MONTHS[filterMonth - 1]} {filterYear}
          </p>
        </div>
      </div>

      <div className="px-5 pt-4 grid grid-cols-3 gap-2">
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]" />
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
          className="p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
          <option value="tous">Toutes</option>
          {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <div className="bg-white flex border-b border-[#DDE4EA] mt-3">
        {[
          { id: 'couverture', label: 'Couverture' },
          { id: 'produits', label: 'Produits' },
          { id: 'campagnes', label: 'Campagnes' },
          { id: 'antitricha', label: 'Anti-triche' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t.id ? 'text-[#087F5B] border-b-2 border-[#087F5B]' : 'text-[#667085]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">

        {tab === 'couverture' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
                <p className="text-lg font-semibold text-[#172B4D]">{filteredVisites.length}</p>
                <p className="text-xs text-[#667085] mt-1">Visites</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
                <p className="text-lg font-semibold text-[#172B4D]">{portfolios.length}</p>
                <p className="text-xs text-[#667085] mt-1">Cibles</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]">
                <p className="text-lg font-semibold text-[#172B4D]">
                  {portfolios.length > 0
                    ? Math.round((new Set(filteredVisites.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size / portfolios.length) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-[#667085] mt-1">Couverture</p>
              </div>
            </div>

            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Par délégué</p>
            {couvertureDelegate.map(d => (
              <div key={d.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-[#667085]">
                      {d.ciblesVisitees} / {d.totalCibles} cibles · {d.realisees} réalisées
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg" style={{ color: progressColor(d.couverture) }}>{d.couverture}%</p>
                    {d.objectif > 0 && <p className="text-xs text-[#98A2B3]">{d.realisees}/{d.objectif} obj.</p>}
                  </div>
                </div>
                <div className="bg-[#EEF1F4] rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${d.couverture}%`, background: progressColor(d.couverture) }} />
                </div>
                {d.objectif > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-[#98A2B3] mt-1">
                      <span>Objectif visites</span>
                      <span>{Math.round((d.realisees / d.objectif) * 100)}%</span>
                    </div>
                    <div className="bg-[#EEF1F4] rounded-full h-1.5 mt-1">
                      <div className="bg-[#2563EB] h-1.5 rounded-full"
                        style={{ width: `${Math.min(Math.round((d.realisees / d.objectif) * 100), 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'produits' && (
          <>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
              Top produits présentés — {MONTHS[filterMonth - 1]} {filterYear}
            </p>
            {topProduits.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
                <p className="text-[#667085] text-sm">Aucune donnée produit</p>
              </div>
            ) : (
              topProduits.map(([nom, count], i) => {
                const max = topProduits[0][1]
                return (
                  <div key={nom} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs text-white"
                          style={{ background: i === 0 ? '#F59E0B' : i === 1 ? '#98A2B3' : i === 2 ? '#B45309' : '#DDE4EA' }}>{i + 1}</span>
                        <p className="font-semibold text-[#172B4D] text-sm">{nom}</p>
                      </div>
                      <p className="font-semibold text-[#087F5B]">{count} fois</p>
                    </div>
                    <div className="bg-[#EEF1F4] rounded-full h-2">
                      <div className="bg-[#087F5B] h-2 rounded-full" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'campagnes' && (
          <>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Performance par campagne</p>
            {statsCampagnes.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
                <p className="text-[#667085] text-sm">Aucune visite liée à une campagne</p>
              </div>
            ) : (
              statsCampagnes.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[#172B4D] text-sm">{c.nom}</p>
                      <p className="text-xs text-[#667085]">
                        {c.realisees} réalisées · {c.validees} validées · {c.suspectes} suspectes
                      </p>
                    </div>
                    <p className="font-semibold text-lg" style={{ color: progressColor(c.progress) }}>{c.progress}%</p>
                  </div>
                  {c.visits_objective > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-[#98A2B3] mb-1">
                        <span>Objectif : {c.visits_objective} visites</span>
                        <span>{c.realisees} / {c.visits_objective}</span>
                      </div>
                      <div className="bg-[#EEF1F4] rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${c.progress}%`, background: progressColor(c.progress) }} />
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {tab === 'antitricha' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#172B4D] rounded-xl p-4 text-center col-span-2">
                <p className="text-[#9AA9C2] text-xs font-semibold uppercase tracking-wide mb-1">Score moyen</p>
                <p className="text-white text-4xl font-semibold">{avgScore}</p>
                <p className="text-[#9AA9C2] text-xs mt-1">sur 100</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #16A34A' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{validated}</p>
                <p className="text-xs text-[#667085] mt-1">✅ Validées</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #F59E0B' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{toCheck}</p>
                <p className="text-xs text-[#667085] mt-1">⚠️ À contrôler</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-[#DDE4EA] col-span-2" style={{ borderLeft: '2px solid #DC2626' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{suspicious}</p>
                <p className="text-xs text-[#667085] mt-1">🚨 Suspectes</p>
              </div>
            </div>

            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Score par délégué</p>
            {delegates.map(d => {
              const dvs = filteredVisites.filter(v => v.delegate_id === d.id && v.confidence_score !== null)
              if (dvs.length === 0) return null
              const avg = Math.round(dvs.reduce((s, v) => s + v.confidence_score, 0) / dvs.length)
              const sus = dvs.filter(v => v.confidence_status === 'suspicious').length
              return (
                <div key={d.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                      <p className="text-xs text-[#667085]">{dvs.length} visites scorées · {sus} suspecte{sus > 1 ? 's' : ''}</p>
                    </div>
                    <p className="font-semibold text-xl" style={{ color: progressColor(avg) }}>{avg}</p>
                  </div>
                  <div className="bg-[#EEF1F4] rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${avg}%`, background: progressColor(avg) }} />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
