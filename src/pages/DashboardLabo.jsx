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
    const [{ data: c }, { data: p }, { data: ve }, { data: a }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).eq('laboratoire_id', profile.laboratory_id).order('created_at', { ascending: false }),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('laboratoire_id', profile.laboratory_id).order('nom'),
      supabase.from('aggregated_sales').select('*, produits(nom)').eq('agence_id', profile.agence_id).eq('laboratoire_id', profile.laboratory_id).order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('content_assets').select('*').eq('agence_id', profile.agence_id).eq('laboratoire_id', profile.laboratory_id).order('created_at', { ascending: false })
    ])

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

  const filteredVentes = ventes.filter(v => v.period_month === filterMonth && v.period_year === filterYear)

  const STATUT_COLORS = {
    draft: 'bg-[#EEF1F4] text-[#667085]',
    active: 'bg-[#E7F5EF] text-[#087F5B]',
    paused: 'bg-[#FEF3E2] text-[#B45309]',
    completed: 'bg-[#E8F0FE] text-[#2563EB]',
    cancelled: 'bg-[#FDE8E8] text-[#DC2626]'
  }
  const STATUT_LABELS = { draft: 'Brouillon', active: 'Active', paused: 'En pause', completed: 'Terminée', cancelled: 'Annulée' }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl text-[#087F5B]">🧪</span>
          <div>
            <h1 className="text-white font-semibold text-base">MedTrack</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">Espace Laboratoire</p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          className="border border-[#3B4A63] text-[#C7D0E0] px-4 py-2 rounded-lg font-medium text-xs">
          Déconnexion
        </button>
      </div>

      <div className="bg-white flex border-b border-[#DDE4EA]">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'campagnes', label: 'Campagnes' },
          { id: 'produits', label: 'Produits' },
          { id: 'ventes', label: 'Ventes' },
          { id: 'contenu', label: 'Contenu' },
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

        {tab === 'dashboard' && stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{stats.campagnesActives}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Campagnes actives</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{stats.produits}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Produits</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #F59E0B' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{stats.visites}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Visites terrain</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <p className="text-xl font-semibold text-[#172B4D]">{stats.totalVentes.toLocaleString()}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Unités vendues</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #16A34A' }}>
                <p className="text-xl font-semibold text-[#172B4D]">{stats.validated}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">✅ Visites validées</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <p className="text-xl font-semibold text-[#172B4D]">{stats.assetsPublies}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Supports publiés</p>
              </div>
            </div>

            {stats.visites > 0 && (
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-semibold text-[#667085] uppercase tracking-wide">Taux de réalisation</span>
                  <span className="font-semibold text-[#087F5B]">
                    {Math.round((stats.realisees / stats.visites) * 100)}%
                  </span>
                </div>
                <div className="bg-[#EEF1F4] rounded-full h-3">
                  <div className="bg-[#087F5B] h-3 rounded-full"
                    style={{ width: `${Math.round((stats.realisees / stats.visites) * 100)}%` }} />
                </div>
                <p className="text-xs text-[#98A2B3] mt-1">{stats.realisees} / {stats.visites} visites réalisées</p>
              </div>
            )}

            {visites.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
                  Activité terrain récente
                </p>
                {visites.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 py-2 border-b border-[#F4F7F9] last:border-0">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      v.healthcare_professionals?.potential === 'A' ? 'bg-[#FDE8E8] text-[#DC2626]' :
                      v.healthcare_professionals?.potential === 'B' ? 'bg-[#FEF3E2] text-[#B45309]' :
                      'bg-[#EEF1F4] text-[#667085]'
                    }`}>{v.healthcare_professionals?.potential || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#172B4D] truncate">
                        {v.healthcare_professionals ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}` : v.nom_contact || '—'}
                      </p>
                      <p className="text-xs text-[#667085]">{v.delegates?.prenom} {v.delegates?.nom}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      v.statut === 'Réalisée' ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
                    }`}>{v.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'campagnes' && (
          <>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
              {campagnes.length} campagne{campagnes.length > 1 ? 's' : ''}
            </p>
            {campagnes.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
                <p className="text-3xl mb-2">🎯</p>
                <p className="text-[#667085] text-sm">Aucune campagne</p>
              </div>
            ) : (
              campagnes.map(c => {
                const cvs = visites.filter(v => v.campaign_id === c.id)
                const realisees = cvs.filter(v => v.statut === 'Réalisée')
                const progress = c.visits_objective > 0 ? Math.min(Math.round((realisees.length / c.visits_objective) * 100), 100) : 0
                return (
                  <div key={c.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{
                    borderLeft: `2px solid ${c.statut === 'active' ? '#087F5B' : c.statut === 'completed' ? '#2563EB' : '#DDE4EA'}`
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-[#172B4D] text-sm">{c.nom}</p>
                        <p className="text-xs text-[#667085]">
                          📅 {new Date(c.start_date).toLocaleDateString('fr-FR')} → {new Date(c.end_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut]}`}>
                        {STATUT_LABELS[c.statut]}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs mb-2">
                      <span className="text-[#98A2B3]">{cvs.length} visites</span>
                      <span className="text-[#087F5B] font-semibold">{realisees.length} réalisées</span>
                      {c.visits_objective && <span className="text-[#98A2B3]">/ {c.visits_objective} obj.</span>}
                    </div>
                    {c.visits_objective > 0 && (
                      <div className="bg-[#EEF1F4] rounded-full h-2">
                        <div className="h-2 rounded-full" style={{
                          width: `${progress}%`,
                          background: progress >= 80 ? '#087F5B' : progress >= 50 ? '#F59E0B' : '#DC2626'
                        }} />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'produits' && (
          <>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
              {produits.length} produit{produits.length > 1 ? 's' : ''}
            </p>
            {produits.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{
                borderLeft: `2px solid ${p.statut_produit === 'Normal' ? '#087F5B' : p.statut_produit === 'Arrêt de distribution' ? '#F59E0B' : '#DC2626'}`
              }}>
                <p className="font-semibold text-[#172B4D] text-sm">{p.nom}</p>
                {p.dci && <p className="text-xs text-[#667085] font-medium">DCI: {p.dci}</p>}
                <div className="flex gap-2 mt-1 flex-wrap">
                  {p.dosage && <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                  {p.forme && <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">{p.forme}</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    p.statut_produit === 'Normal' ? 'bg-[#E7F5EF] text-[#087F5B]' :
                    p.statut_produit === 'Arrêt de distribution' ? 'bg-[#FEF3E2] text-[#B45309]' :
                    'bg-[#FDE8E8] text-[#DC2626]'
                  }`}>{p.statut_produit}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'ventes' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
                className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
                className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
            </div>

            <div className="bg-[#172B4D] rounded-xl p-4 text-center">
              <p className="text-[#9AA9C2] text-xs font-semibold uppercase tracking-wide mb-1">
                Total {MONTHS[filterMonth - 1]} {filterYear}
              </p>
              <p className="text-white text-3xl font-semibold">
                {filteredVentes.reduce((s, v) => s + v.total_quantity, 0).toLocaleString()}
              </p>
              <p className="text-[#9AA9C2] text-xs mt-1">unités vendues</p>
            </div>

            {filteredVentes.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
                <p className="text-[#667085] text-sm">Aucune donnée pour cette période</p>
              </div>
            ) : (
              filteredVentes.map(v => (
                <div key={v.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#172B4D] text-sm">{v.produits?.nom}</p>
                      <p className="text-xs text-[#667085]">{v.wholesaler_count} grossiste{v.wholesaler_count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#087F5B] text-xl">{v.total_quantity.toLocaleString()}</p>
                      <p className="text-xs text-[#98A2B3]">unités</p>
                    </div>
                  </div>
                  {v.total_amount > 0 && (
                    <p className="text-xs text-[#667085] mt-1">💰 {v.total_amount.toLocaleString()} XOF</p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {tab === 'contenu' && (
          <>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
              {assets.length} support{assets.length > 1 ? 's' : ''} · {assets.filter(a => a.is_published).length} publiés
            </p>
            {assets.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
                <p className="text-3xl mb-2">📚</p>
                <p className="text-[#667085] text-sm">Aucun support e-detailing</p>
              </div>
            ) : (
              assets.map(a => (
                <div key={a.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${a.is_published ? '#087F5B' : '#DDE4EA'}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#172B4D] text-sm truncate">{a.nom}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">
                          {a.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-[#98A2B3]">v{a.version}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          a.is_published ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#EEF1F4] text-[#98A2B3]'
                        }`}>
                          {a.is_published ? '✅ Publié' : '⏸ Brouillon'}
                        </span>
                      </div>
                    </div>
                    <a href={a.file_url} target="_blank" rel="noreferrer"
                      className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0">
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
