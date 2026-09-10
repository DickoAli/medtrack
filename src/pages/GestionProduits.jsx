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
    'Normal': 'bg-[#E7F5EF] text-[#087F5B]',
    'Éliminé de gamme': 'bg-[#FDE8E8] text-[#DC2626]',
    'Arrêt de distribution': 'bg-[#FEF3E2] text-[#B45309]'
  }
  const STATUT_BORDER = {
    'Normal': '#087F5B', 'Éliminé de gamme': '#DC2626', 'Arrêt de distribution': '#F59E0B'
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

    const { error } = await supabase.from('produits').insert({
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

    if (error) {
      console.error('Erreur ajout produit:', error)
      alert('Erreur lors de l\'ajout du produit : ' + error.message)
      return
    }

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
    const template = [{
      'Nom': 'Doliprane 500mg', 'DCI': 'Paracétamol', 'Dosage': '500mg',
      'Forme': 'Comprimé', 'Conditionnement': 'B/16', 'Code': 'DOL500',
      'Laboratoire': 'Sanofi', 'Categorie': 'Antalgique'
    }]
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
            <h1 className="text-white font-semibold text-base">Produits</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {produits.length} produit{produits.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Ajouter
        </button>
      </div>

      <div className="bg-white flex border-b border-[#DDE4EA]">
        {[
          { id: 'liste', label: 'Liste' },
          { id: 'import', label: 'Import' },
          { id: 'stats', label: 'Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t.id ? 'text-[#087F5B] border-b-2 border-[#087F5B]' : 'text-[#667085]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Nouveau produit</h2>
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
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Marque</label>
                <select value={form.brand_id} onChange={e => set('brand_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucune</option>
                  {brands.filter(b => !form.laboratoire_id || b.laboratoire_id === form.laboratoire_id)
                    .map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom commercial *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Doliprane" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">DCI (nom générique)</label>
                <input value={form.dci} onChange={e => set('dci', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Paracétamol" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Dosage</label>
                  <input value={form.dosage} onChange={e => set('dosage', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                    placeholder="Ex: 500mg" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Forme</label>
                  <select value={form.forme} onChange={e => set('forme', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                    <option value="">Sélectionner...</option>
                    {FORMES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Conditionnement</label>
                <input value={form.conditionnement} onChange={e => set('conditionnement', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: B/16, Flacon 150ml" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Code interne</label>
                <input value={form.code_interne} onChange={e => set('code_interne', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Référence interne labo" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Statut</label>
                <select value={form.statut_produit} onChange={e => set('statut_produit', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
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

      {tab === 'liste' && (
        <div className="p-5 flex flex-col gap-4 pb-10">
          <div className="flex flex-col gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
              placeholder="🔍 Rechercher par nom, DCI, dosage..." />
            <div className="grid grid-cols-2 gap-3">
              <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
                className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="tous">Tous les labos</option>
                {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="tous">Tous statuts</option>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
          </p>

          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${STATUT_BORDER[p.statut_produit]}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-[#172B4D]">{p.nom}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut_produit]}`}>
                      {p.statut_produit}
                    </span>
                  </div>
                  {p.dci && <p className="text-xs text-[#667085] font-medium">DCI: {p.dci}</p>}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {p.dosage && <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                    {p.forme && <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">{p.forme}</span>}
                    {p.conditionnement && <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">{p.conditionnement}</span>}
                  </div>
                  <p className="text-xs text-[#667085] mt-1">🧪 {p.laboratoires?.nom}</p>
                  {p.brands && <p className="text-xs text-[#667085]">🏷️ {p.brands.nom}</p>}
                  {p.code_interne && <p className="text-xs text-[#98A2B3]">📦 {p.code_interne}</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <select value={p.statut_produit}
                    onChange={e => changeStatut(p.id, e.target.value)}
                    className="text-xs border border-[#DDE4EA] rounded-lg p-1 bg-white text-[#172B4D]">
                    {STATUTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => handleDelete(p.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-2 py-1.5 rounded-lg text-xs font-semibold">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'import' && (
        <div className="p-5 flex flex-col gap-4 pb-10">
          <div className="bg-[#E8F0FE] border border-[#2563EB]/20 rounded-xl p-4">
            <p className="text-xs text-[#2563EB] font-semibold mb-2">📋 Colonnes acceptées dans le fichier Excel/CSV :</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-[#2563EB]">
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
            className="w-full bg-[#172B4D] text-white font-semibold py-4 rounded-xl text-sm">
            📥 Télécharger le modèle Excel
          </button>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
            onChange={e => e.target.files[0] && handleImport(e.target.files[0])}
            className="hidden" />

          <button onClick={() => fileRef.current.click()} disabled={importing}
            className="w-full bg-[#087F5B] text-white font-semibold py-4 rounded-xl text-sm">
            {importing ? '⏳ Import en cours...' : '📤 Importer un fichier'}
          </button>

          <div className="bg-[#FEF3E2] border border-[#F59E0B]/30 rounded-xl p-4">
            <p className="text-xs text-[#B45309] font-semibold">
              ⚠️ Si la colonne "Laboratoire" ne correspond à aucun laboratoire existant, le produit sera assigné au premier laboratoire de votre liste.
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">État du catalogue</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-semibold text-[#087F5B]">{produits.filter(p => p.statut_produit === 'Normal').length}</p>
                <p className="text-xs text-[#98A2B3]">Actifs</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#B45309]">{produits.filter(p => p.statut_produit === 'Arrêt de distribution').length}</p>
                <p className="text-xs text-[#98A2B3]">Arrêtés</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#DC2626]">{produits.filter(p => p.statut_produit === 'Éliminé de gamme').length}</p>
                <p className="text-xs text-[#98A2B3]">Éliminés</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="p-5 flex flex-col gap-4 pb-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{produits.length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Total produits</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{laboratoires.length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Laboratoires</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="text-xl font-semibold text-[#172B4D]">{produits.filter(p => p.dci).length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Avec DCI</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="text-xl font-semibold text-[#172B4D]">{produits.filter(p => p.dosage).length}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Avec dosage</p>
            </div>
          </div>

          <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">Par laboratoire</p>
          {laboratoires.map(l => {
            const count = produits.filter(p => p.laboratoire_id === l.id).length
            const actifs = produits.filter(p => p.laboratoire_id === l.id && p.statut_produit === 'Normal').length
            return (
              <div key={l.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-[#172B4D] text-sm">{l.nom}</p>
                  <p className="font-semibold text-[#087F5B]">{actifs}/{count}</p>
                </div>
                <div className="bg-[#EEF1F4] rounded-full h-2">
                  <div className="bg-[#087F5B] h-2 rounded-full"
                    style={{ width: count > 0 ? `${(actifs / count) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs text-[#98A2B3] mt-1">{actifs} actifs · {count - actifs} inactifs</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
