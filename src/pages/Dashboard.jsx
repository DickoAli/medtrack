import Extranet from './Extranet'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import NouvelleVisite from './NouvelleVisite'
import Carte from './Carte'
import Statistiques from './Statistiques'
import StatistiquesAvancees from './StatistiquesAvancees'
import Rapports from './Rapports'
import GestionDelegues from './GestionDelegues'
import GestionProduits from './GestionProduits'
import GestionLabos from './GestionLabos'
import GestionComptes from './GestionComptes'

export default function Dashboard({ session, profile, agence }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: delegatesData } = await supabase
      .from('delegates')
      .select('*')
      .eq('agence_id', profile.agence_id)

    const { data: visitesData } = await supabase
      .from('visites')
      .select('*, delegates(*), medecins(*)')
      .eq('agence_id', profile.agence_id)
      .order('created_at', { ascending: false })

    setDelegates(delegatesData || [])
    setVisites(visitesData || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  if (page === 'nouvelle-visite') return (
    <NouvelleVisite profile={profile} onBack={() => { setPage('dashboard'); fetchData() }} />
  )
if (page === 'extranet') return (
  <Extranet profile={profile} onBack={() => setPage('dashboard')} />
)
  if (page === 'carte') return (
    <Carte profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'statistiques') return (
    <Statistiques profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'rapports') return (
    <Rapports profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'stats-avancees') return (
    <StatistiquesAvancees profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'delegues') return (
    <GestionDelegues profile={profile} onBack={() => { setPage('dashboard'); fetchData() }} />
  )

  if (page === 'produits') return (
    <GestionProduits profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'labos') return (
    <GestionLabos profile={profile} onBack={() => setPage('dashboard')} />
  )

  if (page === 'comptes') return (
    <GestionComptes profile={profile} onBack={() => setPage('dashboard')} />
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter((v) => v.created_at?.slice(0, 10) === todayStr)
  const planifiees = visites.filter((v) => v.statut === 'Planifiée')
  const successRate = visites.length > 0
    ? Math.round((visites.filter((v) => v.statut === 'Réalisée').length / visites.length) * 100)
    : 0

  // Jours restants avant expiration
  const joursRestants = agence?.date_expiration
    ? Math.ceil((new Date(agence.date_expiration) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {agence?.nom || 'Tableau de bord'}
            </p>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-400"
        >
          Déconnexion
        </button>
      </div>

      {/* Bannière expiration */}
      {joursRestants !== null && joursRestants <= 5 && joursRestants > 0 && (
        <div className="bg-amber-500 px-6 py-2 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span className="text-white">Votre accès expire dans {joursRestants} jour(s) — contactez l'administrateur</span>
        </div>
      )}

      {/* Stats */}
      <div className="p-6 grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
          <p className="text-2xl font-black text-blue-950">{delegates.length}</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Délégués</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
          <p className="text-2xl font-black text-blue-950">{visites.length}</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites totales</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
          <p className="text-2xl font-black text-blue-950">{todayVisites.length}</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Aujourd'hui</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400">
          <p className="text-2xl font-black text-blue-950">{successRate}%</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Taux de réussite</p>
        </div>
      </div>

      {/* Boutons */}
      <div className="px-6 mb-6 flex flex-col gap-3">
        <button
          onClick={() => setPage('carte')}
          className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm hover:bg-blue-900 transition-colors"
        >
          🗺️ Carte des délégués
        </button>
        <button
  onClick={() => setPage('extranet')}
  className="w-full bg-slate-700 text-white font-black py-4 rounded-2xl text-sm hover:bg-slate-600 transition-colors"
>
  🌐 Extranet grossistes
</button>
        <button
          onClick={() => setPage('statistiques')}
          className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-purple-500 transition-colors"
        >
          📊 Statistiques par délégué
        </button>
        <button
          onClick={() => setPage('stats-avancees')}
          className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-indigo-500 transition-colors"
        >
          📈 Statistiques avancées
        </button>
        <button
          onClick={() => setPage('rapports')}
          className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-green-500 transition-colors"
        >
          📥 Rapports & Export Excel
        </button>
        <button
          onClick={() => setPage('delegues')}
          className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-teal-500 transition-colors"
        >
          👥 Gestion des délégués
        </button>
        <button
          onClick={() => setPage('produits')}
          className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-sm hover:bg-amber-400 transition-colors"
        >
          💊 Produits du labo
        </button>
        <button
          onClick={() => setPage('labos')}
          className="w-full bg-cyan-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-cyan-500 transition-colors"
        >
          🧪 Laboratoires
        </button>
        <button
          onClick={() => setPage('comptes')}
          className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-rose-500 transition-colors"
        >
          🔐 Gestion des comptes
        </button>
      </div>

      {/* Visites planifiées */}
      {planifiees.length > 0 && (
        <div className="px-6 mb-6">
          <h2 className="text-amber-500 font-black text-sm uppercase tracking-wider mb-3">
            📅 Visites planifiées ({planifiees.length})
          </h2>
          <div className="flex flex-col gap-3">
            {planifiees.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-blue-950 text-sm">{v.nom_contact || v.medecins?.nom || '—'}</p>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-600">
                    Planifiée
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {v.delegates?.prenom} {v.delegates?.nom} · {v.produit}
                </p>
                {v.date_prevue && (
                  <p className="text-xs text-amber-500 font-bold mt-1">
                    📅 {new Date(v.date_prevue).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Délégués */}
      <div className="px-6 mb-6">
        <h2 className="text-blue-950 font-black text-sm uppercase tracking-wider mb-3">Délégués</h2>
        <div className="flex flex-col gap-3">
          {delegates.map((d) => {
            const dvs = visites.filter((v) => v.delegate_id === d.id)
            return (
              <div key={d.id} className="bg-white rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center font-black text-teal-600">
                  {d.prenom?.[0]}{d.nom?.[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                  <p className="text-slate-400 text-xs">{d.zone}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-teal-500 text-lg">{dvs.length}</p>
                  <p className="text-slate-400 text-xs">visites</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Visites récentes */}
      <div className="px-6 pb-10">
        <h2 className="text-blue-950 font-black text-sm uppercase tracking-wider mb-3">Visites récentes</h2>
        {visites.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucune visite enregistrée</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visites.slice(0, 10).map((v) => (
              <div key={v.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                v.statut === 'Réalisée' ? 'border-teal-400' :
                v.statut === 'Planifiée' ? 'border-amber-400' :
                'border-rose-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-blue-950 text-sm">
                    {v.nom_contact || (v.medecins?.nom ? `Dr. ${v.medecins.nom}` : '—')}
                  </p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' :
                    v.statut === 'Planifiée' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-500'
                  }`}>
                    {v.statut}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {v.delegates?.prenom} {v.delegates?.nom} · {v.produit}
                </p>
                {v.statut === 'Planifiée' && v.date_prevue && (
                  <p className="text-xs text-amber-500 font-bold mt-1">
                    📅 Prévue le {new Date(v.date_prevue).toLocaleString('fr-FR')}
                  </p>
                )}
                {v.note && <p className="text-xs text-slate-500 mt-2 italic">{v.note}</p>}
                <p className="text-xs text-slate-300 mt-2">{v.created_at?.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}