import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function GestionProduits({ onBack, profile }) {
  const [produits, setProduits] = useState([])
  const [labos, setLabos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const fileRef = useRef()
  const [form, setForm] = useState({
    nom: '', description: '', categorie: '', categorie_autre: '',
    statut_produit: 'Normal', laboratoire_id: ''
  })

  const CATEGORIES = ['Cardiologie', 'Diabétologie', 'Oncologie', 'Neurologie', 'Immunologie', 'Autre (à préciser)']
  const STATUTS = ['Normal', 'Éliminé de gamme', 'Arrêt de distribution']

  useEffect(() => { fetchProduits() }, [])

  const fetchProduits = async () => {
    const { data } = await supabase
      .from('produits')
      .select('*, laboratoires(*)')
      .eq('agence_id', profile.agence_id)
      .order('nom')
    const { data: l } = await supabase
      .from('laboratoires')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .order('nom')
    setProduits(data || [])
    setLabos(l || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    setSaving(true)
    const categorieFinale = form.categorie === 'Autre (à préciser)' ? form.categorie_autre : form.categorie

    if (editing) {
      await supabase.from('produits').update({
        nom: form.nom, description: form.description,
        categorie: categorieFinale, statut_produit: form.statut_produit,
        laboratoire_id: form.laboratoire_id || null
      }).eq('id', editing)
    } else {
      await supabase.from('produits').insert({
        nom: form.nom, description: form.description,
        categorie: categorieFinale, statut_produit: form.statut_produit,
        laboratoire_id: form.laboratoire_id || null,
        agence_id: profile.agence_id
      })
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', description: '', categorie: '', categorie_autre: '', statut_produit: 'Normal', laboratoire_id: '' })
    setSuccessMsg('Produit enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchProduits()
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({
      nom: p.nom, description: p.description || '',
      categorie: p.categorie || '', categorie_autre: '',
      statut_produit: p.statut_produit || 'Normal',
      laboratoire_id: p.laboratoire_id || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').delete().eq('id', id)
    fetchProduits()
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Supprimer ${selected.length} produit(s) ?`)) return
    await supabase.from('produits').delete().in('id', selected)
    setSelected([])
    fetchProduits()
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selected.length === produitsFiltres.length) {
      setSelected([])
    } else {
      setSelected(produitsFiltres.map(p => p.id))
    }
  }

  const handleCSV = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    const separator = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const nomIdx = headers.findIndex(h => h.includes('nom') || h.includes('name') || h.includes('produit'))
    const descIdx = headers.findIndex(h => h.includes('desc'))
    const catIdx = headers.findIndex(h => h.includes('cat'))

    const rows = lines.slice(1).map(line => {
      const cols = line.split(separator).map(c => c.trim().replace(/"/g, ''))
      return {
        nom: cols[nomIdx !== -1 ? nomIdx : 0] || '',
        description: descIdx !== -1 ? cols[descIdx] || '' : '',
        categorie: catIdx !== -1 ? cols[catIdx] || '' : '',
        statut_produit: 'Normal',
        agence_id: profile.agence_id
      }
    }).filter(r => r.nom)

    if (rows.length === 0) { alert('Aucun produit trouvé'); setImporting(false); return }
    const { error } = await supabase.from('produits').insert(rows)
    if (error) { alert('Erreur: ' + error.message) }
    else { setSuccessMsg(`✅ ${rows.length} produits importés !`); setTimeout(() => setSuccessMsg(''), 4000) }
    setImporting(false)
    fileRef.current.value = ''
    fetchProduits()
  }

  const getStatutStyle = (statut) => {
    if (statut === 'Éliminé de gamme') return 'bg-orange-100 text-orange-600'
    if (statut === 'Arrêt de distribution') return 'bg-rose-100 text-rose-600'
    return 'bg-teal-100 text-teal-600'
  }

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.categorie?.toLowerCase().includes(search.toLowerCase()) ||
    p.laboratoires?.nom?.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-white font-black">Produits du labo</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ nom: '', description: '', categorie: '', categorie_autre: '', statut_produit: 'Normal', laboratoire_id: '' }) }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Import CSV */}
      <div className="mx-6 mt-4 bg-white rounded-2xl p-4">
        <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-2">📥 Importer depuis Excel / CSV</p>
        <p className="text-xs text-slate-400 mb-3">Colonnes : <strong>nom</strong>, <strong>description</strong>, <strong>categorie</strong></p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />
        <button
          onClick={() => fileRef.current.click()}
          disabled={importing}
          className="w-full bg-blue-950 text-white font-black py-3 rounded-xl text-sm"
        >
          {importing ? 'Import en cours...' : '📂 Choisir un fichier CSV'}
        </button>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">{successMsg}</p>
        </div>
      )}

      {/* Recherche */}
      <div className="mx-6 mt-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="🔍 Rechercher un produit ou laboratoire..."
        />
      </div>

      {/* Barre sélection */}
      <div className="mx-6 mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={toggleSelectAll} className="text-xs font-bold text-slate-500 underline">
            {selected.length === produitsFiltres.length && produitsFiltres.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <p className="text-xs text-slate-400">{produitsFiltres.length} produit{produitsFiltres.length > 1 ? 's' : ''}</p>
        </div>
        {selected.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-black"
          >
            🗑️ Supprimer {selected.length}
          </button>
        )}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier le produit' : 'Nouveau produit'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: CardioPlus"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Laboratoire</label>
                <select
                  value={form.laboratoire_id}
                  onChange={(e) => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                >
                  <option value="">Sélectionner un laboratoire</option>
                  {labos.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Préciser</label>
                  <input
                    value={form.categorie_autre}
                    onChange={(e) => set('categorie_autre', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nom de la catégorie..."
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut du produit</label>
                <select
                  value={form.statut_produit}
                  onChange={(e) => set('statut_produit', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                >
                  {STATUTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-20 resize-none"
                  placeholder="Description..."
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
        {produitsFiltres.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucun produit trouvé</p>
          </div>
        ) : (
          produitsFiltres.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl p-4 border-2 transition-colors ${selected.includes(p.id) ? 'border-teal-400' : 'border-transparent'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="mt-1 w-4 h-4 accent-teal-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-black text-blue-950 ${p.statut_produit !== 'Normal' ? 'line-through opacity-60' : ''}`}>
                      {p.nom}
                    </p>
                    {p.laboratoires?.nom && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-600">
                        🧪 {p.laboratoires.nom}
                      </span>
                    )}
                    {p.categorie && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                        {p.categorie}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatutStyle(p.statut_produit || 'Normal')}`}>
                      {p.statut_produit || 'Normal'}
                    </span>
                  </div>
                  {p.description && <p className="text-xs text-slate-400 mt-1">{p.description}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(p)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}