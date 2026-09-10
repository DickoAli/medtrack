import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionMarques({ onBack, profile }) {
  const [marques, setMarques] = useState([])
  const [laboratoires, setLaboratoires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterLabo, setFilterLabo] = useState('tous')
  const [form, setForm] = useState({
    nom: '', laboratoire_id: '', description: '', therapeutic_area: '', is_active: true
  })

  const THERAPEUTIC_AREAS = [
    'Cardiologie', 'Diabétologie', 'Oncologie', 'Neurologie',
    'Pneumologie', 'Gastroentérologie', 'Rhumatologie', 'Dermatologie',
    'Antalgique', 'Anti-infectieux', 'Gynécologie', 'Pédiatrie',
    'Ophtalmologie', 'ORL', 'Urologie', 'Autre'
  ]

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from('brands').select('*, laboratoires(nom)').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setMarques(m || [])
    setLaboratoires(l || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', laboratoire_id: '', description: '', therapeutic_area: '', is_active: true
  })

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.laboratoire_id) { alert('Sélectionnez un laboratoire'); return }
    setSaving(true)

    if (editing) {
      await supabase.from('brands').update({
        nom: form.nom, laboratoire_id: form.laboratoire_id,
        description: form.description || null, therapeutic_area: form.therapeutic_area || null,
        is_active: form.is_active, updated_at: new Date().toISOString()
      }).eq('id', editing)
    } else {
      await supabase.from('brands').insert({
        nom: form.nom, laboratoire_id: form.laboratoire_id,
        description: form.description || null, therapeutic_area: form.therapeutic_area || null,
        is_active: form.is_active, agence_id: profile.agence_id
      })
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg(editing ? 'Marque modifiée !' : 'Marque créée !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (m) => {
    setEditing(m.id)
    setForm({
      nom: m.nom, laboratoire_id: m.laboratoire_id,
      description: m.description || '', therapeutic_area: m.therapeutic_area || '',
      is_active: m.is_active
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette marque ?')) return
    await supabase.from('brands').delete().eq('id', id)
    fetchAll()
  }

  const toggleActive = async (m) => {
    await supabase.from('brands').update({ is_active: !m.is_active }).eq('id', m.id)
    fetchAll()
  }

  const filtered = marques.filter(m => filterLabo === 'tous' || m.laboratoire_id === filterLabo)

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
            <h1 className="text-white font-semibold text-base">Marques</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {marques.length} marque{marques.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Ajouter
        </button>
      </div>

      <div className="px-5 pt-4">
        <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les laboratoires</option>
          {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier la marque' : 'Nouvelle marque'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom de la marque *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Doliprane, Plavix, Lantus..." />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Aire thérapeutique</label>
                <select value={form.therapeutic_area} onChange={e => set('therapeutic_area', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {THERAPEUTIC_AREAS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Description de la marque..." />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => set('is_active', e.target.checked)}
                  className="w-4 h-4 accent-[#087F5B]" />
                <span className="text-xs font-medium text-[#667085]">Marque active</span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 pb-10">
        {laboratoires.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{marques.length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Total marques</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{marques.filter(m => m.is_active).length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Actives</p>
            </div>
          </div>
        )}

        <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">
          {filtered.length} marque{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🏷️</p>
            <p className="text-[#667085] text-sm font-medium">Aucune marque créée</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Les marques organisent vos produits entre laboratoire et catalogue
            </p>
          </div>
        ) : (
          filtered.map(m => (
            <div key={m.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${m.is_active ? '#087F5B' : '#DDE4EA'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-[#172B4D]">{m.nom}</p>
                    {!m.is_active && (
                      <span className="text-xs bg-[#EEF1F4] text-[#98A2B3] font-semibold px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#667085]">🧪 {m.laboratoires?.nom}</p>
                  {m.therapeutic_area && (
                    <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block">
                      {m.therapeutic_area}
                    </span>
                  )}
                  {m.description && (
                    <p className="text-xs text-[#667085] mt-1">{m.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${m.is_active ? 'bg-[#EEF1F4] text-[#667085]' : 'bg-[#E7F5EF] text-[#087F5B]'}`}>
                    {m.is_active ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => handleEdit(m)}
                    className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                  <button onClick={() => handleDelete(m.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
