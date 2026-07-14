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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  const getStats = (delegateId) => {
    const dv = visites.filter((v) => v.delegate_id === delegateId)
    const done = dv.filter((v) => v.statut === 'Réalisée').length
    const doctors = new Set(dv.map((v) => v.medecin_id)).size
    const products = new Set(dv.map((v) => v.produit)).size
    const rate = dv.length > 0 ? Math.round((done / dv.length) * 100) : 0

    // Visites des 7 derniers jours
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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-black">Statistiques</h1>
      </div>

      {/* Liste des délégués */}
      {!selected && (
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Sélectionne un délégué</p>
          {delegates.map((d) => {
            const stats = getStats(d.id)
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d.id)}
                className="bg-white rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center font-black text-teal-600 text-lg">
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-blue-950">{d.prenom} {d.nom}</p>
                    <p className="text-slate-400 text-xs">{d.zone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-teal-500 text-2xl">{stats.total}</p>
                    <p className="text-slate-400 text-xs">visites</p>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Taux de réussite</span>
                    <span className="font-bold text-teal-500">{stats.rate}%</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-teal-400 rounded-full h-2 transition-all"
                      style={{ width: `${stats.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Détail d'un délégué */}
      {selected && selectedStats && (
        <div className="p-6 flex flex-col gap-4">
          {/* Profil */}
          <div className="bg-blue-950 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-400 flex items-center justify-center font-black text-blue-950 text-xl">
              {selectedDelegate?.prenom?.[0]}{selectedDelegate?.nom?.[0]}
            </div>
            <div>
              <p className="text-white font-black text-lg">{selectedDelegate?.prenom} {selectedDelegate?.nom}</p>
              <p className="text-teal-400 text-xs font-bold">{selectedDelegate?.zone}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{selectedStats.total}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites totales</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{selectedStats.rate}%</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Taux de réussite</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
              <p className="text-2xl font-black text-blue-950">{selectedStats.doctors}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Médecins visités</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400">
              <p className="text-2xl font-black text-blue-950">{selectedStats.products}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Produits présentés</p>
            </div>
          </div>

          {/* Graphique 7 jours */}
          <div className="bg-white rounded-2xl p-4">
            <p className="font-black text-blue-950 text-sm mb-4">Activité — 7 derniers jours</p>
            <div className="flex items-end gap-2 h-20">
              {selectedStats.week.map((w, i) => {
                const max = Math.max(...selectedStats.week.map((x) => x.count), 1)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-teal-400 rounded-t-md transition-all"
                      style={{ height: `${(w.count / max) * 60}px`, minHeight: w.count > 0 ? 4 : 0 }}
                    />
                    <span className="text-xs text-slate-400">{w.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Historique visites */}
          <div className="bg-white rounded-2xl p-4">
            <p className="font-black text-blue-950 text-sm mb-3">Historique des visites</p>
            {selectedStats.visites.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Aucune visite</p>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedStats.visites.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 pb-3 border-b border-slate-100">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${v.statut === 'Réalisée' ? 'bg-teal-400' : 'bg-rose-400'}`} />
                    <div className="flex-1">
                      <p className="font-bold text-blue-950 text-sm">Dr. {v.medecins?.nom || '—'}</p>
                      <p className="text-xs text-slate-400">{v.produit} · {v.created_at?.slice(0, 10)}</p>
                      {v.note && <p className="text-xs text-slate-500 italic mt-1">{v.note}</p>}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                      {v.statut}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setSelected(null)}
            className="w-full bg-slate-200 text-slate-600 font-black py-3 rounded-2xl text-sm"
          >
            ← Retour aux délégués
          </button>
        </div>
      )}
    </div>
  )
}