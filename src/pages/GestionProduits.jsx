import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

export default function GestionProduits({ onBack, profile }) {
  const [produits, setProduits] = useState([])
  const [laboratoires, setLaboratoires] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterLabo, setFilterLabo] = useState('tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [tab, setTab] = useState('liste')
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    nom: '', dci: '', dosage: '', forme: '',
    conditionnement: '', code_interne: '',
    description: '', categorie: '',
    laboratoire_id: '', brand_id: '',
    statut_produit: 'Normal'
  })

  const STATUTS = ['Normal', 'Éliminé de gamme', 'Arrêt de distribution']
  const STATUT_COLORS = {
    'Normal': 'bg-teal-100 text-teal-600',
    'Éliminé de gamme': 'bg-rose-100 text-rose-500',
    'Arrêt de distribution': 'bg-amber-100 text-amber-600'
  }
  const FORMES = ['Comprimé', 'Gélule', 'Sirop', 'Injectable', 'Sachet', 'Crème', 'Pommade', 'Suppositoire', 'Autre']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: p }, { data: l }, { data: b }] = await Promise.all([
      supabase.from('produits').select('*, laboratoires(nom), brands(nom)').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('brands').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setProduits(p || [])
    setLaboratoires(l || [])
    setBrands(b || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', dci: '', dosage: '', forme: '',
    conditionnement: '', code_interne: '',
    description: '', categorie: '',
    laboratoire_id: '', brand_id: '',
    statut_produit: 'Normal'
  })

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.laboratoire_id) { alert('Sélectionnez un laboratoire'); return }
    setSaving(true)

    await supabase.from('produits').insert({
      nom: form.nom,
      dci: form.dci || null,
      dosage: form.dosage || null,
      forme: form.forme || null,
      conditionnement: form.conditionnement || null,
      code_interne: form.code_interne || null,
      description: form.description || null,
      categorie: form.categorie || null,
      laboratoire_id: form.laboratoire_id,
      brand_id: form.brand_id || null,
      statut_produit: form.statut_produit,
      agence_id: profile.agence_id
    })

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Produit ajouté !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').delete().eq('id', id)
    fetchAll()
  }

  const changeStatut = async (id, statut) => {
    await supabase.from('produits').update({ statut_produit: statut }).eq('id', id)
    fetchAll()
  }

  const handleImport = async (file) => {
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      let imported = 0
      let errors = 0

      for (const row of rows) {
        const nom = row['Nom'] || row['nom'] || row['NOM'] || row['Produit'] || ''
        const laboNom = row['Laboratoire'] || row['laboratoire'] || row['LABO'] || ''
        const dci = row['DCI'] || row['dci'] || ''
        const dosage = row['Dosage'] || row['dosage'] || ''
        const forme = row['Forme'] || row['forme'] || ''
        const conditionnement = row['Conditionnement'] || row['conditionnement'] || ''
        const code_interne = row['Code'] || row['code'] || row['CODE_INTERNE'] || ''
        const categorie = row['Categorie'] || row['catégorie'] || row['CATEGORIE'] || ''

        if (!nom) { errors++; continue }

        let laboratoire_id = null
        if (laboNom) {
          const labo = laboratoires.find(l => l.nom.toLowerCase() === laboNom.toLowerCase())
          if (labo) laboratoire_id = labo.id
        }
        if (!laboratoire_id && laboratoires.length > 0) {
          laboratoire_id = laboratoires[0].id
        }

        const { error } = await supabase.from('produits').insert({
          nom, dci: dci || null, dosage: dosage || null,
          forme: forme || null, conditionnement: conditionnement || null,
          code_interne: code_interne || null,
          categorie: categorie || null,
          laboratoire_id,
          statut_produit: 'Normal',
          agence_id: profile.agence_id
        })

        if (error) errors++
        else imported++
      }

      setImporting(false)
      setSuccessMsg(`Import terminé — ${imported} produits importés, ${errors} erreurs`)
      setTimeout(() => setSuccessMsg(''), 5000)
      fetchAll()
    }
    reader.readAsBinaryString(file)
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Nom': 'Doliprane 500mg',
        'DCI': 'Paracétamol',
        'Dosage': '500mg',
        'Forme': 'Comprimé',
        'Conditionnement': 'B/16',
        'Code': 'DOL500',
        'Laboratoire': 'Sanofi',
        'Categorie': 'Antalgique'
      }
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(template)
    XLSX.utils.book_append_sheet(wb, ws, 'Produits')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_produits_medtrack.xlsx'
    a.click()
  }

  const filtered = produits.filter(p => {
    const matchSearch = `${p.nom} ${p.dci || ''} ${p.dosage || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchLabo = filterLabo === 'tous' || p.laboratoire_id === filterLabo
    const matchStatut = filterStatut === 'tous' || p.statut_produit === filterStatut
    return matchSearch && matchLabo && matchStatut
  })

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
            <h1 className="text-white font-black text-lg">Produits</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {produits.length} produit{produits.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Ajouter
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'liste', label: '📋 Liste' },
          { id: 'import', label: '📥 Import' },
          { id: 'stats', label: '📊 Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${
              tab === t.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">Nouveau produit</h2>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marque</label>
                <select value={form.brand_id} onChange={e => set('brand_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucune</option>
                  {brands.filter(b => !form.laboratoire_id || b.laboratoire_id === form.laboratoire_id)
                    .map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom commercial *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Doliprane" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DCI (nom générique)</label>
                <input value={form.dci} onChange={e => set('dci', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Paracétamol" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dosage</label>
                  <input value={form.dosage} onChange={e => set('dosage', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Ex: 500mg" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Forme</label>
                  <select value={form.forme} onChange={e => set('forme', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                    <option value="">Sélectionner...</option>
                    {FORMES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conditionnement</label>
                <input value={form.conditionnement} onChange={e => set('conditionnement', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: B/16, Flacon 150ml" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Code interne</label>
                <input value={form.code_interne} onChange={e => set('code_interne', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Référence interne labo" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select value={form.statut_produit} onChange={e => set('statut_produit', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
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

      {/* LISTE */}
      {tab === 'liste' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <div className="flex flex-col gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
              placeholder="🔍 Rechercher par nom, DCI, dosage..." />
            <div className="grid grid-cols-2 gap-3">
              <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
                className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
                <option value="tous">Tous les labos</option>
                {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
                <option value="tous">Tous statuts</option>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
          </p>

          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              p.statut_produit === 'Normal' ? 'border-teal-400' :
              p.statut_produit === 'Arrêt de distribution' ? 'border-amber-400' : 'border-rose-400'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-black text-blue-950 text-sm">{p.nom}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut_produit]}`}>
                      {p.statut_produit}
                    </span>
                  </div>
                  {p.dci && <p className="text-xs text-slate-500 font-bold">DCI: {p.dci}</p>}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {p.dosage && <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                    {p.forme && <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">{p.forme}</span>}
                    {p.conditionnement && <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{p.conditionnement}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">🧪 {p.laboratoires?.nom}</p>
                  {p.brands && <p className="text-xs text-slate-400">🏷️ {p.brands.nom}</p>}
                  {p.code_interne && <p className="text-xs text-slate-400">📦 {p.code_interne}</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <select value={p.statut_produit}
                    onChange={e => changeStatut(p.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg p-1 bg-slate-50">
                    {STATUTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => handleDelete(p.id)}
                    className="bg-rose-50 text-rose-500 px-2 py-1.5 rounded-lg text-xs font-bold">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* IMPORT */}
      {tab === 'import' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-blue-700 font-black mb-2">📋 Colonnes acceptées dans le fichier Excel/CSV :</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-blue-600">
              <span>• Nom (obligatoire)</span>
              <span>• DCI</span>
              <span>• Dosage</span>
              <span>• Forme</span>
              <span>• Conditionnement</span>
              <span>• Code</span>
              <span>• Laboratoire</span>
              <span>• Categorie</span>
            </div>
          </div>

          <button onClick={downloadTemplate}
            className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">
            📥 Télécharger le modèle Excel
          </button>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
            onChange={e => e.target.files[0] && handleImport(e.target.files[0])}
            className="hidden" />

          <button onClick={() => fileRef.current.click()} disabled={importing}
            className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm">
            {importing ? '⏳ Import en cours...' : '📤 Importer un fichier'}
          </button>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-bold">
              ⚠️ Si la colonne "Laboratoire" ne correspond à aucun laboratoire existant, le produit sera assigné au premier laboratoire de votre liste.
            </p>
          </div>

          {/* Stats import */}
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">État du catalogue</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-black text-teal-500">{produits.filter(p => p.statut_produit === 'Normal').length}</p>
                <p className="text-xs text-slate-400">Actifs</p>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-500">{produits.filter(p => p.statut_produit === 'Arrêt de distribution').length}</p>
                <p className="text-xs text-slate-400">Arrêtés</p>
              </div>
              <div>
                <p className="text-2xl font-black text-rose-500">{produits.filter(p => p.statut_produit === 'Éliminé de gamme').length}</p>
                <p className="text-xs text-slate-400">Éliminés</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{produits.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total produits</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{laboratoires.length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Laboratoires</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
              <p className="text-2xl font-black text-blue-950">{produits.filter(p => p.dci).length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Avec DCI</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{produits.filter(p => p.dosage).length}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Avec dosage</p>
            </div>
          </div>

          {/* Par laboratoire */}
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Par laboratoire</p>
          {laboratoires.map(l => {
            const count = produits.filter(p => p.laboratoire_id === l.id).length
            const actifs = produits.filter(p => p.laboratoire_id === l.id && p.statut_produit === 'Normal').length
            return (
              <div key={l.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-blue-950 text-sm">{l.nom}</p>
                  <p className="font-black text-teal-500">{actifs}/{count}</p>
                </div>
                <div className="bg-slate-100 rounded-full h-2">
                  <div className="bg-teal-400 h-2 rounded-full"
                    style={{ width: count > 0 ? `${(actifs / count) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{actifs} actifs · {count - actifs} inactifs</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}