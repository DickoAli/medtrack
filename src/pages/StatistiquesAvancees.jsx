import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function StatistiquesAvancees({ onBack, profile }) {
  const [visites, setVisites] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('couverture')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterCampaign, setFilterCampaign] = useState('tous')

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: v }, { data: d }, { data: c }, { data: p }, { data: t }, { data: o }] = await Promise.all([
      supabase.from('visites').select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, potential), campaigns(nom), establishments(nom, territory_id)').eq('agence_id', profile.agence_id),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('delegate_portfolios').select('*, healthcare_professionals(nom, prenom, potential)').eq('agence_id', profile.agence_id),
      supabase.from('territories').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('objectifs').select('*').eq('agence_id', profile.agence_id)
    ])
    setVisites(v || [])
    setDelegates(d || [])
    setCampagnes(c || [])
    setPortfolios(p || [])
    setTerritoires(t || [])
    setObjectifs(o || [])
    setLoading(false)
  }

  const filteredVisites = visites.filter(v => {
    const matchMonth = new Date(v.created_at).getMonth() + 1 === filterMonth
    const matchYear = new Date(v.created_at).getFullYear() === filterYear
    const matchCampaign = filterCampaign === 'tous' || v.campaign_id === filterCampaign
    return matchMonth && matchYear && matchCampaign
  })

  // Couverture par délégué
  const couvertureDelegate = delegates.map(d => {
    const cibles = portfolios.filter(p => p.delegate_id === d.id)
    const visitesD = filteredVisites.filter(v => v.delegate_id === d.id && v.healthcare_professional_id)
    const ciblesVisitees = new Set(visitesD.map(v => v.healthcare_professional_id)).size
    const couverture = cibles.length > 0 ? Math.round((ciblesVisitees / cibles.length) * 100) : 0
    const obj = objectifs.find(o => o.delegate_id === d.id && o.mois === `${filterYear}-${String(filterMonth).padStart(2, '0')}`)
    return {
      ...d,
      totalCibles: cibles.length,
      ciblesVisitees,
      couverture,
      totalVisites: filteredVisites.filter(v => v.delegate_id === d.id).length,
      objectif: obj?.objectif_visites || 0,
      realisees: filteredVisites.filter(v => v.delegate_id === d.id && v.statut === 'Réalisée').length
    }
  }).sort((a, b) => b.couverture - a.couverture)

  // Top produits présentés
  const produitsCount = {}
  filteredVisites.forEach(v => {
    if (v.produit) {
      v.produit.split(',').forEach(p => {
        const nom = p.trim()
        if (nom) produitsCount[nom] = (produitsCount[nom] || 0) + 1
      })
    }
  })
  const topProduits = Object.entries(produitsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Stats par campagne
  const statsCampagnes = campagnes.map(c => {
    const cvs = filteredVisites.filter(v => v.campaign_id === c.id)
    const realisees = cvs.filter(v => v.statut === 'Réalisée')
    const validees = cvs.filter(v => v.confidence_status === 'validated')
    const suspectes = cvs.filter(v => v.confidence_status === 'suspicious')
    const progress = c.visits_objective > 0
      ? Math.min(Math.round((realisees.length / c.visits_objective) * 100), 100)
      : 0
    return { ...c, total: cvs.length, realisees: realisees.length, validees: validees.length, suspectes: suspectes.length, progress }
  }).filter(c => c.total > 0)

  // Anti-triche global
  const totalAvecScore = filteredVisites.filter(v => v.confidence_score !== null)
  const avgScore = totalAvecScore.length > 0
    ? Math.round(totalAvecScore.reduce((s, v) => s + v.confidence_score, 0) / totalAvecScore.length)
    : 0
  const validated = filteredVisites.filter(v => v.confidence_status === 'validated').length
  const toCheck = filteredVisites.filter(v => v.confidence_status === 'to_check').length
  const suspicious = filteredVisites.filter(v => v.confidence_status === 'suspicious').length

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
          <h1 className="text-white font-black text-lg">Statistiques avancées</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            {filteredVisites.length} visites · {MONTHS[filterMonth - 1]} {filterYear}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 grid grid-cols-3 gap-2">
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="p-2 rounded-xl border border-slate-200 bg-white text-xs">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="p-2 rounded-xl border border-slate-200 bg-white text-xs" />
        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
          className="p-2 rounded-xl border border-slate-200 bg-white text-xs">
          <option value="tous">Toutes</option>
          {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200 mt-3">
        {[
          { id: 'couverture', label: '🎯 Couverture' },
          { id: 'produits', label: '💊 Produits' },
          { id: 'campagnes', label: '📋 Campagnes' },
          { id: 'antitricha', label: '🔒 Anti-triche' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${
              tab === t.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* COUVERTURE */}
        {tab === 'couverture' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-teal-400">
                <p className="text-xl font-black text-blue-950">{filteredVisites.length}</p>
                <p className="text-xs text-slate-500 font-bold mt-1">Visites</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-blue-400">
                <p className="text-xl font-black text-blue-950">{portfolios.length}</p>
                <p className="text-xs text-slate-500 font-bold mt-1">Cibles</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-purple-400">
                <p className="text-xl font-black text-blue-950">
                  {portfolios.length > 0
                    ? Math.round((new Set(filteredVisites.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size / portfolios.length) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-slate-500 font-bold mt-1">Couverture</p>
              </div>
            </div>

            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Par délégué</p>
            {couvertureDelegate.map(d => (
              <div key={d.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-black text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-slate-400">
                      {d.ciblesVisitees} / {d.totalCibles} cibles · {d.realisees} réalisées
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-lg ${
                      d.couverture >= 80 ? 'text-teal-500' :
                      d.couverture >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{d.couverture}%</p>
                    {d.objectif > 0 && (
                      <p className="text-xs text-slate-400">{d.realisees}/{d.objectif} obj.</p>
                    )}
                  </div>
                </div>
                <div className="bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${
                    d.couverture >= 80 ? 'bg-teal-400' :
                    d.couverture >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`} style={{ width: `${d.couverture}%` }} />
                </div>
                {d.objectif > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Objectif visites</span>
                      <span>{Math.round((d.realisees / d.objectif) * 100)}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 mt-1">
                      <div className="bg-blue-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(Math.round((d.realisees / d.objectif) * 100), 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {/* PRODUITS */}
        {tab === 'produits' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Top produits présentés — {MONTHS[filterMonth - 1]} {filterYear}
            </p>
            {topProduits.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">Aucune donnée produit</p>
              </div>
            ) : (
              topProduits.map(([nom, count], i) => {
                const max = topProduits[0][1]
                return (
                  <div key={nom} className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                          i === 0 ? 'bg-amber-400 text-white' :
                          i === 1 ? 'bg-slate-300 text-white' :
                          i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>{i + 1}</span>
                        <p className="font-black text-blue-950 text-sm">{nom}</p>
                      </div>
                      <p className="font-black text-teal-500">{count} fois</p>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div className="bg-teal-400 h-2 rounded-full"
                        style={{ width: `${Math.round((count / max) * 100)}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* CAMPAGNES */}
        {tab === 'campagnes' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Performance par campagne</p>
            {statsCampagnes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">Aucune visite liée à une campagne</p>
              </div>
            ) : (
              statsCampagnes.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-black text-blue-950 text-sm">{c.nom}</p>
                      <p className="text-xs text-slate-400">
                        {c.realisees} réalisées · {c.validees} validées · {c.suspectes} suspectes
                      </p>
                    </div>
                    <p className={`font-black text-lg ${
                      c.progress >= 80 ? 'text-teal-500' :
                      c.progress >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{c.progress}%</p>
                  </div>
                  {c.visits_objective > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Objectif : {c.visits_objective} visites</span>
                        <span>{c.realisees} / {c.visits_objective}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${
                          c.progress >= 80 ? 'bg-teal-400' :
                          c.progress >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                        }`} style={{ width: `${c.progress}%` }} />
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ANTI-TRICHE */}
        {tab === 'antitricha' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-950 rounded-2xl p-4 text-center col-span-2">
                <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">Score moyen</p>
                <p className="text-white text-4xl font-black">{avgScore}</p>
                <p className="text-teal-400 text-xs mt-1">sur 100</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-green-400">
                <p className="text-2xl font-black text-blue-950">{validated}</p>
                <p className="text-xs text-slate-500 font-bold mt-1">✅ Validées</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-amber-400">
                <p className="text-2xl font-black text-blue-950">{toCheck}</p>
                <p className="text-xs text-slate-500 font-bold mt-1">⚠️ À contrôler</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border-l-4 border-rose-400 col-span-2">
                <p className="text-2xl font-black text-blue-950">{suspicious}</p>
                <p className="text-xs text-slate-500 font-bold mt-1">🚨 Suspectes</p>
              </div>
            </div>

            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Score par délégué</p>
            {delegates.map(d => {
              const dvs = filteredVisites.filter(v => v.delegate_id === d.id && v.confidence_score !== null)
              if (dvs.length === 0) return null
              const avg = Math.round(dvs.reduce((s, v) => s + v.confidence_score, 0) / dvs.length)
              const sus = dvs.filter(v => v.confidence_status === 'suspicious').length
              return (
                <div key={d.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-black text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                      <p className="text-xs text-slate-400">
                        {dvs.length} visites scorées · {sus} suspecte{sus > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className={`font-black text-xl ${
                      avg >= 80 ? 'text-teal-500' :
                      avg >= 50 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{avg}</p>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      avg >= 80 ? 'bg-teal-400' :
                      avg >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                    }`} style={{ width: `${avg}%` }} />
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