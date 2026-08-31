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
    nom: '',
    laboratoire_id: '',
    description: '',
    therapeutic_area: '',
    is_active: true
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
      supabase.from('brands')
        .select('*, laboratoires(nom)')
        .eq('agence_id', profile.agence_id)
        .order('nom'),
      supabase.from('laboratoires')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .order('nom')
    ])
    setMarques(m || [])
    setLaboratoires(l || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', laboratoire_id: '', description: '',
    therapeutic_area: '', is_active: true
  })

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.laboratoire_id) { alert('Sélectionnez un laboratoire'); return }
    setSaving(true)

    if (editing) {
      await supabase.from('brands').update({
        nom: form.nom,
        laboratoire_id: form.laboratoire_id,
        description: form.description || null,
        therapeutic_area: form.therapeutic_area || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', editing)
    } else {
      await supabase.from('brands').insert({
        nom: form.nom,
        laboratoire_id: form.laboratoire_id,
        description: form.description || null,
        therapeutic_area: form.therapeutic_area || null,
        is_active: form.is_active,
        agence_id: profile.agence_id
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
      nom: m.nom,
      laboratoire_id: m.laboratoire_id,
      description: m.description || '',
      therapeutic_area: m.therapeutic_area || '',
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

  const filtered = marques.filter(m =>
    filterLabo === 'tous' || m.laboratoire_id === filterLabo
  )

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Marques</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {marques.length} marque{marques.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Ajouter
        </button>
      </div>

      <div className="px-6 pt-4">
        <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les laboratoires</option>
          {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier la marque' : 'Nouvelle marque'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom de la marque *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Doliprane, Plavix, Lantus..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aire thérapeutique</label>
                <select value={form.therapeutic_area} onChange={e => set('therapeutic_area', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {THERAPEUTIC_AREAS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Description de la marque..." />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => set('is_active', e.target.checked)}
                  className="w-4 h-4 accent-teal-400" />
                <span className="text-xs font-bold text-slate-600">Marque active</span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col gap-3 pb-10">
        {/* Stats par laboratoire */}
        {laboratoires.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{marques.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total marques</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{marques.filter(m => m.is_active).length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Actives</p>
            </div>
          </div>
        )}

        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          {filtered.length} marque{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-slate-400 text-sm font-bold">Aucune marque créée</p>
            <p className="text-slate-300 text-xs mt-1">
              Les marques organisent vos produits entre laboratoire et catalogue
            </p>
          </div>
        ) : (
          filtered.map(m => (
            <div key={m.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              m.is_active ? 'border-teal-400' : 'border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-black text-blue-950">{m.nom}</p>
                    {!m.is_active && (
                      <span className="text-xs bg-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">🧪 {m.laboratoires?.nom}</p>
                  {m.therapeutic_area && (
                    <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
                      {m.therapeutic_area}
                    </span>
                  )}
                  {m.description && (
                    <p className="text-xs text-slate-400 mt-1">{m.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      m.is_active ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-600'
                    }`}>
                    {m.is_active ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => handleEdit(m)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(m.id)}
                    className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">
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