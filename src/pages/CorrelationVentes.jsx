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
  const [nbMois, setNbMois] = useState(6) // 3 | 6 | 12 | 'mois'
  const [selectedMonth, setSelectedMonth] = useState(null) // { month, year }

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

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

    // Mois disponibles = mois où des ventes ont réellement été importées.
    // Sélection par défaut : le plus récent.
    const moisDisponibles = [...new Set((v || []).map(x => `${x.period_year}-${String(x.period_month).padStart(2, '0')}`))]
      .sort().reverse()
    if (moisDisponibles.length > 0 && !selectedMonth) {
      const [year, month] = moisDisponibles[0].split('-').map(Number)
      setSelectedMonth({ year, month })
    }
  }

  const getAvailableMonths = () => {
    const set = new Set(ventes.map(v => `${v.period_year}-${String(v.period_month).padStart(2, '0')}`))
    return [...set].sort().reverse().map(key => {
      const [year, month] = key.split('-').map(Number)
      return { year, month }
    })
  }

  const getLastNMonths = () => {
    return Array.from({ length: nbMois }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (nbMois - 1 - i))
      return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] }
    })
  }

  const months = nbMois !== 'mois' ? getLastNMonths() : []

  // ===== Mode temporel (3 / 6 / 12 mois) — inchangé =====
  const getCorrelationData = () => {
    const produitsFiltered = filterProduit === 'tous' ? produits : produits.filter(p => p.id === filterProduit)

    return produitsFiltered.map(produit => {
      const data = months.map(m => {
        const vente = ventes.find(v => v.produit_id === produit.id && v.period_month === m.month && v.period_year === m.year)
        const monthStart = `${m.year}-${String(m.month).padStart(2, '0')}-01`
        const monthEnd = `${m.year}-${String(m.month).padStart(2, '0')}-31`
        const visitesMonth = visites.filter(v => {
          const inMonth = v.created_at >= monthStart && v.created_at <= monthEnd
          const hasProduct = v.produit && v.produit.toLowerCase().includes(produit.nom.toLowerCase())
          const inCampaign = filterCampaign === 'tous' || v.campaign_id === filterCampaign
          return inMonth && hasProduct && inCampaign
        })
        return { ...m, ventes: vente?.total_quantity || 0, visites: visitesMonth.length, realisees: visitesMonth.filter(v => v.statut === 'Réalisée').length }
      })

      const totalVentes = data.reduce((s, d) => s + d.ventes, 0)
      const totalVisites = data.reduce((s, d) => s + d.realisees, 0)

      return { produit, data, totalVentes, totalVisites }
    }).filter(d => d.totalVentes > 0 || d.totalVisites > 0)
  }

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

  // ===== Mode "1 mois" — tous les produits comparés côte à côte =====
  const getSingleMonthData = () => {
    if (!selectedMonth) return []
    const produitsFiltered = filterProduit === 'tous' ? produits : produits.filter(p => p.id === filterProduit)
    const monthStart = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
    const monthEnd = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-31`

    const rows = produitsFiltered.map(produit => {
      const vente = ventes.find(v => v.produit_id === produit.id && v.period_month === selectedMonth.month && v.period_year === selectedMonth.year)
      const visitesMonth = visites.filter(v => {
        const inMonth = v.created_at >= monthStart && v.created_at <= monthEnd
        const hasProduct = v.produit && v.produit.toLowerCase().includes(produit.nom.toLowerCase())
        const inCampaign = filterCampaign === 'tous' || v.campaign_id === filterCampaign
        return inMonth && hasProduct && inCampaign && v.statut === 'Réalisée'
      })
      const totalVentes = vente?.total_quantity || 0
      const totalVisites = visitesMonth.length

      // Écart en % — base 100 = visites, compare à quel point les ventes suivent ou non.
      // Si l'une des deux valeurs est nulle, l'écart est signalé sans division par zéro.
      let ecartPct = null
      if (totalVisites > 0 && totalVentes > 0) {
        ecartPct = Math.round(((totalVentes - totalVisites) / totalVisites) * 100)
      }

      return { produit, totalVentes, totalVisites, ecartPct }
    }).filter(d => d.totalVentes > 0 || d.totalVisites > 0)

    // Trie par écart absolu décroissant — les anomalies les plus flagrantes en premier.
    // Les lignes sans écart calculable (une des deux valeurs à 0) sont mises en avant aussi,
    // car "ventes sans visite" ou "visites sans vente" sont déjà des signaux forts en soi.
    return rows.sort((a, b) => {
      const aScore = a.ecartPct !== null ? Math.abs(a.ecartPct) : (a.totalVentes === 0 || a.totalVisites === 0 ? 999 : 0)
      const bScore = b.ecartPct !== null ? Math.abs(b.ecartPct) : (b.totalVentes === 0 || b.totalVisites === 0 ? 999 : 0)
      return bScore - aScore
    })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  const correlationData = nbMois !== 'mois' ? getCorrelationData() : []
  const singleMonthData = nbMois === 'mois' ? getSingleMonthData() : []
  const availableMonths = getAvailableMonths()

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-semibold text-base">Corrélation</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            Visites terrain vs Ventes grossistes
          </p>
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <div className="bg-[#FEF3E2] border border-[#F59E0B]/30 rounded-xl p-3">
          <p className="text-xs text-[#B45309] font-semibold">
            ⚠️ Ces données montrent une corrélation, pas une causalité. Une visite ne cause pas directement une vente.
          </p>
        </div>

        <select value={filterProduit} onChange={e => setFilterProduit(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les produits</option>
          {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>

        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Toutes les campagnes</option>
          {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>

        <div className="flex gap-2">
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => setNbMois(n)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                nbMois === n ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
              }`}>
              {n} mois
            </button>
          ))}
          <button onClick={() => setNbMois('mois')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              nbMois === 'mois' ? 'bg-[#087F5B] text-white border-[#087F5B]' : 'bg-white text-[#667085] border-[#DDE4EA]'
            }`}>
            1 mois
          </button>
        </div>

        {nbMois === 'mois' && (
          availableMonths.length === 0 ? (
            <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
              <p className="text-xs text-[#667085]">Aucune donnée de vente importée pour l'instant — importez des ventes grossistes pour utiliser la vue mensuelle.</p>
            </div>
          ) : (
            <select
              value={selectedMonth ? `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}` : ''}
              onChange={e => {
                const [year, month] = e.target.value.split('-').map(Number)
                setSelectedMonth({ year, month })
              }}
              className="w-full p-3 rounded-lg border border-[#087F5B] bg-white text-sm text-[#172B4D] font-semibold">
              {availableMonths.map(m => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${String(m.month).padStart(2, '0')}`}>
                  {MONTHS_FULL[m.month - 1]} {m.year}
                </option>
              ))}
            </select>
          )
        )}
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">

        {/* ===== VUE MENSUELLE — produits côte à côte ===== */}
        {nbMois === 'mois' && selectedMonth && (
          singleMonthData.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-[#667085] text-sm font-medium">Aucune donnée pour {MONTHS_FULL[selectedMonth.month - 1]} {selectedMonth.year}</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
                {MONTHS_FULL[selectedMonth.month - 1]} {selectedMonth.year} — {singleMonthData.length} produit{singleMonthData.length > 1 ? 's' : ''}, triés par écart le plus marqué
              </p>
              {singleMonthData.map(({ produit, totalVentes, totalVisites, ecartPct }) => {
                const maxVal = Math.max(totalVentes, totalVisites, 1)
                const noVisite = totalVisites === 0 && totalVentes > 0
                const noVente = totalVentes === 0 && totalVisites > 0
                const badgeColor = noVisite || noVente ? '#DC2626' : (ecartPct !== null && Math.abs(ecartPct) >= 50) ? '#F59E0B' : '#087F5B'

                return (
                  <div key={produit.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-[#172B4D] text-sm">{produit.nom}</p>
                        {produit.dci && <p className="text-xs text-[#667085]">DCI: {produit.dci}</p>}
                      </div>
                      <div className="text-right">
                        {noVisite ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#FDE8E8] text-[#DC2626]">Vendu, jamais visité</span>
                        ) : noVente ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#FDE8E8] text-[#DC2626]">Visité, aucune vente</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: badgeColor + '20', color: badgeColor }}>
                            {ecartPct > 0 ? '+' : ''}{ecartPct}% ventes vs visites
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#667085]">Visites réalisées</span>
                          <span className="font-semibold text-[#2563EB]">{totalVisites}</span>
                        </div>
                        <div className="bg-[#EEF1F4] rounded-full h-2.5">
                          <div className="bg-[#2563EB] h-2.5 rounded-full" style={{ width: `${(totalVisites / maxVal) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#667085]">Unités vendues</span>
                          <span className="font-semibold text-[#087F5B]">{totalVentes.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#EEF1F4] rounded-full h-2.5">
                          <div className="bg-[#087F5B] h-2.5 rounded-full" style={{ width: `${(totalVentes / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )
        )}

        {/* ===== VUE TEMPORELLE — 3/6/12 mois (inchangée) ===== */}
        {nbMois !== 'mois' && (
          correlationData.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-[#667085] text-sm font-medium">Aucune donnée disponible</p>
              <p className="text-[#98A2B3] text-xs mt-1">Importez des ventes grossistes et enregistrez des visites</p>
            </div>
          ) : (
            correlationData.map(({ produit, data, totalVentes, totalVisites }) => {
              const corrScore = getCorrelationScore(data)
              const maxVentes = Math.max(...data.map(d => d.ventes), 1)
              const maxVisites = Math.max(...data.map(d => d.realisees), 1)

              const scoreColor = corrScore !== null
                ? (parseFloat(corrScore) >= 0.7 ? '#087F5B' : parseFloat(corrScore) >= 0.4 ? '#F59E0B' : parseFloat(corrScore) >= 0 ? '#98A2B3' : '#DC2626')
                : '#98A2B3'

              return (
                <div key={produit.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-[#172B4D] text-sm">{produit.nom}</p>
                      {produit.dci && <p className="text-xs text-[#667085]">DCI: {produit.dci}</p>}
                    </div>
                    {corrScore !== null && (
                      <div className="text-right">
                        <p className="font-semibold text-lg" style={{ color: scoreColor }}>{corrScore}</p>
                        <p className="text-xs text-[#98A2B3]">corrélation</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#E7F5EF] rounded-lg p-3 text-center">
                      <p className="font-semibold text-[#087F5B] text-xl">{totalVentes.toLocaleString()}</p>
                      <p className="text-xs text-[#98A2B3]">unités vendues</p>
                    </div>
                    <div className="bg-[#E8F0FE] rounded-lg p-3 text-center">
                      <p className="font-semibold text-[#2563EB] text-xl">{totalVisites}</p>
                      <p className="text-xs text-[#98A2B3]">visites réalisées</p>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
                    Évolution comparative
                  </p>
                  <div className="flex items-end gap-1.5 h-28">
                    {data.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full flex gap-0.5 items-end" style={{ height: '80px' }}>
                          <div className="flex-1 bg-[#087F5B] rounded-t-sm transition-all"
                            style={{ height: `${maxVentes > 0 ? Math.max((m.ventes / maxVentes) * 80, m.ventes > 0 ? 4 : 0) : 0}px` }}
                            title={`Ventes: ${m.ventes}`} />
                          <div className="flex-1 bg-[#2563EB] rounded-t-sm transition-all"
                            style={{ height: `${maxVisites > 0 ? Math.max((m.realisees / maxVisites) * 80, m.realisees > 0 ? 4 : 0) : 0}px` }}
                            title={`Visites: ${m.realisees}`} />
                        </div>
                        <p className="text-xs text-[#98A2B3]">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-[#087F5B]" />
                      <span className="text-xs text-[#98A2B3]">Ventes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-[#2563EB]" />
                      <span className="text-xs text-[#98A2B3]">Visites</span>
                    </div>
                  </div>

                  {corrScore !== null && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: scoreColor + '15', border: `1px solid ${scoreColor}30` }}>
                      <p className="text-xs font-semibold" style={{ color: scoreColor }}>
                        {parseFloat(corrScore) >= 0.7 ? '📈 Corrélation forte — les visites terrain semblent associées aux ventes' :
                         parseFloat(corrScore) >= 0.4 ? '📊 Corrélation modérée — lien partiel entre activité terrain et ventes' :
                         parseFloat(corrScore) >= 0 ? '➡️ Corrélation faible — peu de lien observable' :
                         '📉 Corrélation négative — tendances opposées'}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#98A2B3] border-b border-[#DDE4EA]">
                          <th className="text-left py-1">Mois</th>
                          <th className="text-right py-1">Ventes</th>
                          <th className="text-right py-1">Visites</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((m, i) => (
                          <tr key={i} className="border-b border-[#F4F7F9]">
                            <td className="py-1 text-[#667085]">{m.label} {m.year}</td>
                            <td className="py-1 text-right font-semibold text-[#087F5B]">{m.ventes.toLocaleString()}</td>
                            <td className="py-1 text-right font-semibold text-[#2563EB]">{m.realisees}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}
