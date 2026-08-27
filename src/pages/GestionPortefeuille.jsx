import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionPortefeuille({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [selectedDelegate, setSelectedDelegate] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [professionnels, setProfessionnels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).eq('statut', 'active'),
      supabase.from('delegate_portfolios').select('*, healthcare_professionals(nom, prenom, potential, specialite), campaigns(nom), delegates(nom, prenom)').eq('agence_id', profile.agence_id)
    ])
    setDelegates(d || [])
    setCampagnes(c || [])
    setPortfolios(p || [])
    setLoading(false)
  }

  const fetchProfessionnels = async (campaignId) => {
    const { data: targets } = await supabase
      .from('campaign_targets')
      .select('*, healthcare_professionals(id, nom, prenom, potential, specialite, establishments(nom))')
      .eq('campaign_id', campaignId)
    setProfessionnels(targets || [])
  }

  const handleSelectDelegate = (d) => {
    setSelectedDelegate(d)
    setSelectedCampaign(null)
    setProfessionnels([])
  }

  const handleSelectCampaign = (c) => {
    setSelectedCampaign(c)
    fetchProfessionnels(c.id)
  }

  const isAssigned = (hcpId) => {
    return portfolios.some(p =>
      p.delegate_id === selectedDelegate?.id &&
      p.campaign_id === selectedCampaign?.id &&
      p.healthcare_professional_id === hcpId
    )
  }

  const toggleAssignment = async (hcp) => {
    if (!selectedDelegate || !selectedCampaign) return
    setSaving(true)

    const existing = portfolios.find(p =>
      p.delegate_id === selectedDelegate.id &&
      p.campaign_id === selectedCampaign.id &&
      p.healthcare_professional_id === hcp.healthcare_professionals.id
    )

    if (existing) {
      await supabase.from('delegate_portfolios').delete().eq('id', existing.id)
    } else {
      await supabase.from('delegate_portfolios').insert({
        agence_id: profile.agence_id,
        delegate_id: selectedDelegate.id,
        healthcare_professional_id: hcp.healthcare_professionals.id,
        campaign_id: selectedCampaign.id,
        visit_frequency: hcp.visit_frequency || 1,
        priority: hcp.healthcare_professionals.potential || 'B',
        assigned_by: profile.id
      })
    }

    setSaving(false)
    setSuccessMsg('Portefeuille mis à jour !')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const getPortfolioCount = (delegateId, campaignId) => {
    return portfolios.filter(p =>
      p.delegate_id === delegateId &&
      (!campaignId || p.campaign_id === campaignId)
    ).length
  }

  const POTENTIAL_COLORS = {
    A: 'bg-rose-100 text-rose-600',
    B: 'bg-amber-100 text-amber-600',
    C: 'bg-slate-100 text-slate-500'
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-black text-lg">Portefeuille délégués</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            Affectation cibles par campagne
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-6 flex flex-col gap-4">

        {/* Étape 1 — Choisir délégué */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
            1 — Choisir un délégué
          </p>
          <div className="flex flex-col gap-2">
            {delegates.map(d => (
              <button key={d.id}
                onClick={() => handleSelectDelegate(d)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  selectedDelegate?.id === d.id
                    ? 'bg-blue-950 text-white border-blue-950'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                    selectedDelegate?.id === d.id ? 'bg-teal-400 text-blue-950' : 'bg-blue-950 text-white'
                  }`}>
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <span className="font-bold text-sm">{d.prenom} {d.nom}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  selectedDelegate?.id === d.id ? 'bg-teal-400 text-blue-950' : 'bg-slate-200 text-slate-500'
                }`}>
                  {getPortfolioCount(d.id)} cible{getPortfolioCount(d.id) > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Étape 2 — Choisir campagne */}
        {selectedDelegate && (
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
              2 — Choisir une campagne active
            </p>
            {campagnes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucune campagne active — créez d'abord une campagne
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {campagnes.map(c => (
                  <button key={c.id}
                    onClick={() => handleSelectCampaign(c)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                      selectedCampaign?.id === c.id
                        ? 'bg-teal-400 text-blue-950 border-teal-400'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                    <div>
                      <p className="font-bold text-sm text-left">{c.nom}</p>
                      <p className={`text-xs ${selectedCampaign?.id === c.id ? 'text-blue-950' : 'text-slate-400'}`}>
                        🧪 {c.laboratoires?.nom}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      selectedCampaign?.id === c.id ? 'bg-blue-950 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {getPortfolioCount(selectedDelegate.id, c.id)} assigné{getPortfolioCount(selectedDelegate.id, c.id) > 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 3 — Assigner les cibles */}
        {selectedDelegate && selectedCampaign && (
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
                3 — Assigner les cibles
              </p>
              <span className="text-xs text-slate-400">
                {professionnels.filter(p => isAssigned(p.healthcare_professionals.id)).length} / {professionnels.length}
              </span>
            </div>

            {saving && (
              <p className="text-xs text-teal-500 font-bold text-center mb-2">Mise à jour...</p>
            )}

            {professionnels.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucune cible définie dans cette campagne
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {professionnels.map(hcp => {
                  const pro = hcp.healthcare_professionals
                  const assigned = isAssigned(pro.id)
                  return (
                    <button key={hcp.id}
                      onClick={() => toggleAssignment(hcp)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                        assigned
                          ? 'bg-blue-950 text-white border-blue-950'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        assigned ? 'bg-teal-400 text-blue-950' : POTENTIAL_COLORS[pro.potential]
                      }`}>
                        {assigned ? '✓' : pro.potential}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-sm">{pro.prenom} {pro.nom}</p>
                        {pro.specialite && (
                          <p className={`text-xs ${assigned ? 'text-teal-300' : 'text-slate-400'}`}>
                            {pro.specialite}
                          </p>
                        )}
                        {pro.establishments && (
                          <p className={`text-xs ${assigned ? 'text-teal-300' : 'text-slate-400'}`}>
                            🏥 {pro.establishments.nom}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-bold ${assigned ? 'text-teal-300' : 'text-slate-400'}`}>
                        {assigned ? 'Assigné' : 'Assigner'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Résumé portefeuille */}
        {selectedDelegate && portfolios.filter(p => p.delegate_id === selectedDelegate.id).length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
              Portefeuille de {selectedDelegate.prenom} {selectedDelegate.nom}
            </p>
            <div className="flex flex-col gap-2">
              {portfolios
                .filter(p => p.delegate_id === selectedDelegate.id)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${POTENTIAL_COLORS[p.healthcare_professionals?.potential]}`}>
                      {p.healthcare_professionals?.potential}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-blue-950 truncate">
                        {p.healthcare_professionals?.prenom} {p.healthcare_professionals?.nom}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {p.campaigns?.nom}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {p.visit_frequency}x/mois
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}