import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Statistiques({ onBack , profile }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

 const fetchData = async () => {
    const { data: d } = await supabase
      .from('delegates')
      .select('*')
      .eq('agence_id', profile.agence_id)

    const { data: v } = await supabase
      .from('visites')
      .select('*, medecins(*)')
      .eq('agence_id', profile.agence_id)
      .order('created_at', { ascending: false })

    setDelegates(d || [])
    setVisites(v || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  const getStats = (delegateId) => {
    const dv = visites.filter((v) => v.delegate_id === delegateId)
    const done = dv.filter((v) => v.statut === 'Réalisée').length
    const doctors = new Set(dv.map((v) => v.medecin_id)).size
    const products = new Set(dv.map((v) => v.produit)).size
    const rate = dv.length > 0 ? Math.round((done / dv.length) * 100) : 0

    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const ds = d.toISOString().slice(0, 10)
      const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
      return {
        label: days[d.getDay()],
        count: dv.filter((v) => v.created_at?.slice(0, 10) === ds).length
      }
    })

    return { total: dv.length, done, doctors, products, rate, week, visites: dv }
  }

  const selectedDelegate = delegates.find((d) => d.id === selected)
  const selectedStats = selected ? getStats(selected) : null
  const progressColor = v => v >= 80 ? '#087F5B' : v >= 50 ? '#F59E0B' : '#DC2626'

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-semibold text-base">Statistiques</h1>
      </div>

      {!selected && (
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">Sélectionne un délégué</p>
          {delegates.map((d) => {
            const stats = getStats(d.id)
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d.id)}
                className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow border border-[#DDE4EA]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#E7F5EF] flex items-center justify-center font-semibold text-[#087F5B] text-lg">
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#172B4D]">{d.prenom} {d.nom}</p>
                    <p className="text-[#98A2B3] text-xs">{d.zone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#087F5B] text-2xl">{stats.total}</p>
                    <p className="text-[#98A2B3] text-xs">visites</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-[#667085] mb-1">
                    <span>Taux de réussite</span>
                    <span className="font-semibold" style={{ color: progressColor(stats.rate) }}>{stats.rate}%</span>
                  </div>
                  <div className="bg-[#EEF1F4] rounded-full h-2">
                    <div className="rounded-full h-2 transition-all" style={{ width: `${stats.rate}%`, background: progressColor(stats.rate) }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && selectedStats && (
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-[#172B4D] rounded-xl p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#087F5B] flex items-center justify-center font-semibold text-white text-xl">
              {selectedDelegate?.prenom?.[0]}{selectedDelegate?.nom?.[0]}
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{selectedDelegate?.prenom} {selectedDelegate?.nom}</p>
              <p className="text-[#9AA9C2] text-xs font-medium">{selectedDelegate?.zone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{selectedStats.total}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Visites totales</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #F59E0B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{selectedStats.rate}%</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Taux de réussite</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{selectedStats.doctors}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Médecins visités</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="text-xl font-semibold text-[#172B4D]">{selectedStats.products}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Produits présentés</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="font-semibold text-[#172B4D] text-sm mb-4">Activité — 7 derniers jours</p>
            <div className="flex items-end gap-2 h-20">
              {selectedStats.week.map((w, i) => {
                const max = Math.max(...selectedStats.week.map((x) => x.count), 1)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[#087F5B] rounded-t-md transition-all"
                      style={{ height: `${(w.count / max) * 60}px`, minHeight: w.count > 0 ? 4 : 0 }} />
                    <span className="text-xs text-[#98A2B3]">{w.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="font-semibold text-[#172B4D] text-sm mb-3">Historique des visites</p>
            {selectedStats.visites.length === 0 ? (
              <p className="text-[#98A2B3] text-sm text-center py-4">Aucune visite</p>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedStats.visites.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 pb-3 border-b border-[#F4F7F9]">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${v.statut === 'Réalisée' ? 'bg-[#087F5B]' : 'bg-[#DC2626]'}`} />
                    <div className="flex-1">
                      <p className="font-semibold text-[#172B4D] text-sm">Dr. {v.medecins?.nom || '—'}</p>
                      <p className="text-xs text-[#667085]">{v.produit} · {v.created_at?.slice(0, 10)}</p>
                      {v.note && <p className="text-xs text-[#98A2B3] italic mt-1">{v.note}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                      v.statut === 'Réalisée' ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
                    }`}>{v.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setSelected(null)}
            className="w-full bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-xl text-sm">
            ← Retour aux délégués
          </button>
        </div>
      )}
    </div>
  )
}
