import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionProduits({ onBack }) {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nom: '', description: '', categorie: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProduits()
  }, [])

  const fetchProduits = async () => {
    const { data } = await supabase
      .from('produits')
      .select('*')
      .order('created_at', { ascending: false })
    setProduits(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    setSaving(true)
   const categorieFinale = form.categorie === 'Autre (à préciser)' ? form.categorie_autre : form.categorie

if (editing) {
  await supabase.from('produits').update({
    nom: form.nom,
    description: form.description,
    categorie: categorieFinale
  }).eq('id', editing)
} else {
  await supabase.from('produits').insert({
    nom: form.nom,
    description: form.description,
    categorie: categorieFinale
  })
}
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', description: '', categorie: '' })
    fetchProduits()
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({ nom: p.nom, description: p.description || '', categorie: p.categorie || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').delete().eq('id', id)
    fetchProduits()
  }

  const CATEGORIES = ['Cardiologie', 'Diabétologie', 'Oncologie', 'Neurologie', 'Immunologie', 'Autre (à préciser)']

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
          <h1 className="text-white font-black">Produits du labo</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ nom: '', description: '', categorie: '' }) }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier le produit' : 'Nouveau produit'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du produit *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: CardioPlus"
                />
              </div>
              <div>
  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catégorie</label>
  <select
    value={form.categorie}
    onChange={(e) => set('categorie', e.target.value)}
    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
  >
    <option value="">Sélectionner</option>
    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
  </select>
</div>

{form.categorie === 'Autre (à préciser)' && (
  <div>
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Préciser la catégorie</label>
    <input
      value={form.categorie_autre || ''}
      onChange={(e) => set('categorie_autre', e.target.value)}
      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
      placeholder="Nom de la catégorie..."
    />
  </div>
)}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-20 resize-none"
                  placeholder="Description du produit..."
                />
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
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste produits */}
      <div className="p-6 flex flex-col gap-3">
        {produits.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucun produit enregistré</p>
            <p className="text-slate-300 text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer</p>
          </div>
        ) : (
          produits.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-blue-950">{p.nom}</p>
                    {p.categorie && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-600">
                        {p.categorie}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(p)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
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