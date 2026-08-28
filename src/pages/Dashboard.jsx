import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Carte from './Carte'
import Statistiques from './Statistiques'
import StatistiquesAvancees from './StatistiquesAvancees'
import Rapports from './Rapports'
import GestionDelegues from './GestionDelegues'
import GestionProduits from './GestionProduits'
import GestionLabos from './GestionLabos'
import GestionComptes from './GestionComptes'
import Extranet from './Extranet'
import Fichiers from './Fichiers'
import GestionTerritoires from './GestionTerritoires'
import GestionEtablissements from './GestionEtablissements'
import GestionProfessionnels from './GestionProfessionnels'
import GestionCampagnes from './GestionCampagnes'
import GestionPortefeuille from './GestionPortefeuille'
import PlanificationVisites from './PlanificationVisites'

export default function Dashboard({ session, profile, agence }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'visites',
        filter: `agence_id=eq.${profile.agence_id}`
      }, () => { fetchData() })
      .subscribe()
    const interval = setInterval(fetchData, 30000)
    return () => { clearInterval(interval); supabase.removeChannel(channel) }
  }, [])

  const fetchData = async () => {
    setRefreshing(true)
    const [
      { data: delegatesData },
      { data: visitesData },
      { data: campagnesData },
      { data: portfoliosData },
      { data: plansData }
    ] = await Promise.all([
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id),
      supabase.from('visites').select('*, delegates(*)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('campaigns').select('*, laboratoires(nom)')
        .eq('agence_id', profile.agence_id)
        .eq('statut', 'active'),
      supabase.from('delegate_portfolios').select('*').eq('agence_id', profile.agence_id),
      supabase.from('visit_plans').select('*')
        .eq('agence_id', profile.agence_id)
        .in('statut', ['pending', 'confirmed'])
    ])
    setDelegates(delegatesData || [])
    setVisites(visitesData || [])
    setCampagnes(campagnesData || [])
    setPortfolios(portfoliosData || [])
    setPlans(plansData || [])
    setLoading(false)
    setRefreshing(false)
    setLastRefresh(new Date())
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  // Pages
  const pages = {
    carte: <Carte profile={profile} onBack={() => setPage('dashboard')} />,
    statistiques: <Statistiques profile={profile} onBack={() => setPage('dashboard')} />,
    rapports: <Rapports profile={profile} onBack={() => setPage('dashboard')} />,
    'stats-avancees': <StatistiquesAvancees profile={profile} onBack={() => setPage('dashboard')} />,
    delegues: <GestionDelegues profile={profile} onBack={() => { setPage('dashboard'); fetchData() }} />,
    produits: <GestionProduits profile={profile} onBack={() => setPage('dashboard')} />,
    labos: <GestionLabos profile={profile} onBack={() => setPage('dashboard')} />,
    comptes: <GestionComptes profile={profile} onBack={() => setPage('dashboard')} />,
    extranet: <Extranet profile={profile} onBack={() => setPage('dashboard')} />,
    fichiers: <Fichiers profile={profile} onBack={() => setPage('dashboard')} />,
    territoires: <GestionTerritoires profile={profile} onBack={() => setPage('dashboard')} />,
    etablissements: <GestionEtablissements profile={profile} onBack={() => setPage('dashboard')} />,
    professionnels: <GestionProfessionnels profile={profile} onBack={() => setPage('dashboard')} />,
    campagnes: <GestionCampagnes profile={profile} onBack={() => setPage('dashboard')} />,
    portefeuille: <GestionPortefeuille profile={profile} onBack={() => setPage('dashboard')} />,
    planification: <PlanificationVisites profile={profile} onBack={() => setPage('dashboard')} />,
  }

  if (pages[page]) return pages[page]

  // KPIs
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter(v => v.created_at?.slice(0, 10) === todayStr)
  const realisees = visites.filter(v => v.statut === 'Réalisée')
  const tauxRealisation = visites.length > 0 ? Math.round((realisees.length / visites.length) * 100) : 0
  const totalCibles = portfolios.length
  const ciblesVisitees = new Set(visites.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size
  const couverture = totalCibles > 0 ? Math.round((ciblesVisitees / totalCibles) * 100) : 0
  const joursRestants = agence?.date_expiration
    ? Math.ceil((new Date(agence.date_expiration) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const visitesParDelegate = delegates.map(d => ({
    ...d,
    count: visites.filter(v => v.delegate_id === d.id).length,
    today: visites.filter(v => v.delegate_id === d.id && v.created_at?.slice(0, 10) === todayStr).length
  })).sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {agence?.nom || 'Dashboard'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <button onClick={fetchData} disabled={refreshing}
              className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl font-bold text-xs">
              {refreshing ? '...' : '🔄'}
            </button>
            <p className="text-teal-400 text-xs mt-0.5">
              {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs">
            Déconnexion
          </button>
        </div>
      </div>

      {/* Bannière expiration */}
      {joursRestants !== null && joursRestants <= 5 && joursRestants > 0 && (
        <div className="bg-amber-500 px-6 py-2 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span className="text-white">Accès expire dans {joursRestants} jour(s)</span>
        </div>
      )}

      <div className="p-6 flex flex-col gap-6 pb-10">

        {/* KPIs principaux */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Vue d'ensemble</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{delegates.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Délégués</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{todayVisites.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites aujourd'hui</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
              <p className="text-2xl font-black text-blue-950">{visites.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total visites</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400">
              <p className="text-2xl font-black text-blue-950">{tauxRealisation}%</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Taux réalisation</p>
            </div>
          </div>
        </div>

        {/* KPIs ciblage */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Ciblage & Couverture</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{totalCibles}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Cibles totales</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-indigo-400">
              <p className="text-2xl font-black text-blue-950">{couverture}%</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Couverture</p>
              {totalCibles > 0 && (
                <div className="mt-2 bg-slate-100 rounded-full h-1.5">
                  <div className="bg-indigo-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${couverture}%` }} />
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-orange-400">
              <p className="text-2xl font-black text-blue-950">{campagnes.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Campagnes actives</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-cyan-400">
              <p className="text-2xl font-black text-blue-950">{plans.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites planifiées</p>
            </div>
          </div>
        </div>

        {/* Campagnes actives */}
        {campagnes.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Campagnes actives</p>
            <div className="flex flex-col gap-2">
              {campagnes.map(c => {
                const visitesC = visites.filter(v => v.campaign_id === c.id).length
                const objectif = c.visits_objective || 0
                const progress = objectif > 0 ? Math.min(Math.round((visitesC / objectif) * 100), 100) : 0
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-black text-blue-950 text-sm">{c.nom}</p>
                        <p className="text-xs text-slate-400">🧪 {c.laboratoires?.nom}</p>
                      </div>
                      <span className="text-xs font-black text-teal-500">{visitesC} visites</span>
                    </div>
                    {objectif > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Progression</span>
                          <span>{visitesC} / {objectif} ({progress}%)</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${progress >= 100 ? 'bg-teal-400' : progress >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${progress}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Performance délégués */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Performance délégués</p>
          <div className="flex flex-col gap-2">
            {visitesParDelegate.map((d, i) => (
              <div key={d.id} className="bg-white rounded-2xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                  i === 0 ? 'bg-amber-400 text-white' :
                  i === 1 ? 'bg-slate-300 text-white' :
                  i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                  <p className="text-xs text-slate-400">{d.today} visite{d.today > 1 ? 's' : ''} aujourd'hui</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-teal-500 text-lg">{d.count}</p>
                  <p className="text-slate-400 text-xs">total</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation modules */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Terrain</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setPage('carte')} className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">🗺️ Carte des délégués</button>
            <button onClick={() => setPage('planification')} className="w-full bg-teal-700 text-white font-black py-4 rounded-2xl text-sm">📅 Planification visites</button>
            <button onClick={() => setPage('portefeuille')} className="w-full bg-purple-700 text-white font-black py-4 rounded-2xl text-sm">👜 Portefeuille délégués</button>
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Analyse</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setPage('statistiques')} className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl text-sm">📊 Statistiques</button>
            <button onClick={() => setPage('stats-avancees')} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm">📈 Statistiques avancées</button>
            <button onClick={() => setPage('rapports')} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-sm">📥 Rapports & Export</button>
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Configuration</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setPage('campagnes')} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl text-sm">🎯 Campagnes</button>
            <button onClick={() => setPage('professionnels')} className="w-full bg-indigo-700 text-white font-black py-4 rounded-2xl text-sm">👨‍⚕️ Professionnels de santé</button>
            <button onClick={() => setPage('etablissements')} className="w-full bg-red-700 text-white font-black py-4 rounded-2xl text-sm">🏥 Établissements</button>
            <button onClick={() => setPage('territoires')} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm">🗺️ Territoires</button>
            <button onClick={() => setPage('delegues')} className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl text-sm">👥 Délégués</button>
            <button onClick={() => setPage('produits')} className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-sm">💊 Produits</button>
            <button onClick={() => setPage('labos')} className="w-full bg-cyan-600 text-white font-black py-4 rounded-2xl text-sm">🧪 Laboratoires</button>
            <button onClick={() => setPage('comptes')} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl text-sm">🔐 Comptes</button>
            <button onClick={() => setPage('extranet')} className="w-full bg-slate-700 text-white font-black py-4 rounded-2xl text-sm">🌐 Extranet</button>
            <button onClick={() => setPage('fichiers')} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm">📊 Fichiers stats</button>
          </div>
        </div>
      </div>
    </div>
  )
}