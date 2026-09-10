import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionPortefeuille({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [commercialTargets, setCommercialTargets] = useState([])
  const [campaignTargets, setCampaignTargets] = useState([])
  const [selectedDelegate, setSelectedDelegate] = useState(null)
  const [mode, setMode] = useState(null) // 'campagne' | 'hors_campagne' | null
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d }, { data: c }, { data: p }, { data: ct }, { data: camptar }] = await Promise.all([
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).eq('statut', 'active'),
      supabase.from('delegate_portfolios')
        .select('*, delegates(nom, prenom), campaigns(nom)')
        .eq('agence_id', profile.agence_id)
        .eq('is_active', true),
      supabase.from('commercial_targets')
        .select('*, healthcare_professionals(id, nom, prenom, specialite, establishment_id)')
        .eq('agence_id', profile.agence_id)
        .eq('statut', 'actif'),
      supabase.from('campaign_targets').select('*').eq('agence_id', profile.agence_id)
    ])
    setDelegates(d || [])
    setCampagnes(c || [])
    setPortfolios(p || [])
    setCommercialTargets(ct || [])
    setCampaignTargets(camptar || [])
    setLoading(false)
  }

  const handleSelectDelegate = (d) => {
    setSelectedDelegate(d)
    setMode(null)
    setSelectedCampaign(null)
  }

  const handleSelectCampaign = (c) => {
    setSelectedCampaign(c)
    setMode('campagne')
  }

  const handleHorsCampagne = () => {
    setSelectedCampaign(null)
    setMode('hors_campagne')
  }

  // Cibles disponibles selon le mode : soit celles de la campagne choisie,
  // soit toutes les cibles commerciales actives de l'agence (hors campagne)
  const getAvailableTargets = () => {
    if (mode === 'campagne' && selectedCampaign) {
      const idsInCampaign = campaignTargets
        .filter(ctar => ctar.campaign_id === selectedCampaign.id)
        .map(ctar => ctar.commercial_target_id)
      return commercialTargets.filter(ct => idsInCampaign.includes(ct.id))
    }
    if (mode === 'hors_campagne') {
      return commercialTargets
    }
    return []
  }

  // Valeurs effectives (priorité/fréquence) pour une cible dans le contexte
  // actuel : override de campaign_targets si en mode campagne, sinon défaut
  // de commercial_targets
  const getEffectiveValues = (commercialTargetId) => {
    const ct = commercialTargets.find(x => x.id === commercialTargetId)
    if (mode === 'campagne' && selectedCampaign) {
      const override = campaignTargets.find(x => x.campaign_id === selectedCampaign.id && x.commercial_target_id === commercialTargetId)
      return {
        priority: override?.priority ?? ct?.priority ?? 'B',
        visit_frequency: override?.visit_frequency ?? ct?.visit_frequency_default ?? 1
      }
    }
    return { priority: ct?.priority ?? 'B', visit_frequency: ct?.visit_frequency_default ?? 1 }
  }

  const isAssigned = (commercialTargetId) => {
    return portfolios.some(p =>
      p.delegate_id === selectedDelegate?.id &&
      p.commercial_target_id === commercialTargetId &&
      (mode === 'campagne' ? p.campaign_id === selectedCampaign?.id : p.campaign_id === null)
    )
  }

  const getActiveAssignment = (commercialTargetId) => {
    return portfolios.find(p =>
      p.delegate_id === selectedDelegate?.id &&
      p.commercial_target_id === commercialTargetId &&
      (mode === 'campagne' ? p.campaign_id === selectedCampaign?.id : p.campaign_id === null)
    )
  }

  // Vérifie si un AUTRE délégué couvre déjà activement cette cible dans ce
  // contexte (campagne ou hors campagne) — règle purement applicative,
  // la base autorise volontairement ce cas (passations/remplacements)
  const getConflict = (commercialTargetId) => {
    return portfolios.find(p =>
      p.delegate_id !== selectedDelegate?.id &&
      p.commercial_target_id === commercialTargetId &&
      (mode === 'campagne' ? p.campaign_id === selectedCampaign?.id : p.campaign_id === null)
    )
  }

  const resolveTerritory = async (commercialTargetId) => {
    const ct = commercialTargets.find(x => x.id === commercialTargetId)
    const establishmentId = ct?.healthcare_professionals?.establishment_id
    if (!establishmentId) return null
    const { data } = await supabase.from('establishments').select('territory_id').eq('id', establishmentId).single()
    return data?.territory_id || null
  }

  const toggleAssignment = async (commercialTargetId) => {
    if (!selectedDelegate || !mode) return
    setSaving(true)

    const existing = getActiveAssignment(commercialTargetId)

    if (existing) {
      // Retrait : désactivation simple, aucune nouvelle ligne à créer
      const { error } = await supabase.from('delegate_portfolios')
        .update({ is_active: false, period_end: new Date().toISOString().slice(0, 10) })
        .eq('id', existing.id)
      setSaving(false)
      if (error) {
        console.error('Erreur désactivation portefeuille:', error)
        alert('Erreur lors du retrait : ' + error.message)
        return
      }
      fetchAll()
      return
    }

    // Affectation nouvelle : vérifier le conflit AVANT d'insérer
    const conflict = getConflict(commercialTargetId)
    if (conflict) {
      const ct = commercialTargets.find(x => x.id === commercialTargetId)
      const confirmMsg = `${conflict.delegates?.prenom} ${conflict.delegates?.nom} couvre déjà cette cible ${mode === 'campagne' ? 'sur cette campagne' : 'hors campagne'}.\n\nConfirmer quand même cette double affectation (ex: passation en cours) ?`
      if (!confirm(confirmMsg)) { setSaving(false); return }
    }

    const territoryId = await resolveTerritory(commercialTargetId)

    const { priority, visit_frequency } = getEffectiveValues(commercialTargetId)

    const ctRow = commercialTargets.find(x => x.id === commercialTargetId)

    const { error } = await supabase.from('delegate_portfolios').insert({
      agence_id: profile.agence_id,
      delegate_id: selectedDelegate.id,
      commercial_target_id: commercialTargetId,
      healthcare_professional_id: ctRow?.healthcare_professional_id, // ancienne colonne, toujours NOT NULL en base — conservée jusqu'au nettoyage final (Phase 9)
      campaign_id: mode === 'campagne' ? selectedCampaign.id : null,
      territory_id: territoryId, // peut être null — accepté par la base (territoire nullable)
      priority,
      visit_frequency,
      is_active: true,
      period_start: new Date().toISOString().slice(0, 10),
      assigned_by: profile.id
    })

    setSaving(false)

    if (error) {
      console.error('Erreur affectation portefeuille:', error)
      alert('Erreur lors de l\'affectation : ' + error.message)
      return
    }

    if (!territoryId) {
      console.warn('Affectation créée sans territoire résolu (établissement sans territoire ou non trouvé).')
    }

    setSuccessMsg('Portefeuille mis à jour !')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const getPortfolioCount = (delegateId, campaignId) => {
    return portfolios.filter(p =>
      p.delegate_id === delegateId &&
      (campaignId === undefined || p.campaign_id === campaignId)
    ).length
  }

  const PRIORITY_COLORS = {
    A: 'bg-[#FDE8E8] text-[#DC2626]',
    B: 'bg-[#FEF3E2] text-[#B45309]',
    C: 'bg-[#EEF1F4] text-[#667085]'
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  const availableTargets = getAvailableTargets()
  const currentContextPortfolios = selectedDelegate
    ? portfolios.filter(p => p.delegate_id === selectedDelegate.id && (mode === 'campagne' ? p.campaign_id === selectedCampaign?.id : mode === 'hors_campagne' ? p.campaign_id === null : true))
    : []

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-semibold text-base">Portefeuille délégués</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            Affectation des cibles
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4">

        {/* Étape 1 — Délégué */}
        <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
          <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
            1 — Choisir un délégué
          </p>
          <div className="flex flex-col gap-2">
            {delegates.map(d => (
              <button key={d.id}
                onClick={() => handleSelectDelegate(d)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  selectedDelegate?.id === d.id ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-[#F4F7F9] text-[#172B4D] border-[#DDE4EA]'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    selectedDelegate?.id === d.id ? 'bg-[#087F5B] text-white' : 'bg-[#172B4D] text-white'
                  }`}>
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <span className="font-medium text-sm">{d.prenom} {d.nom}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  selectedDelegate?.id === d.id ? 'bg-[#087F5B] text-white' : 'bg-[#EEF1F4] text-[#667085]'
                }`}>
                  {getPortfolioCount(d.id)} cible{getPortfolioCount(d.id) > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Étape 2 — Campagne ou hors campagne */}
        {selectedDelegate && (
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
              2 — Contexte de l'affectation
            </p>

            <button onClick={handleHorsCampagne}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border mb-2 transition-colors ${
                mode === 'hors_campagne' ? 'bg-[#087F5B] text-white border-[#087F5B]' : 'bg-[#F4F7F9] text-[#172B4D] border-[#DDE4EA]'
              }`}>
              <div>
                <p className="font-medium text-sm text-left">Affecter hors campagne</p>
                <p className={`text-xs ${mode === 'hors_campagne' ? 'text-white/80' : 'text-[#667085]'}`}>
                  Relation de fond, indépendante de tout lancement produit
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                mode === 'hors_campagne' ? 'bg-[#172B4D] text-white' : 'bg-[#EEF1F4] text-[#667085]'
              }`}>
                {getPortfolioCount(selectedDelegate.id, null)}
              </span>
            </button>

            {campagnes.length === 0 ? (
              <p className="text-xs text-[#667085] text-center py-2">Aucune campagne active</p>
            ) : (
              <div className="flex flex-col gap-2">
                {campagnes.map(c => (
                  <button key={c.id}
                    onClick={() => handleSelectCampaign(c)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      mode === 'campagne' && selectedCampaign?.id === c.id
                        ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-[#F4F7F9] text-[#172B4D] border-[#DDE4EA]'
                    }`}>
                    <div>
                      <p className="font-medium text-sm text-left">{c.nom}</p>
                      <p className={`text-xs ${mode === 'campagne' && selectedCampaign?.id === c.id ? 'text-white/70' : 'text-[#667085]'}`}>
                        🧪 {c.laboratoires?.nom}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      mode === 'campagne' && selectedCampaign?.id === c.id ? 'bg-[#087F5B] text-white' : 'bg-[#EEF1F4] text-[#667085]'
                    }`}>
                      {getPortfolioCount(selectedDelegate.id, c.id)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 3 — Cibles */}
        {selectedDelegate && mode && (
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">
                3 — Assigner les cibles
              </p>
              <span className="text-xs text-[#667085]">
                {availableTargets.filter(t => isAssigned(t.id)).length} / {availableTargets.length}
              </span>
            </div>

            {saving && <p className="text-xs text-[#087F5B] font-semibold text-center mb-2">Mise à jour...</p>}

            {availableTargets.length === 0 ? (
              <p className="text-xs text-[#667085] text-center py-4">
                {mode === 'campagne'
                  ? 'Aucune cible définie dans cette campagne'
                  : 'Aucune cible commerciale active dans l\'agence'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableTargets.map(ct => {
                  const pro = ct.healthcare_professionals
                  const assigned = isAssigned(ct.id)
                  const conflict = !assigned ? getConflict(ct.id) : null
                  const { priority, visit_frequency } = getEffectiveValues(ct.id)
                  return (
                    <button key={ct.id}
                      onClick={() => toggleAssignment(ct.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                        assigned ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-[#F4F7F9] text-[#172B4D] border-[#DDE4EA]'
                      }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        assigned ? 'bg-[#087F5B] text-white' : PRIORITY_COLORS[priority]
                      }`}>
                        {assigned ? '✓' : priority}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{pro?.prenom} {pro?.nom}</p>
                        {pro?.specialite && (
                          <p className={`text-xs ${assigned ? 'text-white/70' : 'text-[#667085]'}`}>{pro.specialite}</p>
                        )}
                        <p className={`text-xs ${assigned ? 'text-white/70' : 'text-[#98A2B3]'}`}>
                          {visit_frequency}x/mois
                        </p>
                        {conflict && (
                          <p className="text-xs text-[#DC2626] font-medium mt-0.5">
                            ⚠ Déjà couvert par {conflict.delegates?.prenom} {conflict.delegates?.nom}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${assigned ? 'text-white/70' : 'text-[#667085]'}`}>
                        {assigned ? 'Assigné' : 'Assigner'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Récapitulatif */}
        {selectedDelegate && mode && currentContextPortfolios.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
              Portefeuille actif — {mode === 'campagne' ? selectedCampaign?.nom : 'Hors campagne'}
            </p>
            <div className="flex flex-col gap-2">
              {currentContextPortfolios.map(p => {
                const ct = commercialTargets.find(x => x.id === p.commercial_target_id)
                const pro = ct?.healthcare_professionals
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F7F9] rounded-lg">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[p.priority]}`}>
                      {p.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#172B4D] truncate">{pro?.prenom} {pro?.nom}</p>
                      <p className="text-xs text-[#667085]">
                        {p.visit_frequency}x/mois {p.period_start && `· depuis ${new Date(p.period_start).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
