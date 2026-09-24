import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import {
  saveVisiteLocally, getPendingVisites, deleteLocalVisite,
  countPendingVisites, isOnline,
  saveAgendaOffline, getAgendaOffline,
  savePortfolioOffline, getPortfolioOffline,
  saveProduitsOffline, getProduitsOffline,
  saveSupportsOffline, getSupportsOffline,
  getOfflineStats, setLastSync
} from '../offline'
import Extranet from './Extranet'
import VisiteDetail from './VisiteDetail'
import ProfilDelegue from './ProfilDelegue'

export default function DelegueApp({ session, profile }) {
  const [visites, setVisites] = useState([])
  const [produits, setProduits] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [agenda, setAgenda] = useState([])
  const [supports, setSupports] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('accueil')
  const [position, setPosition] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [offlineStats, setOfflineStats] = useState(null)
  const [selectedVisite, setSelectedVisite] = useState(null)
  const [showProfil, setShowProfil] = useState(false)
  const [extranetAccess, setExtranetAccess] = useState(true) // défaut true tant que non chargé, pour ne pas masquer par erreur
  const watchRef = useRef(null)
  const photoRef = useRef(null)
  const photoFileRef = useRef(null)

  const [form, setForm] = useState({
    medecin_id: '', produits_ids: [], type_lieu: '',
    nom_contact: '', titre_contact: '', telephone_contact: '',
    statut: 'Réalisée', note: '', type: 'immediate',
    date_prevue: '', photoPreview: null,
    visit_plan_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const fetchData = async () => {
    if (isOnline()) {
      const [{ data: v }, { data: p }, { data: po }, { data: ag }, { data: sup }, { data: delegateRow }] = await Promise.all([
        supabase.from('visites')
          .select('*')
          .eq('delegate_id', profile.delegate_id)
          .order('created_at', { ascending: false }),
        supabase.from('produits')
          .select('*')
          .eq('agence_id', profile.agence_id)
          .eq('statut_produit', 'Normal')
          .order('nom'),
        supabase.from('delegate_portfolios')
          .select('*, commercial_targets(priority, healthcare_professionals(id, nom, prenom, specialite, establishments(nom))), campaigns(nom)')
          .eq('delegate_id', profile.delegate_id)
          .eq('is_active', true),
        supabase.from('visit_plans')
          .select('*, healthcare_professionals(nom, prenom, potential), establishments(nom), campaigns(nom)')
          .eq('delegate_id', profile.delegate_id)
          .in('statut', ['pending', 'confirmed'])
          .order('planned_date', { ascending: true }),
        supabase.from('content_assets')
          .select('*, produits(nom), laboratoires(nom)')
          .eq('agence_id', profile.agence_id)
          .eq('is_published', true)
          .eq('is_offline', true),
        supabase.from('delegates')
          .select('extranet_access')
          .eq('id', profile.delegate_id)
          .single()
      ])

      setVisites(v || [])
      setProduits(p || [])
      setPortfolio(po || [])
      setAgenda(ag || [])
      setSupports(sup || [])
      setExtranetAccess(delegateRow?.extranet_access !== false)

      await Promise.all([
        saveAgendaOffline(ag || []),
        savePortfolioOffline(po || []),
        saveProduitsOffline(p || []),
        saveSupportsOffline(sup || []),
        setLastSync('last_sync')
      ])
    } else {
      const [ag, po, p, sup] = await Promise.all([
        getAgendaOffline(),
        getPortfolioOffline(),
        getProduitsOffline(),
        getSupportsOffline()
      ])
      setAgenda(ag)
      setPortfolio(po)
      setProduits(p)
      setSupports(sup)
    }

    const stats = await getOfflineStats()
    setOfflineStats(stats)
    setLoading(false)
  }

  const startTracking = () => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setPosition({ lat, lng })
        await supabase.from('profiles')
          .update({ last_lat: lat, last_lng: lng, last_seen: new Date().toISOString() })
          .eq('id', session.user.id)
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    )
  }

  const checkPending = async () => {
    const count = await countPendingVisites()
    setPendingCount(count)
  }

  const syncPendingVisites = async () => {
    if (!isOnline()) { alert('Pas de connexion internet'); return }
    setSyncing(true)
    const pending = await getPendingVisites()
    let synced = 0
    for (const v of pending) {
      const { local_id, synced: _, produits_ids, ...visite } = v
      const { data, error } = await supabase.from('visites').insert(visite).select().single()
      if (!error && data) {
        if (produits_ids?.length > 0) {
          await supabase.from('visite_produits').insert(
            produits_ids.map(pid => ({ visite_id: data.id, produit_id: pid, agence_id: profile.agence_id }))
          )
        }
        await deleteLocalVisite(local_id)
        synced++
      }
    }
    setSyncing(false)
    setPendingCount(0)
    fetchData()
    alert(`✅ ${synced} visite(s) synchronisée(s) !`)
  }

  useEffect(() => {
    fetchData()
    startTracking()
    checkPending()

    const channel = supabase
      .channel('visites-delegue')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'visites',
        filter: `delegate_id=eq.${profile.delegate_id}`
      }, () => { fetchData() })
      .subscribe()

    const interval = setInterval(fetchData, 30000)
    window.addEventListener('online', syncPendingVisites)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      window.removeEventListener('online', syncPendingVisites)
    }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleProduit = (id) => {
    setForm(f => ({
      ...f,
      produits_ids: f.produits_ids.includes(id)
        ? f.produits_ids.filter(x => x !== id)
        : [...f.produits_ids, id]
    }))
  }

  const resetForm = () => {
    photoFileRef.current = null
    setForm({
      medecin_id: '', produits_ids: [], type_lieu: '',
      nom_contact: '', titre_contact: '', telephone_contact: '',
      statut: 'Réalisée', note: '', type: 'immediate',
      date_prevue: '', photoPreview: null,
      visit_plan_id: '', healthcare_professional_id: '',
      establishment_id: '', campaign_id: ''
    })
  }

  const handleSave = async () => {
    if (!form.type_lieu) { alert('Sélectionnez le type de lieu'); return }
    if (!form.nom_contact) { alert('Le nom du contact est obligatoire'); return }
    if (form.produits_ids.length === 0) { alert('Sélectionnez au moins un produit'); return }
    if (form.type === 'planifiee' && !form.date_prevue) { alert('Choisissez une date'); return }

    setSaving(true)
    let photo_url = null

    if (photoFileRef.current && isOnline()) {
      const file = photoFileRef.current
      const fileName = `${profile.delegate_id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('PHOTOS').upload(fileName, file)
      if (!uploadError) {
        photo_url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/PHOTOS/${fileName}`
      }
    }

    const visiteData = {
      delegate_id: profile.delegate_id,
      medecin_id: form.medecin_id || null,
      type_lieu: form.type_lieu,
      nom_contact: form.nom_contact,
      titre_contact: form.titre_contact,
      telephone_contact: form.telephone_contact,
      produit: produits.filter(p => form.produits_ids.includes(p.id)).map(p => p.nom).join(', '),
      statut: form.type === 'planifiee' ? 'Planifiée' : form.statut,
      note: form.note,
      latitude: form.type === 'immediate' ? position?.lat || null : null,
      longitude: form.type === 'immediate' ? position?.lng || null : null,
      gps_start_lat: form.type === 'immediate' ? position?.lat || null : null,
      gps_start_lng: form.type === 'immediate' ? position?.lng || null : null,
      started_at: form.type === 'immediate' ? new Date().toISOString() : null,
      type: form.type,
      date_prevue: form.date_prevue || null,
      agence_id: profile.agence_id,
      photo_url,
      visit_plan_id: form.visit_plan_id || null,
      healthcare_professional_id: form.healthcare_professional_id || null,
      establishment_id: form.establishment_id || null,
      campaign_id: form.campaign_id || null,
      visit_type: 'planned'
    }

    if (!isOnline()) {
      await saveVisiteLocally({ ...visiteData, produits_ids: form.produits_ids })
      await checkPending()
      setSaving(false)
      setSuccess(true)
      resetForm()
      setTimeout(() => { setPage('accueil'); setSuccess(false) }, 1500)
      return
    }

    const { data: saved } = await supabase.from('visites').insert(visiteData).select().single()

    if (saved) {
      if (form.produits_ids.length > 0) {
        await supabase.from('visite_produits').insert(
          form.produits_ids.map(pid => ({ visite_id: saved.id, produit_id: pid, agence_id: profile.agence_id }))
        )
      }
      await supabase.rpc('calculate_confidence_score', { visit_id: saved.id })
      await supabase.from('audit_logs').insert({
        agence_id: profile.agence_id,
        user_id: profile.id,
        action: 'visit_created',
        table_name: 'visites',
        record_id: saved.id,
        new_values: { delegate_id: saved.delegate_id, statut: saved.statut, nom_contact: saved.nom_contact }
      })
      if (form.visit_plan_id) {
        await supabase.from('visit_plans').update({ statut: 'done' }).eq('id', form.visit_plan_id)
      }
    }

    setSaving(false)
    setSuccess(true)
    resetForm()
    await fetchData()
    setTimeout(() => { setPage('accueil'); setSuccess(false) }, 1500)
  }

  const startVisiteFromPlan = (plan) => {
    setForm(f => ({
      ...f,
      visit_plan_id: plan.id,
      healthcare_professional_id: plan.healthcare_professional_id,
      establishment_id: plan.establishment_id || '',
      campaign_id: plan.campaign_id || '',
      nom_contact: `${plan.healthcare_professionals?.prenom} ${plan.healthcare_professionals?.nom}`,
      type_lieu: plan.establishments?.nom || '',
      type: 'immediate'
    }))
    setPage('visite')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#172B4D] flex items-center justify-center">
      <p className="text-[#5FB89B] font-medium">Chargement...</p>
    </div>
  )

  if (selectedVisite) return (
    <VisiteDetail
      visite={selectedVisite}
      profile={profile}
      onBack={() => { setSelectedVisite(null); fetchData() }}
    />
  )

  if (showProfil) return (
    <ProfilDelegue profile={profile} onBack={() => setShowProfil(false)} />
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter(v => v.created_at?.slice(0, 10) === todayStr)
  const todayAgenda = agenda.filter(a => a.planned_date === todayStr)
  const upcomingAgenda = agenda.filter(a => a.planned_date > todayStr).slice(0, 5)

  const TYPES_LIEU = ['CSRef', 'CSCom', 'Clinique', 'Cabinet de santé', 'Hôpital', 'Pharmacie', 'Autre']
  const TITRES = ['Médecin généraliste', 'Spécialiste', 'Pharmacien', 'Infirmier', 'Directeur', 'Autre']
  const POTENTIAL_COLORS = {
    A: 'bg-[#FDE8E8] text-[#DC2626]',
    B: 'bg-[#FEF3E2] text-[#B45309]',
    C: 'bg-[#EEF1F4] text-[#667085]'
  }
  const STATUT_COLORS = {
    'Réalisée': 'bg-[#E7F5EF] text-[#087F5B]',
    'Planifiée': 'bg-[#FEF3E2] text-[#B45309]',
    'Non aboutie': 'bg-[#FDE8E8] text-[#DC2626]'
  }
  const CONFIDENCE_COLORS = {
    validated: 'bg-[#E9F9EE] text-[#16A34A]',
    to_check: 'bg-[#FEF3E2] text-[#B45309]',
    suspicious: 'bg-[#FDE8E8] text-[#DC2626]'
  }
  const TYPE_ICONS = {
    pdf: '📄', image: '🖼️', video: '🎥', presentation: '📊', document: '📝'
  }
  const TYPE_COLORS_SUPPORT = {
    pdf: 'bg-[#FDE8E8] text-[#DC2626]',
    image: 'bg-[#E8F0FE] text-[#2563EB]',
    video: 'bg-[#E7F5EF] text-[#087F5B]',
    presentation: 'bg-[#FEF3E2] text-[#B45309]',
    document: 'bg-[#EEF1F4] text-[#667085]'
  }

  if (page === 'extranet' && extranetAccess) return <Extranet profile={profile} onBack={() => setPage('accueil')} />

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      {/* Header */}
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl text-[#087F5B]">⚕</span>
          <div>
            <h1 className="text-white font-semibold text-base">MedTrack</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {profile.delegates?.prenom} {profile.delegates?.nom}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${position ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
          <button onClick={() => setShowProfil(true)}
            className="w-8 h-8 rounded-full bg-[#087F5B] flex items-center justify-center font-semibold text-white text-sm">
            {profile.delegates?.prenom?.[0]}{profile.delegates?.nom?.[0]}
          </button>
          <button onClick={() => supabase.auth.signOut()}
            className="border border-[#3B4A63] text-[#C7D0E0] px-3 py-1.5 rounded-lg font-medium text-xs">
            Quitter
          </button>
        </div>
      </div>

      {/* GPS status */}
      <div className={`px-5 py-2 text-xs font-medium flex items-center gap-2 ${position ? 'bg-[#087F5B]' : 'bg-[#F59E0B]'}`}>
        <span className="text-white">
          {position ? `📍 GPS actif · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : '⚠️ GPS en attente'}
        </span>
      </div>

      {/* Hors ligne */}
      {!navigator.onLine && (
        <div className="bg-[#DC2626] px-5 py-2 text-xs font-medium flex items-center justify-between">
          <span className="text-white">📵 Hors ligne</span>
          {offlineStats && (
            <span className="text-white text-xs opacity-90">
              {offlineStats.agenda} RDV · {offlineStats.portfolio} cibles · {offlineStats.produits} produits en cache
            </span>
          )}
        </div>
      )}

      {/* Sync */}
      {pendingCount > 0 && navigator.onLine && (
        <div className="bg-[#F59E0B] px-5 py-2 text-xs font-medium flex items-center justify-between">
          <span className="text-white">⏳ {pendingCount} visite(s) en attente</span>
          <button onClick={syncPendingVisites} disabled={syncing}
            className="bg-white text-[#B45309] px-3 py-1 rounded-lg text-xs font-semibold">
            {syncing ? '...' : 'Sync'}
          </button>
        </div>
      )}

      {/* Nav tabs — icône + mini-libellé empilés : reste lisible et tactile
          aussi bien sur téléphone étroit que sur tablette large */}
      <div className="bg-white flex border-b border-[#DDE4EA]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {[
          { id: 'accueil', icon: '🏠', label: 'Accueil' },
          { id: 'agenda', icon: '📅', label: 'Agenda' },
          { id: 'portefeuille', icon: '👜', label: 'Cibles' },
          { id: 'visite', icon: '➕', label: 'Visite' },
          { id: 'historique', icon: '📋', label: 'Historique' },
          { id: 'supports', icon: '📚', label: 'Supports' },
          ...(extranetAccess ? [{ id: 'extranet', icon: '🌐', label: 'Extranet' }] : []),
        ].map(n => (
          <button key={n.id} onClick={() => { setPage(n.id); setSuccess(false) }}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              page === n.id ? 'text-[#087F5B]' : 'text-[#667085]'
            }`}>
            <span className="text-base leading-none">{n.icon}</span>
            <span className="text-[9px] font-semibold leading-none truncate max-w-full px-0.5">{n.label}</span>
            {page === n.id && <span className="w-5 h-0.5 rounded-full bg-[#087F5B] mt-0.5" />}
          </button>
        ))}
      </div>

      {/* ACCUEIL */}
      {page === 'accueil' && (
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
              <p className="text-xl font-semibold text-[#172B4D]">{visites.length}</p>
              <p className="text-xs text-[#667085] mt-1">Total</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
              <p className="text-xl font-semibold text-[#172B4D]">{todayVisites.length}</p>
              <p className="text-xs text-[#667085] mt-1">Aujourd'hui</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#DDE4EA] text-center">
              <p className="text-xl font-semibold text-[#172B4D]">{portfolio.length}</p>
              <p className="text-xs text-[#667085] mt-1">Cibles</p>
            </div>
          </div>

          {todayAgenda.length > 0 && (
            <div>
              <p className="text-xs text-[#B45309] font-semibold uppercase tracking-wide mb-2">
                Visites prévues aujourd'hui ({todayAgenda.length})
              </p>
              <div className="flex flex-col gap-2">
                {todayAgenda.map(a => (
                  <div key={a.id} className="bg-white rounded-xl p-4 border-l-2 border-[#F59E0B]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#172B4D] text-sm">
                          {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                        </p>
                        {a.establishments && <p className="text-xs text-[#667085]">🏥 {a.establishments.nom}</p>}
                        {a.planned_time && <p className="text-xs text-[#B45309] font-medium">⏰ {a.planned_time.slice(0, 5)}</p>}
                      </div>
                      <button onClick={() => startVisiteFromPlan(a)}
                        className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold">
                        Démarrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setPage('visite')}
            className="w-full bg-[#087F5B] text-white font-semibold py-4 rounded-xl text-sm">
            + Enregistrer une visite
          </button>

          {todayVisites.length > 0 && (
            <div>
              <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide mb-2">
                Visites réalisées aujourd'hui
              </p>
              <div className="flex flex-col gap-2">
                {todayVisites.map(v => (
                  <div key={v.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-[#172B4D] text-sm">{v.nom_contact || '—'}</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUT_COLORS[v.statut] || 'bg-[#EEF1F4] text-[#667085]'}`}>
                        {v.statut}
                      </span>
                    </div>
                    <p className="text-xs text-[#667085] mt-1">{v.type_lieu} · {v.produit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AGENDA */}
      {page === 'agenda' && (
        <div className="p-5 flex flex-col gap-4 pb-10">
          <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">
            {agenda.length} visite{agenda.length > 1 ? 's' : ''} planifiée{agenda.length > 1 ? 's' : ''}
          </p>
          {agenda.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-[#667085] text-sm">Aucune visite planifiée</p>
            </div>
          ) : (
            <>
              {todayAgenda.length > 0 && (
                <div>
                  <p className="text-xs text-[#B45309] font-semibold uppercase tracking-wide mb-2">Aujourd'hui</p>
                  <div className="flex flex-col gap-3">
                    {todayAgenda.map(a => (
                      <div key={a.id} className="bg-white rounded-xl p-4 border-l-2 border-[#F59E0B]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-[#172B4D] text-sm">
                              {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                            </p>
                            {a.establishments && <p className="text-xs text-[#667085]">🏥 {a.establishments.nom}</p>}
                            {a.campaigns && <p className="text-xs text-[#667085]">🎯 {a.campaigns.nom}</p>}
                            {a.planned_time && <p className="text-xs text-[#B45309] font-medium">⏰ {a.planned_time.slice(0, 5)}</p>}
                            {a.planned_duration && <p className="text-xs text-[#667085]">⏱ {a.planned_duration} min</p>}
                            {a.notes && <p className="text-xs text-[#667085] italic">{a.notes}</p>}
                          </div>
                          <button onClick={() => startVisiteFromPlan(a)}
                            className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0">
                            Démarrer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {upcomingAgenda.length > 0 && (
                <div>
                  <p className="text-xs text-[#087F5B] font-semibold uppercase tracking-wide mb-2">À venir</p>
                  <div className="flex flex-col gap-3">
                    {upcomingAgenda.map(a => (
                      <div key={a.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                        <p className="font-semibold text-[#172B4D] text-sm">
                          {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                        </p>
                        <p className="text-xs text-[#087F5B] font-medium">
                          📅 {new Date(a.planned_date).toLocaleDateString('fr-FR')}
                          {a.planned_time && ` à ${a.planned_time.slice(0, 5)}`}
                        </p>
                        {a.establishments && <p className="text-xs text-[#667085]">🏥 {a.establishments.nom}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PORTEFEUILLE */}
      {page === 'portefeuille' && (
        <div className="p-5 flex flex-col gap-3 pb-10">
          <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">
            {portfolio.length} cible{portfolio.length > 1 ? 's' : ''} dans mon portefeuille
          </p>
          {portfolio.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-3xl mb-2">👜</p>
              <p className="text-[#667085] text-sm">Aucune cible assignée</p>
              <p className="text-[#98A2B3] text-xs mt-1">Votre manager configurera votre portefeuille</p>
            </div>
          ) : (
            portfolio.map(p => {
              const pro = p.commercial_targets?.healthcare_professionals
              if (!pro) return null
              return (
                <div key={p.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${POTENTIAL_COLORS[p.priority]}`}>
                      {p.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#172B4D] text-sm">{pro.prenom} {pro.nom}</p>
                      {pro.specialite && <p className="text-xs text-[#667085]">{pro.specialite}</p>}
                      {pro.establishments && <p className="text-xs text-[#667085]">🏥 {pro.establishments.nom}</p>}
                      {p.campaigns && <p className="text-xs text-[#667085]">🎯 {p.campaigns.nom}</p>}
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-medium px-2 py-0.5 rounded-full">
                          {p.visit_frequency}x/mois
                        </span>
                        <span className="text-xs bg-[#EEF1F4] text-[#667085] font-medium px-2 py-0.5 rounded-full">
                          {p.visits_done || 0} visite{(p.visits_done || 0) > 1 ? 's' : ''} réalisée{(p.visits_done || 0) > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => {
                      setForm(f => ({
                        ...f,
                        healthcare_professional_id: pro.id,
                        nom_contact: `${pro.prenom} ${pro.nom}`,
                        campaign_id: p.campaign_id || ''
                      }))
                      setPage('visite')
                    }} className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0">
                      Visiter
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* NOUVELLE VISITE */}
      {page === 'visite' && (
        <div className="p-5 flex flex-col gap-4 pb-10">
          {success && (
            <div className="bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
              <p className="text-[#087F5B] font-semibold">✅ Visite enregistrée !</p>
            </div>
          )}

          {form.visit_plan_id && (
            <div className="bg-[#E8F0FE] border border-[#2563EB]/20 rounded-xl p-3">
              <p className="text-xs text-[#2563EB] font-medium">📅 Visite liée à votre agenda</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type de visite</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
              <option value="immediate">Visite immédiate</option>
              <option value="planifiee">Planifier pour plus tard</option>
            </select>
          </div>

          {form.type === 'planifiee' && (
            <div>
              <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Date et heure prévue</label>
              <input type="datetime-local" value={form.date_prevue} onChange={e => set('date_prevue', e.target.value)}
                className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type de lieu *</label>
            <select value={form.type_lieu} onChange={e => set('type_lieu', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
              <option value="">Sélectionner le lieu</option>
              {TYPES_LIEU.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom du contact *</label>
            <input value={form.nom_contact} onChange={e => set('nom_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
              placeholder="Nom et prénom" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Titre / Fonction</label>
            <select value={form.titre_contact} onChange={e => set('titre_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
              <option value="">Sélectionner</option>
              {TITRES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
            <input type="tel" value={form.telephone_contact} onChange={e => set('telephone_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
              placeholder="00223XXXXXXXX" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Produits présentés *</label>
            <div className="mt-2 flex flex-col gap-2">
              <select onChange={e => { if (e.target.value) toggleProduit(e.target.value) }}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" value="">
                <option value="">Sélectionner un produit...</option>
                {produits.filter(p => !form.produits_ids.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
              {form.produits_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.produits_ids.map(id => {
                    const p = produits.find(x => x.id === id)
                    return p ? (
                      <div key={id} className="flex items-center gap-1 bg-[#087F5B] text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                        <span>{p.nom}</span>
                        <button onClick={() => toggleProduit(id)} className="ml-1 font-semibold">✕</button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>

          {form.type === 'immediate' && (
            <div>
              <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Statut</label>
              <select value={form.statut} onChange={e => set('statut', e.target.value)}
                className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option>Réalisée</option>
                <option>Non aboutie</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Note / Compte-rendu</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-24 resize-none"
              placeholder="Observations, prochaines étapes..." />
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Photo de la visite</label>
            <input ref={photoRef} type="file" accept="image/*" capture="environment"
              onChange={e => {
                const file = e.target.files[0]
                if (file) {
                  photoFileRef.current = file
                  set('photoPreview', URL.createObjectURL(file))
                }
              }}
              className="hidden" />
            {form.photoPreview ? (
              <div className="mt-2 relative">
                <img src={form.photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                <button onClick={() => { photoFileRef.current = null; set('photoPreview', null) }}
                  className="absolute top-2 right-2 bg-[#DC2626] text-white px-2 py-1 rounded-lg text-xs font-semibold">✕</button>
              </div>
            ) : (
              <button onClick={() => photoRef.current.click()}
                className="w-full mt-1 border-2 border-dashed border-[#DDE4EA] rounded-lg p-4 text-center text-[#667085] text-sm">
                📷 Prendre une photo
              </button>
            )}
          </div>

          {/* GPS */}
          <div className={`rounded-lg p-3 flex items-center gap-2 border ${position ? 'bg-[#E7F5EF] border-[#087F5B]/20' : 'bg-[#FEF3E2] border-[#F59E0B]/30'}`}>
            <span>{position ? '📍' : '⚠️'}</span>
            <p className="text-xs font-medium text-[#667085]">
              {position ? `GPS actif · ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'GPS non disponible'}
            </p>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#087F5B] text-white font-semibold py-4 rounded-xl text-sm">
            {saving ? 'Enregistrement...' : 'Enregistrer la visite'}
          </button>
        </div>
      )}

      {/* HISTORIQUE */}
      {page === 'historique' && (
        <div className="p-5 flex flex-col gap-3 pb-10">
          <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">{visites.length} visites au total</p>
          {visites.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-[#667085] text-sm">Aucune visite enregistrée</p>
            </div>
          ) : (
            visites.map(v => (
              <div key={v.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-[#172B4D] text-sm">{v.nom_contact || '—'}</p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUT_COLORS[v.statut] || 'bg-[#EEF1F4] text-[#667085]'}`}>
                    {v.statut}
                  </span>
                </div>
                {v.titre_contact && <p className="text-xs text-[#667085]">{v.titre_contact}</p>}
                {v.type_lieu && <p className="text-xs text-[#667085]">{v.type_lieu}</p>}
                {v.produit && <p className="text-xs text-[#087F5B] font-medium mt-1">💊 {v.produit}</p>}
                {v.photo_url && (
                  <img src={v.photo_url} alt="Photo" className="w-full h-32 object-cover rounded-lg mt-2 cursor-pointer"
                    onClick={() => window.open(v.photo_url, '_blank')} />
                )}
                {v.note && <p className="text-xs text-[#667085] italic mt-1">{v.note}</p>}
                {v.confidence_score !== null && v.confidence_score !== undefined && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${CONFIDENCE_COLORS[v.confidence_status] || 'bg-[#EEF1F4] text-[#667085]'}`}>
                    {v.confidence_score}pts
                  </span>
                )}
                <p className="text-xs text-[#98A2B3] mt-2">{v.created_at?.slice(0, 10)}</p>
                <button onClick={() => setSelectedVisite(v)}
                  className="w-full mt-2 bg-[#172B4D] text-white font-semibold py-2 rounded-lg text-xs">
                  📝 Compte rendu
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUPPORTS */}
      {page === 'supports' && (
        <div className="p-5 flex flex-col gap-3 pb-10">
          <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">
            {supports.length} support{supports.length > 1 ? 's' : ''} disponible{supports.length > 1 ? 's' : ''}
          </p>
          {supports.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
              <p className="text-3xl mb-2">📚</p>
              <p className="text-[#667085] text-sm">Aucun support disponible</p>
            </div>
          ) : (
            supports.map(s => (
              <div key={s.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex items-start gap-3">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${TYPE_COLORS_SUPPORT[s.type]}`}>
                    {TYPE_ICONS[s.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#172B4D] text-sm truncate">{s.nom}</p>
                    {s.laboratoires && <p className="text-xs text-[#667085]">🧪 {s.laboratoires.nom}</p>}
                    {s.produits && <p className="text-xs text-[#667085]">💊 {s.produits.nom}</p>}
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-[#98A2B3]">v{s.version}</span>
                      {s.is_offline && (
                        <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-medium px-2 py-0.5 rounded-full">
                          📵 Offline
                        </span>
                      )}
                    </div>
                  </div>
                  <a href={s.file_url} target="_blank" rel="noreferrer"
                    className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0">
                    Ouvrir
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
