import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import GestionComptes from './GestionComptes'

export default function CountryManagerDashboard({ session, profile, agence }) {
  const [page, setPage] = useState('dashboard')
  const [managers, setManagers] = useState([])
  const [coachingReports, setCoachingReports] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingObjectif, setSavingObjectif] = useState(null)

  // ===== Vue terrain nationale (nouveau) =====
  const [fieldVisites, setFieldVisites] = useState([])
  const [fieldPortfolios, setFieldPortfolios] = useState([])
  const [fieldObjectifs, setFieldObjectifs] = useState([])
  const [loadingField, setLoadingField] = useState(false)

  // ===== Flux de coaching =====
  const [coachingManager, setCoachingManager] = useState(null) // le manager en cours de coaching
  const [coachStep, setCoachStep] = useState('delegate') // 'delegate' | 'visit' | 'score'
  const [teamDelegates, setTeamDelegates] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState(null)
  const [delegateVisits, setDelegateVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [scoreForm, setScoreForm] = useState({})
  const [savingCoaching, setSavingCoaching] = useState(false)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const countryManagerId = profile.managers?.id

  const CRITERES = [
    { key: 'preparation_score', label: 'Préparation', icon: '📋' },
    { key: 'product_knowledge_score', label: 'Connaissance produit', icon: '💊' },
    { key: 'presentation_score', label: 'Présentation', icon: '🎯' },
    { key: 'argumentation_score', label: 'Argumentation', icon: '💬' },
    { key: 'listening_score', label: 'Écoute', icon: '👂' },
    { key: 'objection_handling_score', label: 'Gestion objections', icon: '🛡️' },
    { key: 'conclusion_score', label: 'Conclusion', icon: '✅' },
  ]
  const SCORE_LABELS = { 1: 'Insuffisant', 2: 'À améliorer', 3: 'Satisfaisant', 4: 'Bien', 5: 'Excellent' }
  const SCORE_COLORS = { 1: '#DC2626', 2: '#F59E0B', 3: '#F59E0B', 4: '#087F5B', 5: '#16A34A' }
  const RUBRIC = {
    preparation_score: { 1: 'N\'a pas préparé sa visite d\'accompagnement.', 2: 'Préparation minimale, sans objectif clair pour l\'équipe.', 3: 'Préparation correcte mais générique.', 4: 'Préparation solide, objectifs clairs pour le délégué accompagné.', 5: 'Préparation exemplaire, anticipe les besoins du délégué et du terrain.' },
    product_knowledge_score: { 1: 'Ne maîtrise pas les produits de son équipe.', 2: 'Connaissances de base incomplètes.', 3: 'Connaissances suffisantes pour encadrer.', 4: 'Bonne maîtrise, peut corriger le délégué si besoin.', 5: 'Maîtrise experte, référence pour toute l\'équipe.' },
    presentation_score: { 1: 'N\'intervient pas, reste passif pendant la visite.', 2: 'Intervention désorganisée.', 3: 'Sait intervenir correctement si besoin.', 4: 'Structure son intervention pour appuyer le délégué.', 5: 'Intervention fluide, renforce la crédibilité du délégué sans l\'écraser.' },
    argumentation_score: { 1: 'N\'aide pas le délégué face aux objections.', 2: 'Aide de façon désorganisée.', 3: 'Aide correctement sur les objections courantes.', 4: 'Structure l\'argumentation de son délégué en temps réel.', 5: 'Coache l\'argumentation avec des exemples précis et transférables.' },
    listening_score: { 1: 'N\'observe pas réellement le délégué en action.', 2: 'Observation superficielle.', 3: 'Observe correctement le déroulé de la visite.', 4: 'Observation active, identifie les points forts et faibles.', 5: 'Observation experte, détecte des axes de progrès non évidents.' },
    objection_handling_score: { 1: 'Ne sait pas débriefer une objection mal gérée.', 2: 'Débrief vague après la visite.', 3: 'Débrief correct sur la gestion des objections.', 4: 'Débrief structuré avec conseils concrets.', 5: 'Débrief qui transforme durablement la pratique du délégué.' },
    conclusion_score: { 1: 'Quitte sans faire de retour au délégué.', 2: 'Retour vague, sans plan d\'action.', 3: 'Retour correct, sans suivi précis.', 4: 'Retour clair avec un plan d\'action pour le délégué.', 5: 'Retour qui engage un vrai plan de progression suivi dans le temps.' },
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    if (!countryManagerId) { setLoading(false); return }
    const monthStart = `${currentMonth}-01`

    const [{ data: m, error: errM }, { data: cr, error: errCr }, { data: obj, error: errObj }] = await Promise.all([
      supabase.from('managers').select('*').eq('country_manager_id', countryManagerId).order('nom'),
      supabase.from('coaching_reports').select('*').not('manager_id', 'is', null).gte('created_at', monthStart),
      supabase.from('objectifs').select('*').not('manager_id', 'is', null).eq('mois', currentMonth)
    ])

    if (errM || errCr || errObj) console.error('Erreur chargement Country Manager:', { errM, errCr, errObj })

    setManagers(m || [])
    setCoachingReports(cr || [])
    setObjectifs(obj || [])

    // ===== Vue terrain nationale — agrégée sur tous les délégués de tous
    // les managers de ce Country Manager, même logique que Dashboard.jsx
    // (le dashboard Manager), juste un niveau plus haut.
    if (m && m.length > 0) {
      setLoadingField(true)
      const managerIds = m.map(x => x.id)

      const { data: teamDelegatesData, error: errTeam } = await supabase
        .from('delegates').select('id')
        .in('real_manager_id', managerIds)
        .eq('agence_id', profile.agence_id)

      const delegateIds = (teamDelegatesData || []).map(d => d.id)

      if (delegateIds.length > 0) {
        const [{ data: v, error: errV }, { data: po, error: errPo }, { data: dobj, error: errDobj }] = await Promise.all([
          supabase.from('visites').select('delegate_id, statut, created_at, healthcare_professional_id')
            .in('delegate_id', delegateIds).gte('created_at', monthStart),
          supabase.from('delegate_portfolios').select('delegate_id').eq('is_active', true).in('delegate_id', delegateIds),
          supabase.from('objectifs').select('*').eq('mois', currentMonth).in('delegate_id', delegateIds)
        ])
        if (errTeam || errV || errPo || errDobj) console.error('Erreur vue terrain nationale:', { errTeam, errV, errPo, errDobj })
        setFieldVisites(v || [])
        setFieldPortfolios(po || [])
        setFieldObjectifs(dobj || [])
      } else {
        setFieldVisites([]); setFieldPortfolios([]); setFieldObjectifs([])
      }
      setLoadingField(false)
    }

    setLoading(false)
  }

  const getCoachingCount = (managerId) => coachingReports.filter(c => c.manager_id === managerId).length
  const getObjectif = (managerId) => objectifs.find(o => o.manager_id === managerId)

  const handleSetObjectif = async (managerId, value) => {
    setSavingObjectif(managerId)
    const existing = getObjectif(managerId)
    let error
    if (existing) {
      const r = await supabase.from('objectifs').update({ objectif_visites: value }).eq('id', existing.id)
      error = r.error
    } else {
      const r = await supabase.from('objectifs').insert({
        agence_id: profile.agence_id, manager_id: managerId, mois: currentMonth, objectif_visites: value
      })
      error = r.error
    }
    setSavingObjectif(null)
    if (error) { alert('Erreur : ' + error.message); return }
    fetchAll()
  }

  // ===== Ouverture du flux de coaching =====
  const startCoaching = async (manager) => {
    setCoachingManager(manager)
    setCoachStep('delegate')
    setSelectedDelegate(null)
    setSelectedVisit(null)
    setScoreForm({})
    setLoadingTeam(true)
    const { data, error } = await supabase.from('delegates')
      .select('id, nom, prenom')
      .eq('real_manager_id', manager.id)
      .eq('agence_id', profile.agence_id)
      .order('nom')
    setLoadingTeam(false)
    if (error) { alert('Erreur : ' + error.message); setCoachingManager(null); return }
    setTeamDelegates(data || [])
  }

  const pickDelegate = async (delegate) => {
    setSelectedDelegate(delegate)
    setLoadingVisits(true)
    const { data, error } = await supabase.from('visites')
      .select('id, nom_contact, created_at, produit, statut')
      .eq('delegate_id', delegate.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setLoadingVisits(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setDelegateVisits(data || [])
    setCoachStep('visit')
  }

  const pickVisit = (visit) => {
    setSelectedVisit(visit)
    setCoachStep('score')
  }

  const handleSaveCoaching = async () => {
    const missing = CRITERES.filter(c => !scoreForm[c.key])
    if (missing.length > 0) { alert('Merci de noter tous les critères'); return }
    setSavingCoaching(true)

    const scores = CRITERES.map(c => scoreForm[c.key])
    const globalScore = (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)

    const { error } = await supabase.from('coaching_reports').insert({
      visit_id: selectedVisit.id,
      manager_id: coachingManager.id,
      evaluator_id: profile.id,
      preparation_score: scoreForm.preparation_score,
      product_knowledge_score: scoreForm.product_knowledge_score,
      presentation_score: scoreForm.presentation_score,
      argumentation_score: scoreForm.argumentation_score,
      listening_score: scoreForm.listening_score,
      objection_handling_score: scoreForm.objection_handling_score,
      conclusion_score: scoreForm.conclusion_score,
      global_score: globalScore,
      strengths: scoreForm.strengths || null,
      improvements: scoreForm.improvements || null,
      recommendations: scoreForm.recommendations || null,
    })

    setSavingCoaching(false)
    if (error) { alert('Erreur : ' + error.message); return }

    setCoachingManager(null)
    fetchAll()
  }

  const managersSansCoaching = managers.filter(m => getCoachingCount(m.id) === 0)

  // KPI terrain nationaux — même logique que le dashboard Manager, agrégée
  // sur tous les délégués de tous les managers de ce Country Manager.
  const totalVisitesRealisees = fieldVisites.filter(v => v.statut === 'Réalisée').length
  const totalCiblesNational = fieldPortfolios.length
  const ciblesVisiteesNational = new Set(fieldVisites.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size
  const couvertureNationale = totalCiblesNational > 0 ? Math.round((ciblesVisiteesNational / totalCiblesNational) * 100) : 0
  const objTotalNational = fieldObjectifs.reduce((s, o) => s + (o.objectif_visites || 0), 0)
  const objRealiseNational = fieldObjectifs.reduce((s, o) => {
    const dvs = fieldVisites.filter(v => v.delegate_id === o.delegate_id && v.statut === 'Réalisée')
    return s + dvs.length
  }, 0)
  const objPctNational = objTotalNational > 0 ? Math.round((objRealiseNational / objTotalNational) * 100) : null

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  if (!countryManagerId) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 max-w-sm text-center border border-[#DDE4EA]">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-[#172B4D] font-semibold mb-2">Fiche d'identité manquante</p>
          <p className="text-sm text-[#667085] mb-4">
            Votre compte Country Manager n'est pas encore relié à une fiche d'identité. Demandez à un administrateur de la compléter depuis "Comptes".
          </p>
          <button onClick={() => supabase.auth.signOut()}
            className="bg-[#EEF1F4] text-[#667085] font-semibold px-4 py-2 rounded-lg text-sm">
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  if (page === 'comptes') return <GestionComptes onBack={() => setPage('dashboard')} profile={profile} />

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-base">{agence?.nom}</p>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            Country Manager — {profile.managers?.prenom} {profile.managers?.nom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage('comptes')}
            className="bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-semibold">
            👥 Comptes
          </button>
          <button onClick={() => supabase.auth.signOut()}
            className="bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-semibold">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">

        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
          Activité terrain — vue nationale {loadingField && '(chargement...)'}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className="text-xl font-bold text-[#172B4D]">{totalVisitesRealisees}</p>
            <p className="text-xs text-[#667085]">Visites ce mois</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className="text-xl font-bold text-[#087F5B]">{couvertureNationale}%</p>
            <p className="text-xs text-[#667085]">{ciblesVisiteesNational}/{totalCiblesNational} cibles</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className="text-xl font-bold text-[#2563EB]">{objPctNational !== null ? `${objPctNational}%` : '—'}</p>
            <p className="text-xs text-[#667085]">
              {objPctNational !== null ? `${objRealiseNational}/${objTotalNational} visites` : 'Objectifs non définis'}
            </p>
          </div>
        </div>

        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mt-2">
          Coaching des managers
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className="text-xl font-bold text-[#172B4D]">{managers.length}</p>
            <p className="text-xs text-[#667085]">Managers</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className="text-xl font-bold text-[#087F5B]">{coachingReports.length}</p>
            <p className="text-xs text-[#667085]">Coachings ce mois</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
            <p className={`text-xl font-bold ${managersSansCoaching.length > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
              {managersSansCoaching.length}
            </p>
            <p className="text-xs text-[#667085]">Sans coaching</p>
          </div>
        </div>

        {managersSansCoaching.length > 0 ? (
          <div className="bg-[#FDE8E8] border border-[#DC2626]/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-[#DC2626] mb-2">
              ⚠️ {managersSansCoaching.length} manager{managersSansCoaching.length > 1 ? 's' : ''} sans coaching ce mois
            </p>
            <div className="flex flex-wrap gap-2">
              {managersSansCoaching.map(m => (
                <span key={m.id} className="text-xs bg-white text-[#DC2626] font-semibold px-2 py-1 rounded-full">
                  {m.prenom} {m.nom}
                </span>
              ))}
            </div>
          </div>
        ) : managers.length > 0 ? (
          <div className="bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-[#087F5B]">✅ Tous les managers ont été coachés ce mois</p>
          </div>
        ) : null}

        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
          Mes managers ({managers.length})
        </p>

        {managers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🧑‍💼</p>
            <p className="text-[#667085] text-sm font-medium">Aucun manager rattaché pour l'instant</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Allez dans "Comptes" et cliquez sur "+ Créer un manager" — il sera automatiquement rattaché à vous.
            </p>
          </div>
        ) : (
          managers.map(m => {
            const nbCoaching = getCoachingCount(m.id)
            const objectif = getObjectif(m.id)
            const objectifValue = objectif?.objectif_visites ?? 3
            const progress = objectifValue > 0 ? Math.min(100, Math.round((nbCoaching / objectifValue) * 100)) : 0

            return (
              <div key={m.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-[#172B4D] text-sm">{m.prenom} {m.nom}</p>
                    {m.telephone && <p className="text-xs text-[#667085]">📞 {m.telephone}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    nbCoaching >= objectifValue ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FEF3E2] text-[#B45309]'
                  }`}>
                    {nbCoaching}/{objectifValue} visites duo
                  </span>
                </div>

                <div className="bg-[#EEF1F4] rounded-full h-2 mb-3">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${progress}%`, background: progress >= 100 ? '#087F5B' : '#F59E0B' }} />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-[#98A2B3]">Objectif mensuel :</label>
                  <input type="number" defaultValue={objectifValue} min="0" max="20"
                    onBlur={e => {
                      const v = parseInt(e.target.value) || 0
                      if (v !== objectifValue) handleSetObjectif(m.id, v)
                    }}
                    disabled={savingObjectif === m.id}
                    className="w-16 p-1.5 rounded border border-[#DDE4EA] text-xs text-center" />
                  <span className="text-xs text-[#98A2B3]">visites duo / mois</span>
                </div>

                <button onClick={() => startCoaching(m)}
                  className="w-full bg-[#172B4D] text-white text-xs font-semibold py-2 rounded-lg">
                  📝 Coacher ce manager
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* ===== Modale de coaching, en 3 étapes ===== */}
      {coachingManager && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-[#98A2B3] uppercase tracking-wide">Coaching</p>
                <p className="font-semibold text-[#172B4D]">{coachingManager.prenom} {coachingManager.nom}</p>
              </div>
              <button onClick={() => setCoachingManager(null)} className="text-[#98A2B3] text-xl">×</button>
            </div>

            {/* Étape 1 — choisir le délégué accompagné */}
            {coachStep === 'delegate' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-1">
                  Quel délégué de son équipe accompagniez-vous ?
                </p>
                {loadingTeam ? (
                  <p className="text-sm text-[#98A2B3] text-center py-4">Chargement...</p>
                ) : teamDelegates.length === 0 ? (
                  <div className="bg-[#FEF3E2] border border-[#F59E0B]/30 rounded-lg p-3">
                    <p className="text-xs text-[#B45309] font-semibold">
                      Aucun délégué n'est encore rattaché à ce manager (champ "Manager responsable" dans Comptes).
                    </p>
                  </div>
                ) : (
                  teamDelegates.map(d => (
                    <button key={d.id} onClick={() => pickDelegate(d)}
                      className="text-left p-3 rounded-lg border border-[#DDE4EA] bg-[#F4F7F9] text-sm text-[#172B4D] font-medium">
                      {d.prenom} {d.nom}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Étape 2 — choisir la visite */}
            {coachStep === 'visit' && (
              <div className="flex flex-col gap-2">
                <button onClick={() => setCoachStep('delegate')} className="text-xs text-[#2563EB] font-semibold mb-1 text-left">← Changer de délégué</button>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-1">
                  Quelle visite de {selectedDelegate.prenom} concerne ce coaching ?
                </p>
                {loadingVisits ? (
                  <p className="text-sm text-[#98A2B3] text-center py-4">Chargement...</p>
                ) : delegateVisits.length === 0 ? (
                  <p className="text-xs text-[#98A2B3] text-center py-4">Aucune visite récente pour ce délégué.</p>
                ) : (
                  delegateVisits.map(v => (
                    <button key={v.id} onClick={() => pickVisit(v)}
                      className="text-left p-3 rounded-lg border border-[#DDE4EA] bg-[#F4F7F9]">
                      <p className="text-sm font-medium text-[#172B4D]">{v.nom_contact || 'Sans nom'}</p>
                      <p className="text-xs text-[#667085]">
                        {new Date(v.created_at).toLocaleDateString('fr-FR')} {v.produit && `· ${v.produit}`}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Étape 3 — notation */}
            {coachStep === 'score' && (
              <div className="flex flex-col gap-4">
                <button onClick={() => setCoachStep('visit')} className="text-xs text-[#2563EB] font-semibold text-left">← Changer de visite</button>
                <div className="bg-[#F4F7F9] rounded-lg p-2.5">
                  <p className="text-xs text-[#667085]">
                    Visite de <span className="font-semibold">{selectedDelegate.prenom} {selectedDelegate.nom}</span> — {selectedVisit.nom_contact}
                  </p>
                </div>

                {CRITERES.map(c => (
                  <div key={c.key}>
                    <p className="text-sm font-medium text-[#172B4D] mb-1.5">{c.icon} {c.label}</p>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setScoreForm(f => ({ ...f, [c.key]: s }))}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                          style={{
                            background: scoreForm[c.key] >= s ? SCORE_COLORS[scoreForm[c.key]] : '#EEF1F4',
                            color: scoreForm[c.key] >= s ? '#fff' : '#98A2B3'
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[#98A2B3] text-center mt-1">{SCORE_LABELS[scoreForm[c.key]]}</p>
                    {RUBRIC[c.key]?.[scoreForm[c.key]] && (
                      <div className="bg-[#F4F7F9] rounded-lg p-2.5 mt-1">
                        <p className="text-xs text-[#172B4D] leading-snug">{RUBRIC[c.key][scoreForm[c.key]]}</p>
                      </div>
                    )}
                  </div>
                ))}

                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Points forts</label>
                  <textarea value={scoreForm.strengths || ''} onChange={e => setScoreForm(f => ({ ...f, strengths: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Axes d'amélioration</label>
                  <textarea value={scoreForm.improvements || ''} onChange={e => setScoreForm(f => ({ ...f, improvements: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Recommandations</label>
                  <textarea value={scoreForm.recommendations || ''} onChange={e => setScoreForm(f => ({ ...f, recommendations: e.target.value }))}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none" />
                </div>

                <button onClick={handleSaveCoaching} disabled={savingCoaching}
                  className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {savingCoaching ? 'Enregistrement...' : 'Enregistrer le coaching'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
