import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionTerritoires({ onBack, profile }) {
  const [territoires, setTerritoires] = useState([])
  const [geographies, setGeographies] = useState([])
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

  const geoGrouped = geographies.reduce((acc, g) => {
    if (!acc[g.type]) acc[g.type] = []
    acc[g.type].push(g)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Territoires</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
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
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs"
        >
          + Ajouter
        </button>
      </div>

      <div className="mx-5 mt-4 bg-[#E8F0FE] border border-[#2563EB]/20 rounded-xl p-4">
        <p className="text-xs text-[#2563EB] font-semibold">
          📌 Les territoires sont vos zones commerciales opérationnelles.
          Rattachez-les aux régions, cercles ou communes du Mali selon votre organisation terrain.
        </p>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
          <p className="text-[#087F5B] font-semibold">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier le territoire' : 'Nouveau territoire'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Nom du territoire *
                </label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Zone Bamako Nord, Secteur Kayes..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Code (optionnel)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: BKO-N, KAY-1..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Zone géographique correspondante *
                </label>
                <select
                  value={form.geography_id}
                  onChange={(e) => set('geography_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
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
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">
                  Territoire parent (optionnel)
                </label>
                <select
                  value={form.parent_territory_id}
                  onChange={(e) => set('parent_territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
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
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3">
        {territoires.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="text-[#667085] text-sm font-medium">Aucun territoire défini</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Créez vos zones commerciales pour organiser votre équipe terrain
            </p>
          </div>
        ) : (
          territoires.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-xl p-4 border border-[#DDE4EA]"
              style={{ borderLeft: `2px solid ${t.is_active ? '#087F5B' : '#DDE4EA'}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-[#172B4D] ${!t.is_active ? 'opacity-50' : ''}`}>
                      {t.nom}
                    </p>
                    {t.code && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF1F4] text-[#667085]">
                        {t.code}
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#EEF1F4] text-[#98A2B3]'}`}>
                      {t.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {t.geographies && (
                    <p className="text-xs text-[#667085] mt-1">
                      📍 {getTypeLabel(t.geographies.type)} — {t.geographies.nom}
                    </p>
                  )}

                  {t.parent_territory_id && (
                    <p className="text-xs text-[#667085] mt-0.5">
                      🔗 Sous-territoire de {territoires.find(x => x.id === t.parent_territory_id)?.nom}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActif(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${t.is_active ? 'bg-[#EEF1F4] text-[#667085]' : 'bg-[#E7F5EF] text-[#087F5B]'}`}
                  >
                    {t.is_active ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => handleEdit(t)}
                    className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold"
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
