import { useState, useEffect, useRef } from 'react'
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
import GestionContenu from './GestionContenu'
import GestionVentes from './GestionVentes'
import RapportCoaching from './RapportCoaching'
import GestionObjectifs from './GestionObjectifs'
import Notifications from './Notifications'
import CorrelationVentes from './CorrelationVentes'
import JournalAudit from './JournalAudit'
import GestionAppareils from './GestionAppareils'
import RechercheGlobale from './RechercheGlobale'
import GestionMarques from './GestionMarques'
import ExportPDF from './ExportPDF'
import Onboarding from './Onboarding'

const C = {
  bg: '#F4F7F9', surface: '#FFFFFF', primary: '#087F5B', primaryTint: '#EAF6F1',
  text: '#172B4D', textSecondary: '#5B6B85', border: '#E1E7EC',
  success: '#22C55E', successTint: '#F0FDF4', warning: '#F59E0B', warningTint: '#FEF6E7',
  danger: '#DC2626', dangerTint: '#FDEDED', info: '#2563EB', infoTint: '#EDF3FE', neutralTint: '#F0F2F5',
}
const BOTTOM_NAV_HEIGHT = 68

const RESPONSIVE_CSS = `
  .mt-shell { --mt-max: 720px; --mt-body: 14px; --mt-h1: 17px; --mt-h2: 16px; --mt-label: 13px; --mt-kpi: 26px; --mt-micro: 11px; --mt-cols-3: repeat(3, minmax(0,1fr)); --mt-cols-4: repeat(4, minmax(0,1fr)); }
  @media (min-width: 768px) {
    .mt-shell { --mt-max: 900px; --mt-body: 15px; --mt-h1: 19px; --mt-h2: 17px; --mt-label: 14px; --mt-kpi: 30px; --mt-micro: 12px; --mt-cols-3: repeat(4, minmax(0,1fr)); --mt-cols-4: repeat(4, minmax(0,1fr)); }
  }
  @media (min-width: 1100px) {
    .mt-shell { --mt-max: 1180px; --mt-body: 16px; --mt-h1: 21px; --mt-h2: 18px; --mt-label: 14px; --mt-kpi: 32px; --mt-micro: 12px; --mt-cols-3: repeat(6, minmax(0,1fr)); --mt-cols-4: repeat(4, minmax(0,1fr)); }
  }
  .mt-container { max-width: var(--mt-max); margin: 0 auto; width: 100%; }
  .mt-grid3 { display: grid; grid-template-columns: var(--mt-cols-3); gap: 10px; }
  .mt-grid4 { display: grid; grid-template-columns: var(--mt-cols-4); gap: 10px; }
  .mt-navbtn { background: #fff; border: 1px solid ${C.border}; border-radius: 12px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: ${C.text}; font-size: var(--mt-label); font-weight: 600; cursor: pointer; transition: border-color .15s, background .15s, transform .1s; }
  .mt-navbtn:hover { border-color: ${C.primary}; background: ${C.primaryTint}; transform: translateY(-1px); }
  .mt-navbtn i { font-size: 23px; color: ${C.textSecondary}; }
`

function ConfigurationScreen({ navigate, onBack }) {
  const sectionTitle = { fontSize: 'var(--mt-label)', fontWeight: 700, color: C.textSecondary, marginBottom: 10 }
  const Btn = ({ id, icon, label }) => (
    <button onClick={() => navigate(id)} className="mt-navbtn">
      <i className={`ti ${icon}`}></i>
      <span style={{ textAlign: 'center', lineHeight: 1.25 }}>{label}</span>
    </button>
  )
  return (
    <div className="mt-shell" style={{ minHeight: '100vh', background: C.bg, paddingBottom: BOTTOM_NAV_HEIGHT + 16 }}>
      <style>{RESPONSIVE_CSS}</style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.44.0/iconfont/tabler-icons.min.css" />
      <div style={{ background: C.text, padding: '20px 24px', display: 'flex', justifyContent: 'center' }}>
        <div className="mt-container" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
          <div>
            <h1 style={{ color: '#fff', fontSize: 'var(--mt-h1)', fontWeight: 700, margin: 0 }}>Configuration</h1>
            <p style={{ color: '#B7C2D6', fontSize: 'var(--mt-micro)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Paramétrage de l'agence
            </p>
          </div>
        </div>
      </div>

      <div className="mt-container" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={sectionTitle}>Ciblage & structure</p>
          <div className="mt-grid3">
            <Btn id="labos" icon="ti-flask" label="Laboratoires" />
            <Btn id="marques" icon="ti-tag" label="Marques" />
            <Btn id="professionnels" icon="ti-stethoscope" label="Professionnels" />
            <Btn id="etablissements" icon="ti-building-hospital" label="Établissements" />
            <Btn id="territoires" icon="ti-map-pin" label="Territoires" />
          </div>
        </div>
        <div>
          <p style={sectionTitle}>Accès externes</p>
          <div className="mt-grid3">
            <Btn id="extranet" icon="ti-world" label="Extranet" />
          </div>
        </div>
        <div>
          <p style={sectionTitle}>Administration</p>
          <div className="mt-grid3">
            <Btn id="comptes" icon="ti-lock" label="Comptes" />
            <Btn id="appareils" icon="ti-device-tablet" label="Appareils" />
            <Btn id="audit" icon="ti-history" label="Journal" />
            <Btn id="onboarding" icon="ti-rocket" label="Guide config." />
          </div>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ current, navigate, unreadCount }) {
  const items = [
    { id: 'dashboard', icon: 'ti-home', label: 'Accueil' },
    { id: 'carte', icon: 'ti-map-2', label: 'Carte' },
    { id: 'planification', icon: 'ti-calendar', label: 'Planning' },
    { id: 'recherche', icon: 'ti-search', label: 'Recherche' },
    { id: 'notifications', icon: 'ti-bell', label: 'Alertes', badge: unreadCount },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: BOTTOM_NAV_HEIGHT,
      background: '#fff', borderTop: `1px solid ${C.border}`, zIndex: 40,
      boxShadow: '0 -3px 12px rgba(23,43,77,0.06)', display: 'flex', justifyContent: 'center'
    }}>
      <div className="mt-container" style={{ display: 'flex', height: '100%' }}>
        {items.map(item => {
          const active = current === item.id
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              style={{
                flex: 1, background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', position: 'relative',
                padding: '8px 4px'
              }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: active ? 44 : 'auto', height: active ? 30 : 'auto',
                background: active ? C.primary : 'transparent', borderRadius: 16, transition: 'all .15s'
              }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 21, color: active ? '#fff' : C.textSecondary }}></i>
              </div>
              <span style={{ fontSize: 'var(--mt-micro)', fontWeight: active ? 800 : 600, color: active ? C.primary : C.textSecondary }}>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span style={{ position: 'absolute', top: 4, right: '26%', background: C.danger, color: '#fff', fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ session, profile, agence }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [plans, setPlans] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // ===== Pile de navigation — le vrai fix du bouton retour =====
  const [pageStack, setPageStack] = useState(['dashboard'])
  const page = pageStack[pageStack.length - 1]
  const scrollPosRef = useRef(0)

  // navigate() empile une nouvelle page (retour = revient exactement d'où on vient)
  const navigate = (pageId) => {
    if (page === 'dashboard') scrollPosRef.current = window.scrollY
    setPageStack(stack => [...stack, pageId])
  }
  // navigateRoot() — utilisé par la nav du bas : réinitialise la pile (raccourcis principaux)
  const navigateRoot = (pageId) => {
    scrollPosRef.current = window.scrollY
    setPageStack(pageId === 'dashboard' ? ['dashboard'] : ['dashboard', pageId])
  }
  // goBack() dépile — revient exactement à la page précédente
  const goBack = () => {
    setPageStack(stack => stack.length > 1 ? stack.slice(0, -1) : stack)
  }

  useEffect(() => {
    if (page === 'dashboard') {
      requestAnimationFrame(() => window.scrollTo(0, scrollPosRef.current))
    }
  }, [page])

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

  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('agence_id', profile.agence_id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setRefreshing(true)
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const [
      { data: delegatesData }, { data: visitesData }, { data: campagnesData },
      { data: portfoliosData }, { data: plansData }, { data: objectifsData }
    ] = await Promise.all([
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id),
      supabase.from('visites').select('*, delegates(*)').eq('agence_id', profile.agence_id).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).eq('statut', 'active'),
      supabase.from('delegate_portfolios').select('*').eq('agence_id', profile.agence_id).eq('is_active', true),
      supabase.from('visit_plans').select('*').eq('agence_id', profile.agence_id).in('statut', ['pending', 'confirmed']),
      supabase.from('objectifs').select('*').eq('agence_id', profile.agence_id).eq('mois', currentMonth)
    ])
    setDelegates(delegatesData || [])
    setVisites(visitesData || [])
    setCampagnes(campagnesData || [])
    setPortfolios(portfoliosData || [])
    setPlans(plansData || [])
    setObjectifs(objectifsData || [])
    setLoading(false)
    setRefreshing(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: C.primary, fontWeight: 600, fontSize: 15 }}>Chargement...</p>
    </div>
  )

  const childPages = {
    carte: <Carte profile={profile} onBack={goBack} />,
    statistiques: <Statistiques profile={profile} onBack={goBack} />,
    rapports: <Rapports profile={profile} onBack={goBack} />,
    'stats-avancees': <StatistiquesAvancees profile={profile} onBack={goBack} />,
    delegues: <GestionDelegues profile={profile} onBack={() => { goBack(); fetchData() }} />,
    produits: <GestionProduits profile={profile} onBack={goBack} />,
    labos: <GestionLabos profile={profile} onBack={goBack} />,
    comptes: <GestionComptes profile={profile} onBack={goBack} />,
    extranet: <Extranet profile={profile} onBack={goBack} />,
    fichiers: <Fichiers profile={profile} onBack={goBack} />,
    territoires: <GestionTerritoires profile={profile} onBack={goBack} />,
    etablissements: <GestionEtablissements profile={profile} onBack={goBack} />,
    professionnels: <GestionProfessionnels profile={profile} onBack={goBack} />,
    campagnes: <GestionCampagnes profile={profile} onBack={goBack} />,
    portefeuille: <GestionPortefeuille profile={profile} onBack={goBack} />,
    planification: <PlanificationVisites profile={profile} onBack={goBack} />,
    contenu: <GestionContenu profile={profile} onBack={goBack} />,
    ventes: <GestionVentes profile={profile} onBack={goBack} />,
    coaching: <RapportCoaching profile={profile} onBack={goBack} />,
    objectifs: <GestionObjectifs profile={profile} onBack={goBack} />,
    notifications: <Notifications profile={profile} onBack={goBack} />,
    correlation: <CorrelationVentes profile={profile} onBack={goBack} />,
    audit: <JournalAudit profile={profile} onBack={goBack} />,
    appareils: <GestionAppareils profile={profile} onBack={goBack} />,
    recherche: <RechercheGlobale profile={profile} onBack={goBack} />,
    marques: <GestionMarques profile={profile} onBack={goBack} />,
    pdf: <ExportPDF profile={profile} agence={agence} onBack={goBack} />,
    onboarding: <Onboarding profile={profile} agence={agence} onBack={goBack} onComplete={goBack} />,
    configuration: <ConfigurationScreen navigate={navigate} onBack={goBack} />,
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter(v => v.created_at?.slice(0, 10) === todayStr)
  const todayRealisees = todayVisites.filter(v => v.statut === 'Réalisée')
  const todayPlanifiees = plans.filter(p => p.planned_date === todayStr).length
  const todayTotal = Math.max(todayPlanifiees, todayVisites.length)
  const todayTaux = todayTotal > 0 ? Math.round((todayRealisees.length / todayTotal) * 100) : 0

  const totalCibles = portfolios.length
  const ciblesVisitees = new Set(visites.filter(v => v.healthcare_professional_id).map(v => v.healthcare_professional_id)).size
  const couverture = totalCibles > 0 ? Math.round((ciblesVisitees / totalCibles) * 100) : 0

  const objTotal = objectifs.reduce((s, o) => s + (o.objectif_visites || 0), 0)
  const objRealise = objectifs.reduce((s, o) => {
    const dvs = visites.filter(v => v.delegate_id === o.delegate_id && v.statut === 'Réalisée' && v.created_at?.slice(0, 7) === o.mois)
    return s + dvs.length
  }, 0)
  const objPct = objTotal > 0 ? Math.round((objRealise / objTotal) * 100) : null

  const aControler = visites.filter(v => v.confidence_status === 'to_check' || v.confidence_status === 'suspicious')
  const joursRestants = agence?.date_expiration
    ? Math.ceil((new Date(agence.date_expiration) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const activeDelegates = delegates.filter(d => (d.statut || 'actif') === 'actif')
  const delegatesWithoutVisit = activeDelegates.filter(d => !todayVisites.some(v => v.delegate_id === d.id))

  const daysLeftInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
  const objectifsEnRetard = objectifs.map(o => {
    const d = delegates.find(x => x.id === o.delegate_id)
    const dvs = visites.filter(v => v.delegate_id === o.delegate_id && v.statut === 'Réalisée' && v.created_at?.slice(0, 7) === o.mois)
    const pct = o.objectif_visites > 0 ? Math.round((dvs.length / o.objectif_visites) * 100) : 100
    return { delegate: d, pct, done: dvs.length, target: o.objectif_visites }
  }).filter(o => o.delegate && o.pct < 50).sort((a, b) => a.pct - b.pct).slice(0, 3)

  const hasUrgentItems = delegatesWithoutVisit.length > 0 || aControler.length > 0 || objectifsEnRetard.length > 0

  const perfDelegates = delegates.map(d => {
    const dvs = visites.filter(v => v.delegate_id === d.id && v.statut === 'Réalisée')
    return { ...d, count: dvs.length }
  }).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxPerf = Math.max(...perfDelegates.map(d => d.count), 1)

  const perfCampagnes = campagnes.map(c => {
    const cvs = visites.filter(v => v.campaign_id === c.id && v.statut === 'Réalisée')
    const pct = c.visits_objective > 0 ? Math.min(Math.round((cvs.length / c.visits_objective) * 100), 100) : null
    return { ...c, count: cvs.length, pct }
  }).slice(0, 4)

  const cardStyle = { background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '18px' }
  const sectionTitleStyle = { fontSize: 'var(--mt-micro)', fontWeight: 800, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }

  const NavBtn = ({ id, icon, label }) => (
    <button onClick={() => navigate(id)} className="mt-navbtn">
      <i className={`ti ${icon}`}></i>
      <span style={{ textAlign: 'center', lineHeight: 1.25 }}>{label}</span>
    </button>
  )

  const KpiCard = ({ label, value, sub, subColor, icon, accent }) => (
    <div style={{ ...cardStyle, padding: 16, borderLeft: accent ? `4px solid ${accent}` : cardStyle.border }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 'var(--mt-label)', color: C.textSecondary, fontWeight: 600 }}>{label}</p>
        {icon && <i className={`ti ${icon}`} style={{ fontSize: 18, color: accent || C.textSecondary }}></i>}
      </div>
      <p style={{ fontSize: 'var(--mt-kpi)', fontWeight: 800, color: C.text, marginTop: 6, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 'var(--mt-label)', color: subColor || C.textSecondary, marginTop: 5 }}>{sub}</p>}
    </div>
  )

  if (childPages[page]) {
    return (
      <div className="mt-shell">
        <style>{RESPONSIVE_CSS}</style>
        <div style={{ paddingBottom: BOTTOM_NAV_HEIGHT }}>
          {childPages[page]}
        </div>
        <BottomNav current={page} navigate={navigateRoot} unreadCount={unreadCount} />
      </div>
    )
  }

  return (
    <div className="mt-shell" style={{ minHeight: '100vh', background: C.bg, fontSize: 'var(--mt-body)', paddingBottom: BOTTOM_NAV_HEIGHT + 20 }}>
      <style>{RESPONSIVE_CSS}</style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.44.0/iconfont/tabler-icons.min.css" />

      <div style={{ background: C.text, padding: '20px 24px', display: 'flex', justifyContent: 'center' }}>
        <div className="mt-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-medical-cross" style={{ color: '#5FD9AE', fontSize: 25 }}></i>
            <div>
              <h1 style={{ color: '#fff', fontSize: 'var(--mt-h1)', fontWeight: 700, margin: 0 }}>MedTrack</h1>
              <p style={{ color: '#B7C2D6', fontSize: 'var(--mt-micro)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {agence?.nom || 'Tableau de bord'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('configuration')} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid #435576`, color: '#fff', padding: '9px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--mt-label)', fontWeight: 700 }}>
              <i className="ti ti-settings" style={{ fontSize: 17 }}></i>
              <span>Configuration</span>
            </button>
            <button onClick={fetchData} disabled={refreshing} style={{ background: 'transparent', border: 'none', color: '#B7C2D6', width: 38, height: 38, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`ti ti-refresh ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: 19 }}></i>
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: `1px solid #435576`, color: '#D7DEEA', padding: '10px 16px', borderRadius: 10, fontSize: 'var(--mt-label)', fontWeight: 700, cursor: 'pointer' }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {joursRestants !== null && joursRestants <= 5 && joursRestants > 0 && (
        <div style={{ background: C.warningTint, borderBottom: `1px solid ${C.warning}`, padding: '10px 24px', display: 'flex', justifyContent: 'center' }}>
          <div className="mt-container" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-alert-triangle" style={{ color: '#B45309', fontSize: 16 }}></i>
            <span style={{ color: '#92400E', fontSize: 'var(--mt-label)', fontWeight: 700 }}>Votre accès expire dans {joursRestants} jour(s)</span>
          </div>
        </div>
      )}

      <div className="mt-container" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 26 }}>

        <div>
          <p style={sectionTitleStyle}>Aujourd'hui</p>

          {!hasUrgentItems ? (
            <div style={{ ...cardStyle, background: C.successTint, border: `1px solid ${C.success}33`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="ti ti-circle-check" style={{ color: C.success, fontSize: 24 }}></i>
              <p style={{ fontSize: 'var(--mt-body)', fontWeight: 700, color: '#166534' }}>Rien à signaler — tout est sous contrôle aujourd'hui</p>
            </div>
          ) : (
            <div className="mt-grid4">
              {delegatesWithoutVisit.length > 0 && (
                <div style={{ ...cardStyle, borderLeft: `4px solid ${C.warning}`, gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ fontSize: 'var(--mt-h2)', fontWeight: 700, color: C.text }}>Pas encore visité</p>
                    <span style={{ fontSize: 'var(--mt-micro)', fontWeight: 800, color: '#92400E', background: C.warningTint, padding: '4px 10px', borderRadius: 20 }}>
                      {delegatesWithoutVisit.length}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--mt-label)', color: C.text, lineHeight: 1.6 }}>
                    {delegatesWithoutVisit.slice(0, 8).map(d => `${d.prenom} ${d.nom}`).join(' · ')}
                    {delegatesWithoutVisit.length > 8 && (
                      <span style={{ color: C.textSecondary }}> +{delegatesWithoutVisit.length - 8} autre{delegatesWithoutVisit.length - 8 > 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
              )}

              {aControler.length > 0 && (
                <div style={{ ...cardStyle, borderLeft: `4px solid ${C.danger}`, gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ fontSize: 'var(--mt-h2)', fontWeight: 700, color: C.text }}>Visites à contrôler</p>
                    <button onClick={() => navigate('stats-avancees')} style={{ fontSize: 'var(--mt-micro)', fontWeight: 800, color: C.danger, background: C.dangerTint, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer' }}>
                      {aControler.length} →
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {aControler.slice(0, 3).map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--mt-label)' }}>
                        <span style={{ color: C.text, fontWeight: 500 }}>{v.delegates?.prenom} {v.delegates?.nom} — {v.nom_contact || '—'}</span>
                        <span style={{ color: v.confidence_status === 'suspicious' ? C.danger : C.warning, fontWeight: 700 }}>{v.confidence_score}pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {objectifsEnRetard.length > 0 && (
                <div style={{ ...cardStyle, borderLeft: `4px solid ${C.info}`, gridColumn: 'span 4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ fontSize: 'var(--mt-h2)', fontWeight: 700, color: C.text }}>Objectifs en retard</p>
                    <button onClick={() => navigate('objectifs')} style={{ fontSize: 'var(--mt-micro)', fontWeight: 800, color: C.info, background: C.infoTint, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer' }}>
                      {objectifsEnRetard.length} →
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {objectifsEnRetard.map(o => (
                      <div key={o.delegate.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--mt-label)' }}>
                        <span style={{ color: C.text, fontWeight: 500 }}>{o.delegate.prenom} {o.delegate.nom}</span>
                        <span style={{ color: C.textSecondary }}>{o.done}/{o.target} visites · <b style={{ color: C.warning }}>{o.pct}%</b></span>
                      </div>
                    ))}
                  </div>
                  {daysLeftInMonth <= 7 && (
                    <p style={{ fontSize: 'var(--mt-micro)', color: C.textSecondary, marginTop: 10, fontWeight: 600 }}>⏳ {daysLeftInMonth} jour(s) restant(s) ce mois-ci</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p style={sectionTitleStyle}>Vue d'ensemble</p>
          <div className="mt-grid4">
            <KpiCard label="Aujourd'hui" value={todayTotal > 0 ? `${todayRealisees.length}/${todayTotal}` : todayRealisees.length}
              sub={todayTotal > 0 ? `${todayTaux}%` : 'Pas de plan'} icon="ti-map-pin-check" />
            <KpiCard label="Couverture" value={`${couverture}%`} sub={`${ciblesVisitees}/${totalCibles} cibles`} icon="ti-target-arrow" />
            <KpiCard label="Objectifs" value={objPct !== null ? `${objPct}%` : '—'}
              sub={objPct !== null ? `${objRealise}/${objTotal} visites` : 'Non défini'} icon="ti-flag-2" />
            <KpiCard label="À contrôler" value={aControler.length} sub={aControler.length > 0 ? 'Anomalie' : 'Aucune anomalie'}
              subColor={aControler.length > 0 ? C.danger : C.success} accent={aControler.length > 0 ? C.danger : undefined} icon="ti-shield-exclamation" />
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Activité terrain</p>
          <div className="mt-grid3">
            <NavBtn id="carte" icon="ti-map-2" label="Carte" />
            <NavBtn id="planification" icon="ti-calendar" label="Planning" />
            <NavBtn id="portefeuille" icon="ti-briefcase" label="Portefeuille" />
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Force de vente</p>
          <div className="mt-grid3">
            <NavBtn id="delegues" icon="ti-users" label="Délégués" />
            <NavBtn id="campagnes" icon="ti-target" label="Campagnes" />
            <NavBtn id="objectifs" icon="ti-flag" label="Objectifs" />
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Performance</p>
          <div className="mt-grid4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 'var(--mt-h2)', fontWeight: 700, color: C.text }}>Top délégués</p>
                <button onClick={() => navigate('stats-avancees')} style={{ background: 'transparent', border: 'none', color: C.primary, fontSize: 'var(--mt-label)', fontWeight: 700, cursor: 'pointer' }}>Voir tout</button>
              </div>
              {perfDelegates.length === 0 ? (
                <p style={{ fontSize: 'var(--mt-body)', color: C.textSecondary }}>Aucune visite enregistrée.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {perfDelegates.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 'var(--mt-body)', color: C.text, width: 130, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{d.prenom} {d.nom}</span>
                      <div style={{ flex: 1, background: C.neutralTint, borderRadius: 6, height: 10 }}>
                        <div style={{ width: `${(d.count / maxPerf) * 100}%`, background: C.primary, height: 10, borderRadius: 6 }} />
                      </div>
                      <span style={{ fontSize: 'var(--mt-body)', color: C.textSecondary, width: 24, textAlign: 'right', fontWeight: 600 }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 'var(--mt-h2)', fontWeight: 700, color: C.text }}>Campagnes actives</p>
                <button onClick={() => navigate('campagnes')} style={{ background: 'transparent', border: 'none', color: C.primary, fontSize: 'var(--mt-label)', fontWeight: 700, cursor: 'pointer' }}>Gérer</button>
              </div>
              {perfCampagnes.length === 0 ? (
                <p style={{ fontSize: 'var(--mt-body)', color: C.textSecondary }}>Aucune campagne active.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {perfCampagnes.map(c => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 'var(--mt-body)', color: C.text, fontWeight: 500 }}>{c.nom}</span>
                        <span style={{ fontSize: 'var(--mt-label)', color: C.textSecondary }}>{c.pct !== null ? `${c.pct}%` : `${c.count} visites`}</span>
                      </div>
                      {c.pct !== null && (
                        <div style={{ background: C.neutralTint, borderRadius: 6, height: 8 }}>
                          <div style={{ width: `${c.pct}%`, background: c.pct >= 80 ? C.success : c.pct >= 50 ? C.warning : C.danger, height: 8, borderRadius: 6 }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Produits & business</p>
          <div className="mt-grid4">
            <NavBtn id="produits" icon="ti-pill" label="Produits" />
            <NavBtn id="contenu" icon="ti-books" label="Bibliothèque" />
            <NavBtn id="ventes" icon="ti-building-store" label="Grossistes" />
            <NavBtn id="correlation" icon="ti-chart-dots" label="Corrélation" />
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Analyse & reporting</p>
          <div className="mt-grid3">
            <NavBtn id="statistiques" icon="ti-chart-bar" label="Statistiques" />
            <NavBtn id="stats-avancees" icon="ti-chart-line" label="Stats avancées" />
            <NavBtn id="coaching" icon="ti-trophy" label="Coaching" />
            <NavBtn id="rapports" icon="ti-table" label="Export Excel" />
            <NavBtn id="pdf" icon="ti-file-download" label="Export PDF" />
            <NavBtn id="fichiers" icon="ti-folder" label="Fichiers stats" />
          </div>
        </div>

      </div>

      <BottomNav current="dashboard" navigate={navigateRoot} unreadCount={unreadCount} />
    </div>
  )
}
