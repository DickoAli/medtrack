import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function DashboardLabo({ profile, session }) {
  const [stats, setStats] = useState(null)
  const [campagnes, setCampagnes] = useState([])
  const [produits, setProduits] = useState([])
  const [visites, setVisites] = useState([])
  const [ventes, setVentes] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: c }, { data: p }, { data: v }, { data: ve }, { data: a }] = await Promise.all([
      supabase.from('campaigns')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .eq('laboratoire_id', profile.laboratory_id)
        .order('created_at', { ascending: false }),
      supabase.from('produits')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .eq('laboratoire_id', profile.laboratory_id)
        .order('nom'),
      supabase.from('visites')
        .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, potential)')
        .eq('agence_id', profile.agence_id)
        .eq('campaign_id', profile.laboratory_id)
        .order('created_at', { ascending: false }),
      supabase.from('aggregated_sales')
        .select('*, produits(nom)')
        .eq('agence_id', profile.agence_id)
        .eq('laboratoire_id', profile.laboratory_id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false }),
      supabase.from('content_assets')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .eq('laboratoire_id', profile.laboratory_id)
        .order('created_at', { ascending: false })
    ])

    // Récupérer visites liées aux campagnes du labo
    const campaignIds = (c || []).map(x => x.id)
    let visitesLabo = []
    if (campaignIds.length > 0) {
      const { data: vl } = await supabase.from('visites')
        .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, potential)')
        .eq('agence_id', profile.agence_id)
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false })
      visitesLabo = vl || []
    }

    setCampagnes(c || [])
    setProduits(p || [])
    setVisites(visitesLabo)
    setVentes(ve || [])
    setAssets(a || [])

    const realisees = visitesLabo.filter(v => v.statut === 'Réalisée')
    const validated = visitesLabo.filter(v => v.confidence_status === 'validated')
    const totalVentes = (ve || []).reduce((s, v) => s + v.total_quantity, 0)

    setStats({
      campagnes: (c || []).length,
      campagnesActives: (c || []).filter(x => x.statut === 'active').length,
      produits: (p || []).length,
      visites: visitesLabo.length,
      realisees: realisees.length,
      validated: validated.length,
      totalVentes,
      assets: (a || []).length,
      assetsPublies: (a || []).filter(x => x.is_published).length
    })
    setLoading(false)
  }

  const filteredVentes = ventes.filter(v =>
    v.period_month === filterMonth && v.period_year === filterYear
  )

  const STATUT_COLORS = {
    draft: 'bg-slate-100 text-slate-500',
    active: 'bg-teal-100 text-teal-600',
    paused: 'bg-amber-100 text-amber-600',
    completed: 'bg-blue-100 text-blue-600',
    cancelled: 'bg-rose-100 text-rose-500'
  }
  const STATUT_LABELS = {
    draft: 'Brouillon', active: 'Active',
    paused: 'En pause', completed: 'Terminée', cancelled: 'Annulée'
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              Espace Laboratoire
            </p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs">
          Déconnexion
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'campagnes', label: '🎯 Campagnes' },
          { id: 'produits', label: '💊 Produits' },
          { id: 'ventes', label: '📈 Ventes' },
          { id: 'contenu', label: '📚 Contenu' },
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

        {/* DASHBOARD */}
        {tab === 'dashboard' && stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                <p className="text-2xl font-black text-blue-950">{stats.campagnesActives}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Campagnes actives</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
                <p className="text-2xl font-black text-blue-950">{stats.produits}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Produits</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
                <p className="text-2xl font-black text-blue-950">{stats.visites}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites terrain</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
                <p className="text-2xl font-black text-blue-950">{stats.totalVentes.toLocaleString()}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Unités vendues</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-green-400">
                <p className="text-2xl font-black text-blue-950">{stats.validated}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">✅ Visites validées</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400">
                <p className="text-2xl font-black text-blue-950">{stats.assetsPublies}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Supports publiés</p>
              </div>
            </div>

            {/* Taux réalisation visites */}
            {stats.visites > 0 && (
              <div className="bg-white rounded-2xl p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-black text-slate-500 uppercase tracking-wider">Taux de réalisation</span>
                  <span className="font-black text-teal-500">
                    {Math.round((stats.realisees / stats.visites) * 100)}%
                  </span>
                </div>
                <div className="bg-slate-100 rounded-full h-3">
                  <div className="bg-teal-400 h-3 rounded-full"
                    style={{ width: `${Math.round((stats.realisees / stats.visites) * 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{stats.realisees} / {stats.visites} visites réalisées</p>
              </div>
            )}

            {/* Top produits visites */}
            {visites.length > 0 && (
              <div className="bg-white rounded-2xl p-4">
                <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
                  Activité terrain récente
                </p>
                {visites.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      v.healthcare_professionals?.potential === 'A' ? 'bg-rose-100 text-rose-600' :
                      v.healthcare_professionals?.potential === 'B' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>{v.healthcare_professionals?.potential || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-blue-950 truncate">
                        {v.healthcare_professionals
                          ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}`
                          : v.nom_contact || '—'}
                      </p>
                      <p className="text-xs text-slate-400">{v.delegates?.prenom} {v.delegates?.nom}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'
                    }`}>{v.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* CAMPAGNES */}
        {tab === 'campagnes' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''}
            </p>
            {campagnes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-4xl mb-3">🎯</p>
                <p className="text-slate-400 text-sm">Aucune campagne</p>
              </div>
            ) : (
              campagnes.map(c => {
                const cvs = visites.filter(v => v.campaign_id === c.id)
                const realisees = cvs.filter(v => v.statut === 'Réalisée')
                const progress = c.visits_objective > 0
                  ? Math.min(Math.round((realisees.length / c.visits_objective) * 100), 100)
                  : 0
                return (
                  <div key={c.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                    c.statut === 'active' ? 'border-teal-400' :
                    c.statut === 'completed' ? 'border-blue-400' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-black text-blue-950 text-sm">{c.nom}</p>
                        <p className="text-xs text-slate-400">
                          📅 {new Date(c.start_date).toLocaleDateString('fr-FR')} → {new Date(c.end_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut]}`}>
                        {STATUT_LABELS[c.statut]}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <span className="text-slate-400">{cvs.length} visites</span>
                      <span className="text-teal-500 font-bold">{realisees.length} réalisées</span>
                      {c.visits_objective && <span className="text-slate-400">/ {c.visits_objective} obj.</span>}
                    </div>
                    {c.visits_objective > 0 && (
                      <div className="bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${
                          progress >= 80 ? 'bg-teal-400' :
                          progress >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                        }`} style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* PRODUITS */}
        {tab === 'produits' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {produits.length} produit{produits.length > 1 ? 's' : ''}
            </p>
            {produits.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                p.statut_produit === 'Normal' ? 'border-teal-400' :
                p.statut_produit === 'Arrêt de distribution' ? 'border-amber-400' : 'border-rose-400'
              }`}>
                <p className="font-black text-blue-950 text-sm">{p.nom}</p>
                {p.dci && <p className="text-xs text-slate-500 font-bold">DCI: {p.dci}</p>}
                <div className="flex gap-2 mt-1 flex-wrap">
                  {p.dosage && <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                  {p.forme && <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">{p.forme}</span>}
                  {p.conditionnement && <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{p.conditionnement}</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    p.statut_produit === 'Normal' ? 'bg-teal-100 text-teal-600' :
                    p.statut_produit === 'Arrêt de distribution' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-500'
                  }`}>{p.statut_produit}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* VENTES */}
        {tab === 'ventes' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
                className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
                className="p-3 rounded-xl border border-slate-200 bg-white text-sm" />
            </div>

            <div className="bg-blue-950 rounded-2xl p-4 text-center">
              <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
                Total {MONTHS[filterMonth - 1]} {filterYear}
              </p>
              <p className="text-white text-4xl font-black">
                {filteredVentes.reduce((s, v) => s + v.total_quantity, 0).toLocaleString()}
              </p>
              <p className="text-teal-400 text-xs mt-1">unités vendues</p>
            </div>

            {filteredVentes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">Aucune donnée pour cette période</p>
              </div>
            ) : (
              filteredVentes.map(v => (
                <div key={v.id} className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-blue-950 text-sm">{v.produits?.nom}</p>
                      <p className="text-xs text-slate-400">{v.wholesaler_count} grossiste{v.wholesaler_count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-teal-500 text-xl">{v.total_quantity.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">unités</p>
                    </div>
                  </div>
                  {v.total_amount > 0 && (
                    <p className="text-xs text-slate-400 mt-1">💰 {v.total_amount.toLocaleString()} XOF</p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* CONTENU */}
        {tab === 'contenu' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {assets.length} support{assets.length > 1 ? 's' : ''} · {assets.filter(a => a.is_published).length} publiés
            </p>
            {assets.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-4xl mb-3">📚</p>
                <p className="text-slate-400 text-sm">Aucun support e-detailing</p>
              </div>
            ) : (
              assets.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                  a.is_published ? 'border-teal-400' : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-blue-950 text-sm truncate">{a.nom}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                          {a.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">v{a.version}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          a.is_published ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {a.is_published ? '✅ Publié' : '⏸ Brouillon'}
                        </span>
                      </div>
                    </div>
                    <a href={a.file_url} target="_blank" rel="noreferrer"
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0">
                      👁️ Voir
                    </a>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}