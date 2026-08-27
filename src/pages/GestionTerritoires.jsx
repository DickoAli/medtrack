import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionTerritoires({ onBack, profile }) {
  const [territoires, setTerritoires] = useState([])
  const [geographies, setGeographies] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    nom: '', code: '', geography_id: '', parent_territory_id: ''
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: t } = await supabase
      .from('territories')
      .select('*, geographies(nom, type, code)')
      .eq('agence_id', profile.agence_id)
      .order('nom')

    const { data: g } = await supabase
      .from('geographies')
      .select('*')
      .order('type')
      .order('nom')

    setTerritoires(t || [])
    setGeographies(g || [])
    setRegions(g?.filter(x => x.type === 'region') || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.geography_id) { alert('Sélectionnez une zone géographique'); return }
    setSaving(true)

    if (editing) {
      await supabase.from('territories').update({
        nom: form.nom,
        code: form.code,
        geography_id: form.geography_id,
        parent_territory_id: form.parent_territory_id || null,
        updated_at: new Date().toISOString()
      }).eq('id', editing)
    } else {
      await supabase.from('territories').insert({
        nom: form.nom,
        code: form.code,
        geography_id: form.geography_id,
        parent_territory_id: form.parent_territory_id || null,
        agence_id: profile.agence_id
      })
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', code: '', geography_id: '', parent_territory_id: '' })
    setSuccessMsg('Territoire enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (t) => {
    setEditing(t.id)
    setForm({
      nom: t.nom,
      code: t.code || '',
      geography_id: t.geography_id,
      parent_territory_id: t.parent_territory_id || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce territoire ?')) return
    await supabase.from('territories').delete().eq('id', id)
    fetchAll()
  }

  const toggleActif = async (t) => {
    await supabase.from('territories')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)
    fetchAll()
  }

  const getTypeLabel = (type) => {
    const map = {
      region: 'Région', cercle: 'Cercle',
      commune: 'Commune', district: 'District',
      arrondissement: 'Arrondissement', zone: 'Zone', quartier: 'Quartier'
    }
    return map[type] || type
  }

  // Grouper les géographies par type pour le select
  const geoGrouped = geographies.reduce((acc, g) => {
    if (!acc[g.type]) acc[g.type] = []
    acc[g.type].push(g)
    return acc
  }, {})

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
            <h1 className="text-white font-black text-lg">Territoires</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              Organisation commerciale
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditing(null)
            setForm({ nom: '', code: '', geography_id: '', parent_territory_id: '' })
          }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Info banner */}
      <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-xs text-blue-700 font-bold">
          📌 Les territoires sont vos zones commerciales opérationnelles. 
          Rattachez-les aux régions, cercles ou communes du Mali selon votre organisation terrain.
        </p>
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
              {editing ? 'Modifier le territoire' : 'Nouveau territoire'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nom du territoire *
                </label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Zone Bamako Nord, Secteur Kayes..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Code (optionnel)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: BKO-N, KAY-1..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Zone géographique correspondante *
                </label>
                <select
                  value={form.geography_id}
                  onChange={(e) => set('geography_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                >
                  <option value="">Sélectionner une zone...</option>
                  {Object.entries(geoGrouped).map(([type, geos]) => (
                    <optgroup key={type} label={getTypeLabel(type)}>
                      {geos.map(g => (
                        <option key={g.id} value={g.id}>{g.nom}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Territoire parent (optionnel)
                </label>
                <select
                  value={form.parent_territory_id}
                  onChange={(e) => set('parent_territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                >
                  <option value="">Aucun (territoire racine)</option>
                  {territoires
                    .filter(t => t.id !== editing)
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.nom}</option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="p-6 flex flex-col gap-3">
        {territoires.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-slate-400 text-sm font-bold">Aucun territoire défini</p>
            <p className="text-slate-300 text-xs mt-1">
              Créez vos zones commerciales pour organiser votre équipe terrain
            </p>
          </div>
        ) : (
          territoires.map(t => (
            <div
              key={t.id}
              className={`bg-white rounded-2xl p-4 border-l-4 ${t.is_active ? 'border-teal-400' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-black text-blue-950 ${!t.is_active ? 'opacity-50' : ''}`}>
                      {t.nom}
                    </p>
                    {t.code && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {t.code}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                      {t.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {t.geographies && (
                    <p className="text-xs text-slate-400 mt-1">
                      📍 {getTypeLabel(t.geographies.type)} — {t.geographies.nom}
                    </p>
                  )}

                  {t.parent_territory_id && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      🔗 Sous-territoire de {territoires.find(x => x.id === t.parent_territory_id)?.nom}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActif(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${t.is_active ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-600'}`}
                  >
                    {t.is_active ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => handleEdit(t)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}