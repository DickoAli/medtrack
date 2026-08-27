import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionEtablissements({ onBack, profile }) {
  const [etablissements, setEtablissements] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [geographies, setGeographies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('tous')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [form, setForm] = useState({
    nom: '', type: '', adresse: '', territory_id: '', geography_id: '',
    latitude: '', longitude: '', geofence_radius: 150, telephone: '', email: ''
  })

  const TYPES = ['hopital', 'clinique', 'csref', 'cscom', 'cabinet', 'pharmacie', 'autre']
  const TYPE_LABELS = {
    hopital: 'Hôpital', clinique: 'Clinique', csref: 'CSRef',
    cscom: 'CSCom', cabinet: 'Cabinet', pharmacie: 'Pharmacie', autre: 'Autre'
  }
  const TYPE_COLORS = {
    hopital: 'bg-red-100 text-red-600', clinique: 'bg-purple-100 text-purple-600',
    csref: 'bg-blue-100 text-blue-600', cscom: 'bg-teal-100 text-teal-600',
    cabinet: 'bg-amber-100 text-amber-600', pharmacie: 'bg-green-100 text-green-600',
    autre: 'bg-slate-100 text-slate-500'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: e } = await supabase
      .from('establishments')
      .select('*, territories(nom), geographies(nom, type)')
      .eq('agence_id', profile.agence_id)
      .order('nom')

    const { data: t } = await supabase
      .from('territories')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .eq('is_active', true)
      .order('nom')

    const { data: g } = await supabase
      .from('geographies')
      .select('*')
      .order('type').order('nom')

    setEtablissements(e || [])
    setTerritoires(t || [])
    setGeographies(g || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const captureGPS = () => {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6))
        set('longitude', pos.coords.longitude.toFixed(6))
        setGpsLoading(false)
      },
      () => { alert('GPS non disponible'); setGpsLoading(false) }
    )
  }

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.type) { alert('Le type est obligatoire'); return }
    if (!form.territory_id) { alert('Sélectionnez un territoire'); return }
    setSaving(true)

    const data = {
      nom: form.nom,
      type: form.type,
      adresse: form.adresse,
      territory_id: form.territory_id,
      geography_id: form.geography_id || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      geofence_radius: parseInt(form.geofence_radius) || 150,
      telephone: form.telephone,
      email: form.email,
      agence_id: profile.agence_id,
      updated_at: new Date().toISOString()
    }

    if (editing) {
      await supabase.from('establishments').update(data).eq('id', editing)
    } else {
      await supabase.from('establishments').insert(data)
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg('Établissement enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const resetForm = () => setForm({
    nom: '', type: '', adresse: '', territory_id: '', geography_id: '',
    latitude: '', longitude: '', geofence_radius: 150, telephone: '', email: ''
  })

  const handleEdit = (e) => {
    setEditing(e.id)
    setForm({
      nom: e.nom, type: e.type, adresse: e.adresse || '',
      territory_id: e.territory_id, geography_id: e.geography_id || '',
      latitude: e.latitude || '', longitude: e.longitude || '',
      geofence_radius: e.geofence_radius || 150,
      telephone: e.telephone || '', email: e.email || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet établissement ?')) return
    await supabase.from('establishments').delete().eq('id', id)
    fetchAll()
  }

  const toggleActif = async (e) => {
    await supabase.from('establishments')
      .update({ is_active: !e.is_active })
      .eq('id', e.id)
    fetchAll()
  }

  const geoGrouped = geographies.reduce((acc, g) => {
    if (!acc[g.type]) acc[g.type] = []
    acc[g.type].push(g)
    return acc
  }, {})

  const getTypeLabel = (type) => ({
    region: 'Région', cercle: 'Cercle', commune: 'Commune',
    district: 'District', arrondissement: 'Arrondissement', zone: 'Zone', quartier: 'Quartier'
  })[type] || type

  const filtered = etablissements.filter(e => {
    const matchSearch = e.nom.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'tous' || e.type === filterType
    return matchSearch && matchType
  })

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Établissements</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {etablissements.length} établissement{etablissements.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="🔍 Rechercher un établissement..."
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', ...TYPES].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                filterType === t
                  ? 'bg-blue-950 text-white border-blue-950'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {t === 'tous' ? 'Tous' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier l\'établissement' : 'Nouvel établissement'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: CSRef Commune I, Clinique Pasteur..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type *</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Territoire *</label>
                <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner un territoire...</option>
                  {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zone géographique</label>
                <select value={form.geography_id} onChange={e => set('geography_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {Object.entries(geoGrouped).map(([type, geos]) => (
                    <optgroup key={type} label={getTypeLabel(type)}>
                      {geos.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adresse</label>
                <input value={form.adresse} onChange={e => set('adresse', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Adresse complète..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="00223XXXXXXXX" />
              </div>

              {/* GPS */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Position GPS
                </label>
                <div className="flex gap-2 mt-1">
                  <input value={form.latitude} onChange={e => set('latitude', e.target.value)}
                    className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Latitude" />
                  <input value={form.longitude} onChange={e => set('longitude', e.target.value)}
                    className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Longitude" />
                </div>
                <button onClick={captureGPS} disabled={gpsLoading}
                  className="w-full mt-2 bg-blue-950 text-white font-bold py-2 rounded-xl text-xs">
                  {gpsLoading ? 'Localisation...' : '📍 Capturer ma position GPS'}
                </button>
              </div>

              {/* Geofence */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Rayon geofence (mètres)
                </label>
                <input type="number" value={form.geofence_radius}
                  onChange={e => set('geofence_radius', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  min="50" max="500" />
                <p className="text-xs text-slate-400 mt-1">
                  Zone de validation visite — défaut : 150m
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="p-6 flex flex-col gap-3">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          {filtered.length} établissement{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🏥</p>
            <p className="text-slate-400 text-sm font-bold">Aucun établissement trouvé</p>
          </div>
        ) : (
          filtered.map(e => (
            <div key={e.id} className={`bg-white rounded-2xl p-4 border-l-4 ${e.is_active ? 'border-teal-400' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className={`font-black text-blue-950 ${!e.is_active ? 'opacity-50' : ''}`}>{e.nom}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[e.type]}`}>
                      {TYPE_LABELS[e.type]}
                    </span>
                  </div>
                  {e.territories && (
                    <p className="text-xs text-slate-400">🗺️ {e.territories.nom}</p>
                  )}
                  {e.adresse && (
                    <p className="text-xs text-slate-400">📍 {e.adresse}</p>
                  )}
                  {e.telephone && (
                    <p className="text-xs text-slate-400">📞 {e.telephone}</p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {e.latitude && e.longitude && (
                      <span className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-0.5 rounded-full">
                        📡 GPS configuré
                      </span>
                    )}
                    {e.geofence_radius && (
                      <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                        ⭕ {e.geofence_radius}m
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActif(e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${e.is_active ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-600'}`}>
                    {e.is_active ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => handleEdit(e)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(e.id)}
                    className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}