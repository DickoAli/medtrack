import ProfilDelegue from './ProfilDelegue'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { saveVisiteLocally, getPendingVisites, deleteLocalVisite, countPendingVisites, isOnline } from '../offline'
import Extranet from './Extranet'

export default function DelegueApp({ session, profile }) {
  const [supports, setSupports] = useState([])
  const [visites, setVisites] = useState([])
  const [produits, setProduits] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [agenda, setAgenda] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('accueil')
  const [position, setPosition] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const watchRef = useRef(null)
  const photoRef = useRef(null)

  const [form, setForm] = useState({
    medecin_id: '', produits_ids: [], type_lieu: '',
    nom_contact: '', titre_contact: '', telephone_contact: '',
    statut: 'Réalisée', note: '', type: 'immediate',
    date_prevue: '', photo: null, photoPreview: null,
    visit_plan_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showProfil, setShowProfil] = useState(false)

  const fetchData = async () => {
    const { data: s } = await supabase
  .from('content_assets')
  .select('*, produits(nom), campaigns(nom), laboratoires(nom)')
  .eq('agence_id', profile.agence_id)
  .eq('is_published', true)
  .order('created_at', { ascending: false })
setSupports(s || [])
    const [{ data: v }, { data: p }, { data: po }, { data: ag }] = await Promise.all([
      supabase.from('visites').select('*').eq('delegate_id', profile.delegate_id).order('created_at', { ascending: false }),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('statut_produit', 'Normal').order('nom'),
      supabase.from('delegate_portfolios')
        .select('*, healthcare_professionals(id, nom, prenom, potential, specialite, establishments(nom)), campaigns(nom)')
        .eq('delegate_id', profile.delegate_id)
        .eq('is_active', true),
      supabase.from('visit_plans')
        .select('*, healthcare_professionals(nom, prenom, potential), establishments(nom), campaigns(nom)')
        .eq('delegate_id', profile.delegate_id)
        .in('statut', ['pending', 'confirmed'])
        .order('planned_date', { ascending: true })
    ])
    setVisites(v || [])
    setProduits(p || [])
    setPortfolio(po || [])
    setAgenda(ag || [])
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
      if (saved) {
  await supabase.rpc('calculate_confidence_score', { visit_id: saved.id })
}
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

  const handleSave = async () => {
    if (!form.type_lieu) { alert('Sélectionnez le type de lieu'); return }
    if (!form.nom_contact) { alert('Le nom du contact est obligatoire'); return }
    if (form.produits_ids.length === 0) { alert('Sélectionnez au moins un produit'); return }
    if (form.type === 'planifiee' && !form.date_prevue) { alert('Choisissez une date'); return }

    setSaving(true)

    let photo_url = null
    if (form.photo && isOnline()) {
      const fileName = `${profile.delegate_id}/${Date.now()}_${form.photo.name}`
      const { error: uploadError } = await supabase.storage.from('PHOTOS').upload(fileName, form.photo)
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
  await supabase.rpc('calculate_confidence_score', { visit_id: saved.id })
  // Log audit
  await supabase.from('audit_logs').insert({
    agence_id: profile.agence_id,
    user_id: profile.id,
    action: 'visit_created',
    table_name: 'visites',
    record_id: saved.id,
    new_values: { delegate_id: saved.delegate_id, statut: saved.statut, nom_contact: saved.nom_contact }
  })
}

    if (saved && form.produits_ids.length > 0) {
      await supabase.from('visite_produits').insert(
        form.produits_ids.map(pid => ({ visite_id: saved.id, produit_id: pid, agence_id: profile.agence_id }))
      )
    }

    // Mettre à jour le plan de visite si lié
    if (form.visit_plan_id) {
      await supabase.from('visit_plans').update({ statut: 'done' }).eq('id', form.visit_plan_id)
    }

    setSaving(false)
    setSuccess(true)
    resetForm()
    await fetchData()
    setTimeout(() => { setPage('accueil'); setSuccess(false) }, 1500)
  }

  const resetForm = () => setForm({
    medecin_id: '', produits_ids: [], type_lieu: '',
    nom_contact: '', titre_contact: '', telephone_contact: '',
    statut: 'Réalisée', note: '', type: 'immediate',
    date_prevue: '', photo: null, photoPreview: null,
    visit_plan_id: '', healthcare_professional_id: '',
    establishment_id: '', campaign_id: ''
  })

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
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement...</p>
    </div>
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter(v => v.created_at?.slice(0, 10) === todayStr)
  const todayAgenda = agenda.filter(a => a.planned_date === todayStr)
  const upcomingAgenda = agenda.filter(a => a.planned_date > todayStr).slice(0, 5)

  const TYPES_LIEU = ['CSRef', 'CSCom', 'Clinique', 'Cabinet de santé', 'Hôpital', 'Pharmacie', 'Autre']
  const TITRES = ['Médecin généraliste', 'Spécialiste', 'Pharmacien', 'Infirmier', 'Directeur', 'Autre']
  const POTENTIAL_COLORS = {
    A: 'bg-rose-100 text-rose-600',
    B: 'bg-amber-100 text-amber-600',
    C: 'bg-slate-100 text-slate-500'
  }
if (showProfil) return (
  <ProfilDelegue profile={profile} onBack={() => setShowProfil(false)} />
)
  if (page === 'extranet') return <Extranet profile={profile} onBack={() => setPage('accueil')} />

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {profile.delegates?.prenom} {profile.delegates?.nom}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${position ? 'bg-teal-400' : 'bg-red-400'}`} />
          <button onClick={() => supabase.auth.signOut()}
            className="bg-red-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs">
            Quitter
          </button>
        </div>
      </div>

      {/* GPS */}
      <div className={`px-6 py-2 text-xs font-bold flex items-center gap-2 ${position ? 'bg-teal-500' : 'bg-amber-500'}`}>
        <span>{position ? '📍' : '⚠️'}</span>
        <span className="text-white">
          {position ? `GPS actif · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'GPS en attente'}
        </span>
      </div>

      {!navigator.onLine && (
        <div className="bg-rose-500 px-6 py-2 text-xs font-bold flex items-center gap-2">
          <span>📵</span><span className="text-white">Hors ligne — visites sauvegardées localement</span>
        </div>
      )}

      {pendingCount > 0 && navigator.onLine && (
        <div className="bg-amber-500 px-6 py-2 text-xs font-bold flex items-center justify-between">
          <span className="text-white">⏳ {pendingCount} visite(s) en attente</span>
          <button onClick={syncPendingVisites} disabled={syncing}
            className="bg-white text-amber-600 px-3 py-1 rounded-lg text-xs font-black">
            {syncing ? '...' : 'Sync'}
          </button>
        </div>
      )}

      {/* Nav */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'supports', label: '📚' },
          { id: 'accueil', label: '🏠' },
          { id: 'agenda', label: '📅 Agenda' },
          { id: 'portefeuille', label: '👜 Cibles' },
          { id: 'visite', label: '+ Visite' },
          { id: 'historique', label: '📋' },
          { id: 'extranet', label: '🌐' },
        ].map(n => (
          <button key={n.id} onClick={() => { setPage(n.id); setSuccess(false) }}
            className={`flex-1 py-3 text-xs font-black transition-colors ${page === n.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'}`}>
            {n.label}
          </button>
        ))}
      </div>

      {/* ACCUEIL */}
      {page === 'accueil' && (
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400 text-center">
              <p className="text-2xl font-black text-blue-950">{visites.length}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">Total</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400 text-center">
              <p className="text-2xl font-black text-blue-950">{todayVisites.length}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">Aujourd'hui</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400 text-center">
              <p className="text-2xl font-black text-blue-950">{portfolio.length}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">Cibles</p>
            </div>
          </div>

          {/* Agenda aujourd'hui */}
          {todayAgenda.length > 0 && (
            <div>
              <p className="text-xs text-amber-500 font-black uppercase tracking-wider mb-2">
                📅 Visites prévues aujourd'hui ({todayAgenda.length})
              </p>
              <div className="flex flex-col gap-2">
                {todayAgenda.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-blue-950 text-sm">
                          {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                        </p>
                        {a.establishments && <p className="text-xs text-slate-400">🏥 {a.establishments.nom}</p>}
                        {a.planned_time && <p className="text-xs text-amber-500 font-bold">⏰ {a.planned_time.slice(0, 5)}</p>}
                      </div>
                      <button onClick={() => startVisiteFromPlan(a)}
                        className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black">
                        Démarrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setPage('visite')}
            className="w-full bg-teal-400 text-blue-950 font-black py-5 rounded-2xl text-base">
            + Enregistrer une visite
          </button>

          {/* Visites du jour */}
          {todayVisites.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
                Visites réalisées aujourd'hui
              </p>
              <div className="flex flex-col gap-2">
                {todayVisites.map(v => (
                  <div key={v.id} className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-blue-950 text-sm">{v.nom_contact || '—'}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                        {v.statut}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{v.type_lieu} · {v.produit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AGENDA */}
      {page === 'agenda' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
            {agenda.length} visite{agenda.length > 1 ? 's' : ''} planifiée{agenda.length > 1 ? 's' : ''}
          </p>

          {agenda.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-slate-400 text-sm">Aucune visite planifiée</p>
            </div>
          ) : (
            <>
              {todayAgenda.length > 0 && (
                <div>
                  <p className="text-xs text-amber-500 font-black uppercase tracking-wider mb-2">Aujourd'hui</p>
                  <div className="flex flex-col gap-3">
                    {todayAgenda.map(a => (
                      <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-black text-blue-950 text-sm">
                              {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                            </p>
                            {a.establishments && <p className="text-xs text-slate-400">🏥 {a.establishments.nom}</p>}
                            {a.campaigns && <p className="text-xs text-slate-400">🎯 {a.campaigns.nom}</p>}
                            {a.planned_time && <p className="text-xs text-amber-500 font-bold">⏰ {a.planned_time.slice(0, 5)}</p>}
                            {a.planned_duration && <p className="text-xs text-slate-400">⏱ {a.planned_duration} min</p>}
                            {a.notes && <p className="text-xs text-slate-400 italic">{a.notes}</p>}
                          </div>
                          <button onClick={() => startVisiteFromPlan(a)}
                            className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black flex-shrink-0">
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
                  <p className="text-xs text-teal-500 font-black uppercase tracking-wider mb-2">À venir</p>
                  <div className="flex flex-col gap-3">
                    {upcomingAgenda.map(a => (
                      <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                        <p className="font-black text-blue-950 text-sm">
                          {a.healthcare_professionals?.prenom} {a.healthcare_professionals?.nom}
                        </p>
                        <p className="text-xs text-teal-500 font-bold">
                          📅 {new Date(a.planned_date).toLocaleDateString('fr-FR')}
                          {a.planned_time && ` à ${a.planned_time.slice(0, 5)}`}
                        </p>
                        {a.establishments && <p className="text-xs text-slate-400">🏥 {a.establishments.nom}</p>}
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
        <div className="p-6 flex flex-col gap-3 pb-10">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
            {portfolio.length} cible{portfolio.length > 1 ? 's' : ''} dans mon portefeuille
          </p>

          {portfolio.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">👜</p>
              <p className="text-slate-400 text-sm">Aucune cible assignée</p>
              <p className="text-slate-300 text-xs mt-1">Votre manager configurera votre portefeuille</p>
            </div>
          ) : (
            portfolio.map(p => {
              const pro = p.healthcare_professionals
              return (
                <div key={p.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                  pro.potential === 'A' ? 'border-rose-400' :
                  pro.potential === 'B' ? 'border-amber-400' : 'border-slate-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-black px-2 py-1 rounded-full flex-shrink-0 ${POTENTIAL_COLORS[pro.potential]}`}>
                      {pro.potential}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-blue-950 text-sm">{pro.prenom} {pro.nom}</p>
                      {pro.specialite && <p className="text-xs text-slate-500">{pro.specialite}</p>}
                      {pro.establishments && <p className="text-xs text-slate-400">🏥 {pro.establishments.nom}</p>}
                      {p.campaigns && <p className="text-xs text-slate-400">🎯 {p.campaigns.nom}</p>}
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                          {p.visit_frequency}x/mois
                        </span>
                        <span className="text-xs bg-slate-50 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                          {p.visits_done} visite{p.visits_done > 1 ? 's' : ''} réalisée{p.visits_done > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          healthcare_professional_id: pro.id,
                          nom_contact: `${pro.prenom} ${pro.nom}`,
                          campaign_id: p.campaign_id || ''
                        }))
                        setPage('visite')
                      }}
                      className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black flex-shrink-0">
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
        <div className="p-6 flex flex-col gap-4 pb-10">
          {success && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
              <p className="text-teal-600 font-black">✅ Visite enregistrée !</p>
            </div>
          )}

          {form.visit_plan_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
              <p className="text-xs text-blue-700 font-bold">📅 Visite liée à votre agenda</p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de visite</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="immediate">Visite immédiate</option>
              <option value="planifiee">Planifier pour plus tard</option>
            </select>
          </div>

          {form.type === 'planifiee' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date et heure prévue</label>
              <input type="datetime-local" value={form.date_prevue} onChange={e => set('date_prevue', e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm" />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de lieu *</label>
            <select value={form.type_lieu} onChange={e => set('type_lieu', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="">Sélectionner le lieu</option>
              {TYPES_LIEU.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du contact *</label>
            <input value={form.nom_contact} onChange={e => set('nom_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              placeholder="Nom et prénom" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Titre / Fonction</label>
            <select value={form.titre_contact} onChange={e => set('titre_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="">Sélectionner</option>
              {TITRES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
            <input type="tel" value={form.telephone_contact} onChange={e => set('telephone_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              placeholder="00223XXXXXXXX" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produits présentés *</label>
            <div className="mt-2 flex flex-col gap-2">
              <select onChange={e => { if (e.target.value) toggleProduit(e.target.value) }}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm" value="">
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
                      <div key={id} className="flex items-center gap-1 bg-teal-400 text-blue-950 px-3 py-1.5 rounded-xl text-xs font-bold">
                        <span>{p.nom}</span>
                        <button onClick={() => toggleProduit(id)} className="ml-1 font-black">✕</button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          </div>

          {form.type === 'immediate' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
              <select value={form.statut} onChange={e => set('statut', e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
                <option>Réalisée</option>
                <option>Non aboutie</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note / Compte-rendu</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-24 resize-none"
              placeholder="Observations, prochaines étapes..." />
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Photo de la visite</label>
            <input ref={photoRef} type="file" accept="image/*" capture="environment"
              onChange={e => {
                const file = e.target.files[0]
                if (file) { set('photo', file); set('photoPreview', URL.createObjectURL(file)) }
              }}
              className="hidden" />
            {form.photoPreview ? (
              <div className="mt-2 relative">
                <img src={form.photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                <button onClick={() => { set('photo', null); set('photoPreview', null) }}
                  className="absolute top-2 right-2 bg-rose-500 text-white px-2 py-1 rounded-lg text-xs font-black">✕</button>
              </div>
            ) : (
              <button onClick={() => photoRef.current.click()}
                className="w-full mt-1 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-sm">
                📷 Prendre une photo
              </button>
            )}
          </div>

          {/* GPS */}
          <div className={`rounded-xl p-3 flex items-center gap-2 ${position ? 'bg-teal-50 border border-teal-200' : 'bg-amber-50 border border-amber-200'}`}>
            <span>{position ? '📍' : '⚠️'}</span>
            <p className="text-xs font-bold text-slate-600">
              {position ? `GPS actif · ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'GPS non disponible'}
            </p>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm">
            {saving ? 'Enregistrement...' : 'Enregistrer la visite'}
          </button>
        </div>
      )}

      {/* HISTORIQUE */}
      {page === 'historique' && (
        <div className="p-6 flex flex-col gap-3 pb-10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{visites.length} visites au total</p>
          {visites.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-slate-400 text-sm">Aucune visite enregistrée</p>
            </div>
          ) : (
            visites.map(v => (
              <div key={v.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                v.statut === 'Réalisée' ? 'border-teal-400' :
                v.statut === 'Planifiée' ? 'border-amber-400' : 'border-rose-400'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-blue-950 text-sm">{v.nom_contact || '—'}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' :
                    v.statut === 'Planifiée' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-500'
                  }`}>{v.statut}</span>
                </div>
                {v.titre_contact && <p className="text-xs text-slate-400">{v.titre_contact}</p>}
                {v.type_lieu && <p className="text-xs text-slate-400">{v.type_lieu}</p>}
                {v.produit && <p className="text-xs text-teal-600 font-bold mt-1">💊 {v.produit}</p>}
                {v.photo_url && (
                  <img src={v.photo_url} alt="Photo" className="w-full h-32 object-cover rounded-xl mt-2 cursor-pointer"
                    onClick={() => window.open(v.photo_url, '_blank')} />
                )}
                {v.note && <p className="text-xs text-slate-500 italic mt-1">{v.note}</p>}
                <p className="text-xs text-slate-300 mt-2">{v.created_at?.slice(0, 10)}</p>
              </div>
            ))
          )}
        </div>
      )}
      {page === 'supports' && (
  <div className="p-6 flex flex-col gap-3 pb-10">
    <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
      {supports.length} support{supports.length > 1 ? 's' : ''} disponible{supports.length > 1 ? 's' : ''}
    </p>

    {supports.length === 0 ? (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-4xl mb-3">📚</p>
        <p className="text-slate-400 text-sm">Aucun support disponible</p>
      </div>
    ) : (
      supports.map(s => {
        const TYPE_ICONS = {
          pdf: '📄', image: '🖼️', video: '🎥',
          presentation: '📊', document: '📝'
        }
        const TYPE_COLORS = {
          pdf: 'bg-red-100 text-red-600',
          image: 'bg-blue-100 text-blue-600',
          video: 'bg-purple-100 text-purple-600',
          presentation: 'bg-amber-100 text-amber-600',
          document: 'bg-slate-100 text-slate-500'
        }
        return (
          <div key={s.id} className="bg-white rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${TYPE_COLORS[s.type]}`}>
                {TYPE_ICONS[s.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-blue-950 text-sm truncate">{s.nom}</p>
                {s.laboratoires && <p className="text-xs text-slate-400">🧪 {s.laboratoires.nom}</p>}
                {s.produits && <p className="text-xs text-slate-400">💊 {s.produits.nom}</p>}
                {s.campaigns && <p className="text-xs text-slate-400">🎯 {s.campaigns.nom}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-slate-400">v{s.version}</span>
                  {s.is_offline && (
                    <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                      📵 Offline
                    </span>
                  )}
                </div>
              </div>
              <a href={s.file_url} target="_blank" rel="noreferrer"
                className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black flex-shrink-0">
                Ouvrir
              </a>
            </div>
          </div>
        )
      })
    )}
  </div>
)}
    </div>
  )
}