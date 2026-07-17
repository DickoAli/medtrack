import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { saveVisiteLocally, getPendingVisites, deleteLocalVisite, countPendingVisites, isOnline } from '../offline'

export default function DelegueApp({ session, profile }) {
  const [visites, setVisites] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('accueil')
  const [position, setPosition] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const watchRef = useRef(null)

  const [form, setForm] = useState({
    medecin_id: '',
    produits_ids: [],
    type_lieu: '',
    nom_contact: '',
    titre_contact: '',
    telephone_contact: '',
    statut: 'Réalisée',
    note: '',
    type: 'immediate',
    date_prevue: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const fetchData = async () => {
    const { data: v } = await supabase
      .from('visites')
      .select('*, medecins(*)')
      .eq('delegate_id', profile.delegate_id)
      .order('created_at', { ascending: false })

    const { data: p } = await supabase.from('produits').select('*').order('nom')

    setVisites(v || [])
    setProduits(p || [])
    setLoading(false)
  }

  const startTracking = () => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setPosition({ lat, lng })
        await supabase
          .from('profiles')
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
            produits_ids.map(pid => ({ visite_id: data.id, produit_id: pid }))
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
    window.addEventListener('online', syncPendingVisites)

    // Intercepter le bouton retour Android
    const handleBackButton = (e) => {
      e.preventDefault()
      if (page !== 'accueil') {
        setPage('accueil')
      } else {
        if (window.confirm('Voulez-vous quitter MedTrack ?')) {
          window.history.back()
        }
      }
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBackButton)

    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      window.removeEventListener('online', syncPendingVisites)
      window.removeEventListener('popstate', handleBackButton)
    }
  }, [page])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleProduit = (id) => {
    setForm((f) => ({
      ...f,
      produits_ids: f.produits_ids.includes(id)
        ? f.produits_ids.filter((x) => x !== id)
        : [...f.produits_ids, id]
    }))
  }

  const handleSave = async () => {
    if (!form.type_lieu) { alert('Sélectionnez le type de lieu'); return }
    if (!form.nom_contact) { alert('Le nom du contact est obligatoire'); return }
    if (form.produits_ids.length === 0) { alert('Sélectionnez au moins un produit'); return }
    if (form.type === 'planifiee' && !form.date_prevue) { alert('Choisissez une date'); return }

    setSaving(true)

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
      type: form.type,
      date_prevue: form.date_prevue || null,
      produits_ids: form.produits_ids,
    }

    if (!isOnline()) {
      await saveVisiteLocally(visiteData)
      await checkPending()
      setSaving(false)
      setSuccess(true)
      setForm({
        medecin_id: '', produits_ids: [], type_lieu: '', nom_contact: '',
        titre_contact: '', telephone_contact: '', statut: 'Réalisée',
        note: '', type: 'immediate', date_prevue: ''
      })
      setTimeout(() => { setPage('accueil'); setSuccess(false) }, 1500)
      return
    }

    const { data: saved } = await supabase.from('visites').insert(visiteData).select().single()

    if (saved && form.produits_ids.length > 0) {
      await supabase.from('visite_produits').insert(
        form.produits_ids.map(pid => ({ visite_id: saved.id, produit_id: pid }))
      )
    }

    setSaving(false)
    setSuccess(true)
    setForm({
      medecin_id: '', produits_ids: [], type_lieu: '', nom_contact: '',
      titre_contact: '', telephone_contact: '', statut: 'Réalisée',
      note: '', type: 'immediate', date_prevue: ''
    })
    fetchData()
    setTimeout(() => { setPage('accueil'); setSuccess(false) }, 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement...</p>
    </div>
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter((v) => v.created_at?.slice(0, 10) === todayStr)

  const TYPES_LIEU = ['CSRef', 'CSCom', 'Clinique', 'Cabinet de santé', 'Hôpital', 'Pharmacie', 'Autre']
  const TITRES = ['Médecin généraliste', 'Spécialiste', 'Pharmacien', 'Infirmier', 'Directeur', 'Autre']

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
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-red-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs"
          >
            Quitter
          </button>
        </div>
      </div>

      {/* GPS Status */}
      <div className={`px-6 py-2 text-xs font-bold flex items-center gap-2 ${position ? 'bg-teal-500' : 'bg-amber-500'}`}>
        <span>{position ? '📍' : '⚠️'}</span>
        <span className="text-white">
          {position
            ? `Position active · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`
            : 'GPS en attente — activez la localisation'}
        </span>
      </div>

      {/* Bannière hors ligne */}
      {!navigator.onLine && (
        <div className="bg-rose-500 px-6 py-2 text-xs font-bold flex items-center gap-2">
          <span>📵</span>
          <span className="text-white">Hors ligne — visites sauvegardées localement</span>
        </div>
      )}

      {/* Bannière synchronisation */}
      {pendingCount > 0 && navigator.onLine && (
        <div className="bg-amber-500 px-6 py-2 text-xs font-bold flex items-center justify-between">
          <span className="text-white">⏳ {pendingCount} visite(s) en attente</span>
          <button
            onClick={syncPendingVisites}
            disabled={syncing}
            className="bg-white text-amber-600 px-3 py-1 rounded-lg text-xs font-black"
          >
            {syncing ? '...' : 'Sync'}
          </button>
        </div>
      )}

      {/* Nav */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'accueil', label: '🏠 Accueil' },
          { id: 'visite', label: '+ Visite' },
          { id: 'historique', label: '📋 Historique' },
          { id: 'extranet', label: '🌐 Extranet' },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => { setPage(n.id); setSuccess(false) }}
            className={`flex-1 py-3 text-xs font-black transition-colors ${page === n.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'}`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Accueil */}
      {page === 'accueil' && (
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{visites.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total visites</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{todayVisites.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Aujourd'hui</p>
            </div>
          </div>

          <button
            onClick={() => setPage('visite')}
            className="w-full bg-teal-400 text-blue-950 font-black py-5 rounded-2xl text-base"
          >
            + Enregistrer une visite
          </button>

          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Visites d'aujourd'hui</p>
            {todayVisites.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center">
                <p className="text-slate-400 text-sm">Aucune visite aujourd'hui</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {todayVisites.map((v) => (
                  <div key={v.id} className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-blue-950 text-sm">{v.nom_contact || v.medecins?.nom}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                        {v.statut}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{v.type_lieu} · {v.produit}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nouvelle visite */}
      {page === 'visite' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          {success && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
              <p className="text-teal-600 font-black">✅ Visite enregistrée !</p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de visite</label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="immediate">Visite immédiate</option>
              <option value="planifiee">Planifier pour plus tard</option>
            </select>
          </div>

          {form.type === 'planifiee' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date et heure prévue</label>
              <input
                type="datetime-local"
                value={form.date_prevue}
                onChange={(e) => set('date_prevue', e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de lieu *</label>
            <select
              value={form.type_lieu}
              onChange={(e) => set('type_lieu', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">Sélectionner le lieu</option>
              {TYPES_LIEU.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du contact *</label>
            <input
              value={form.nom_contact}
              onChange={(e) => set('nom_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              placeholder="Nom et prénom"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Titre / Fonction</label>
            <select
              value={form.titre_contact}
              onChange={(e) => set('titre_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">Sélectionner</option>
              {TITRES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone du contact</label>
            <input
              type="tel"
              value={form.telephone_contact}
              onChange={(e) => set('telephone_contact', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              placeholder="00223XXXXXXXX"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produits présentés *</label>
            {produits.length === 0 ? (
              <p className="text-xs text-slate-400 mt-2">Aucun produit disponible</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <select
                  onChange={(e) => { if (e.target.value) toggleProduit(e.target.value) }}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
                  value=""
                >
                  <option value="">Sélectionner un produit...</option>
                  {produits
                    .filter(p => !form.produits_ids.includes(p.id) && (!p.statut_produit || p.statut_produit === 'Normal'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}{p.categorie ? ` — ${p.categorie}` : ''}
                      </option>
                    ))}
                </select>
                {form.produits_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
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
            )}
          </div>

          {form.type === 'immediate' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
              <select
                value={form.statut}
                onChange={(e) => set('statut', e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option>Réalisée</option>
                <option>Non aboutie</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note / Compte-rendu</label>
            <textarea
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-24 resize-none"
              placeholder="Observations, prochaines étapes..."
            />
          </div>

          <div className={`rounded-xl p-3 flex items-center gap-2 ${position ? 'bg-teal-50 border border-teal-200' : 'bg-amber-50 border border-amber-200'}`}>
            <span>{position ? '📍' : '⚠️'}</span>
            <p className="text-xs font-bold text-slate-600">
              {position ? `GPS actif · ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'GPS non disponible'}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer la visite'}
          </button>
        </div>
      )}

      {/* Historique */}
      {page === 'historique' && (
        <div className="p-6 flex flex-col gap-3 pb-10">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{visites.length} visites au total</p>
          {visites.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-slate-400 text-sm">Aucune visite enregistrée</p>
            </div>
          ) : (
            visites.map((v) => (
              <div key={v.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                v.statut === 'Réalisée' ? 'border-teal-400' :
                v.statut === 'Planifiée' ? 'border-amber-400' :
                'border-rose-400'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-blue-950 text-sm">{v.nom_contact || v.medecins?.nom || '—'}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' :
                    v.statut === 'Planifiée' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-500'
                  }`}>
                    {v.statut}
                  </span>
                </div>
                {v.titre_contact && <p className="text-xs text-slate-400">{v.titre_contact}</p>}
                {v.type_lieu && <p className="text-xs text-slate-400">{v.type_lieu}</p>}
                {v.produit && <p className="text-xs text-teal-600 font-bold mt-1">💊 {v.produit}</p>}
                {v.telephone_contact && <p className="text-xs text-slate-400">📞 {v.telephone_contact}</p>}
                {v.statut === 'Planifiée' && v.date_prevue && (
                  <p className="text-xs text-amber-500 font-bold mt-1">
                    📅 {new Date(v.date_prevue).toLocaleString('fr-FR')}
                  </p>
                )}
                {v.note && <p className="text-xs text-slate-500 italic mt-1">{v.note}</p>}
                <p className="text-xs text-slate-300 mt-2">{v.created_at?.slice(0, 10)}</p>
              </div>
            ))
          )}
        </div>
      )}{page === 'extranet' && (
  <Extranet profile={profile} onBack={() => setPage('accueil')} />
)}
    </div>
  )
}