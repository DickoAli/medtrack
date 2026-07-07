import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function DelegueApp({ session, profile }) {
  const [visites, setVisites] = useState([])
  const [medecins, setMedecins] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('accueil')
  const [position, setPosition] = useState(null)
  const watchRef = useRef(null)

  const [form, setForm] = useState({
    medecin_id: '',
    produit: '',
    statut: 'Réalisée',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchData()
    startTracking()
    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  const fetchData = async () => {
    const { data: v } = await supabase
      .from('visites')
      .select('*, medecins(*)')
      .eq('delegate_id', profile.delegate_id)
      .order('created_at', { ascending: false })

    const { data: m } = await supabase.from('medecins').select('*')

    setVisites(v || [])
    setMedecins(m || [])
    setLoading(false)
  }

  const startTracking = () => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { lat, lng } = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition({ lat, lng })
        // Mettre à jour la position dans Supabase
        await supabase
          .from('profiles')
          .update({ last_lat: lat, last_lng: lng, last_seen: new Date().toISOString() })
          .eq('id', session.user.id)
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    )
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.medecin_id || !form.produit) {
      alert('Remplissez tous les champs obligatoires')
      return
    }
    setSaving(true)
    await supabase.from('visites').insert({
      delegate_id: profile.delegate_id,
      medecin_id: form.medecin_id,
      produit: form.produit,
      statut: form.statut,
      note: form.note,
      latitude: position?.lat || null,
      longitude: position?.lng || null,
    })
    setSaving(false)
    setSuccess(true)
    setForm({ medecin_id: '', produit: '', statut: 'Réalisée', note: '' })
    fetchData()
  }

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement...</p>
    </div>
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisites = visites.filter((v) => v.created_at?.slice(0, 10) === todayStr)

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

      {/* Nav */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'accueil', label: '🏠 Accueil' },
          { id: 'visite', label: '+ Visite' },
          { id: 'historique', label: '📋 Historique' },
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

          {/* Visites du jour */}
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
                      <p className="font-bold text-blue-950 text-sm">Dr. {v.medecins?.nom}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                        {v.statut}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{v.produit}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nouvelle visite */}
      {page === 'visite' && (
        <div className="p-6 flex flex-col gap-4">
          {success && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
              <p className="text-teal-600 font-black">✅ Visite enregistrée !</p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Médecin visité *</label>
            <select
              value={form.medecin_id}
              onChange={(e) => set('medecin_id', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">Sélectionner un médecin</option>
              {medecins.map((m) => (
                <option key={m.id} value={m.id}>Dr. {m.nom} — {m.specialite}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produit présenté *</label>
            <select
              value={form.produit}
              onChange={(e) => set('produit', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">Sélectionner un produit</option>
              <option>CardioPlus</option>
              <option>DiabetoReg</option>
              <option>OncoPrime</option>
              <option>NeuroFlex</option>
              <option>ImmunoBoost</option>
            </select>
          </div>

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

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note</label>
            <textarea
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm h-24 resize-none"
              placeholder="Observations, compte-rendu..."
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
        <div className="p-6 flex flex-col gap-3">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{visites.length} visites au total</p>
          {visites.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-blue-950 text-sm">Dr. {v.medecins?.nom}</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                  {v.statut}
                </span>
              </div>
              <p className="text-xs text-slate-400">{v.produit} · {v.created_at?.slice(0, 10)}</p>
              {v.note && <p className="text-xs text-slate-500 italic mt-1">{v.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}