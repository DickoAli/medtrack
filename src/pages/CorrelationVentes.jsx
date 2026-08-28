import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function CorrelationVentes({ onBack, profile }) {
  const [produits, setProduits] = useState([])
  const [ventes, setVentes] = useState([])
  const [visites, setVisites] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProduit, setFilterProduit] = useState('tous')
  const [filterCampaign, setFilterCampaign] = useState('tous')
  const [nbMois, setNbMois] = useState(6)

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: p }, { data: v }, { data: vi }, { data: c }] = await Promise.all([
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('statut_produit', 'Normal').order('nom'),
      supabase.from('aggregated_sales').select('*, produits(nom)').eq('agence_id', profile.agence_id).order('period_year').order('period_month'),
      supabase.from('visites').select('*').eq('agence_id', profile.agence_id).order('created_at'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setProduits(p || [])
    setVentes(v || [])
    setVisites(vi || [])
    setCampagnes(c || [])
    setLoading(false)
  }

  // Générer les N derniers mois
  const getLast6Months = () => {
    return Array.from({ length: nbMois }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (nbMois - 1 - i))
      return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] }
    })
  }

  const months = getLast6Months()

  // Données par produit et par mois
  const getCorrelationData = () => {
    const produitsFiltered = filterProduit === 'tous'
      ? produits
      : produits.filter(p => p.id === filterProduit)

    return produitsFiltered.map(produit => {
      const data = months.map(m => {
        // Ventes ce mois
        const vente = ventes.find(v =>
          v.produit_id === produit.id &&
          v.period_month === m.month &&
          v.period_year === m.year
        )

        // Visites ce mois avec ce produit
        const monthStart = `${m.year}-${String(m.month).padStart(2, '0')}-01`
        const monthEnd = `${m.year}-${String(m.month).padStart(2, '0')}-31`
        const visitesMonth = visites.filter(v => {
          const inMonth = v.created_at >= monthStart && v.created_at <= monthEnd
          const hasProduct = v.produit && v.produit.toLowerCase().includes(produit.nom.toLowerCase())
          const inCampaign = filterCampaign === 'tous' || v.campaign_id === filterCampaign
          return inMonth && hasProduct && inCampaign
        })

        return {
          ...m,
          ventes: vente?.total_quantity || 0,
          visites: visitesMonth.length,
          realisees: visitesMonth.filter(v => v.statut === 'Réalisée').length
        }
      })

      const totalVentes = data.reduce((s, d) => s + d.ventes, 0)
      const totalVisites = data.reduce((s, d) => s + d.realisees, 0)

      return { produit, data, totalVentes, totalVisites }
    }).filter(d => d.totalVentes > 0 || d.totalVisites > 0)
  }

  const correlationData = getCorrelationData()

  // Calcul corrélation simple
  const getCorrelationScore = (data) => {
    const ventesArr = data.map(d => d.ventes)
    const visitesArr = data.map(d => d.realisees)
    const n = data.length
    if (n < 2) return null

    const avgV = ventesArr.reduce((s, v) => s + v, 0) / n
    const avgVi = visitesArr.reduce((s, v) => s + v, 0) / n

    const num = data.reduce((s, d, i) => s + (ventesArr[i] - avgV) * (visitesArr[i] - avgVi), 0)
    const denV = Math.sqrt(ventesArr.reduce((s, v) => s + Math.pow(v - avgV, 2), 0))
    const denVi = Math.sqrt(visitesArr.reduce((s, v) => s + Math.pow(v - avgVi, 2), 0))

    if (denV === 0 || denVi === 0) return null
    return (num / (denV * denVi)).toFixed(2)
  }

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
          <h1 className="text-white font-black text-lg">Corrélation</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            Visites terrain vs Ventes grossistes
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-xs text-amber-700 font-bold">
            ⚠️ Ces données montrent une corrélation, pas une causalité. Une visite ne cause pas directement une vente.
          </p>
        </div>

        <select value={filterProduit} onChange={e => setFilterProduit(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les produits</option>
          {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>

        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Toutes les campagnes</option>
          {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>

        <div className="flex gap-2">
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => setNbMois(n)}
              className={`flex-1 py-2 rounded-xl text-xs font-black border transition-colors ${
                nbMois === n ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              {n} mois
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 pb-10">

        {correlationData.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-slate-400 text-sm font-bold">Aucune donnée disponible</p>
            <p className="text-slate-300 text-xs mt-1">Importez des ventes grossistes et enregistrez des visites</p>
          </div>
        ) : (
          correlationData.map(({ produit, data, totalVentes, totalVisites }) => {
            const corrScore = getCorrelationScore(data)
            const maxVentes = Math.max(...data.map(d => d.ventes), 1)
            const maxVisites = Math.max(...data.map(d => d.realisees), 1)

            return (
              <div key={produit.id} className="bg-white rounded-2xl p-4">
                {/* Header produit */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-black text-blue-950 text-sm">{produit.nom}</p>
                    {produit.dci && <p className="text-xs text-slate-400">DCI: {produit.dci}</p>}
                  </div>
                  {corrScore !== null && (
                    <div className="text-right">
                      <p className={`font-black text-lg ${
                        parseFloat(corrScore) >= 0.7 ? 'text-teal-500' :
                        parseFloat(corrScore) >= 0.4 ? 'text-amber-500' :
                        parseFloat(corrScore) >= 0 ? 'text-slate-400' : 'text-rose-500'
                      }`}>{corrScore}</p>
                      <p className="text-xs text-slate-400">corrélation</p>
                    </div>
                  )}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-teal-50 rounded-xl p-3 text-center">
                    <p className="font-black text-teal-500 text-xl">{totalVentes.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">unités vendues</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="font-black text-blue-500 text-xl">{totalVisites}</p>
                    <p className="text-xs text-slate-400">visites réalisées</p>
                  </div>
                </div>

                {/* Graphique comparatif */}
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Évolution comparative
                </p>
                <div className="flex items-end gap-1.5 h-28">
                  {data.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex gap-0.5 items-end" style={{ height: '80px' }}>
                        {/* Barre ventes */}
                        <div className="flex-1 bg-teal-400 rounded-t-sm transition-all"
                          style={{ height: `${maxVentes > 0 ? Math.max((m.ventes / maxVentes) * 80, m.ventes > 0 ? 4 : 0) : 0}px` }}
                          title={`Ventes: ${m.ventes}`} />
                        {/* Barre visites */}
                        <div className="flex-1 bg-blue-400 rounded-t-sm transition-all"
                          style={{ height: `${maxVisites > 0 ? Math.max((m.realisees / maxVisites) * 80, m.realisees > 0 ? 4 : 0) : 0}px` }}
                          title={`Visites: ${m.realisees}`} />
                      </div>
                      <p className="text-xs text-slate-400">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Légende */}
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-teal-400" />
                    <span className="text-xs text-slate-400">Ventes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-blue-400" />
                    <span className="text-xs text-slate-400">Visites</span>
                  </div>
                </div>

                {/* Interprétation corrélation */}
                {corrScore !== null && (
                  <div className={`mt-3 rounded-xl p-3 ${
                    parseFloat(corrScore) >= 0.7 ? 'bg-teal-50 border border-teal-200' :
                    parseFloat(corrScore) >= 0.4 ? 'bg-amber-50 border border-amber-200' :
                    parseFloat(corrScore) >= 0 ? 'bg-slate-50 border border-slate-200' :
                    'bg-rose-50 border border-rose-200'
                  }`}>
                    <p className={`text-xs font-bold ${
                      parseFloat(corrScore) >= 0.7 ? 'text-teal-600' :
                      parseFloat(corrScore) >= 0.4 ? 'text-amber-600' :
                      parseFloat(corrScore) >= 0 ? 'text-slate-500' : 'text-rose-500'
                    }`}>
                      {parseFloat(corrScore) >= 0.7 ? '📈 Corrélation forte — les visites terrain semblent associées aux ventes' :
                       parseFloat(corrScore) >= 0.4 ? '📊 Corrélation modérée — lien partiel entre activité terrain et ventes' :
                       parseFloat(corrScore) >= 0 ? '➡️ Corrélation faible — peu de lien observable' :
                       '📉 Corrélation négative — tendances opposées'}
                    </p>
                  </div>
                )}

                {/* Tableau détaillé */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="text-left py-1">Mois</th>
                        <th className="text-right py-1">Ventes</th>
                        <th className="text-right py-1">Visites</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((m, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-1 text-slate-600">{m.label} {m.year}</td>
                          <td className="py-1 text-right font-bold text-teal-500">{m.ventes.toLocaleString()}</td>
                          <td className="py-1 text-right font-bold text-blue-500">{m.realisees}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}