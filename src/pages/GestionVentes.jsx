import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

export default function GestionVentes({ onBack, profile }) {
  const [wholesalers, setWholesalers] = useState([])
  const [imports, setImports] = useState([])
  const [salesLines, setSalesLines] = useState([])
  const [aggregated, setAggregated] = useState([])
  const [produits, setProduits] = useState([])
  const [externalCodes, setExternalCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('grossistes')
  const [showForm, setShowForm] = useState(false)
  const [showMapping, setShowMapping] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const fileRef = useRef(null)
  const [selectedWholesaler, setSelectedWholesaler] = useState(null)
  const [importPeriod, setImportPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  const [form, setForm] = useState({
    nom: '', code: '', type: 'national',
    integration_type: 'manual', extranet_url: '',
    contact_nom: '', contact_email: '', contact_telephone: ''
  })
  const [mappingForm, setMappingForm] = useState({
    produit_id: '', external_code: '', external_name: '', unit: '', conditioning: ''
  })

  const TYPES = { national: 'National', regional: 'Régional', local: 'Local' }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: w }, { data: i }, { data: a }, { data: p }, { data: ec }] = await Promise.all([
      supabase.from('wholesalers').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('sales_imports').select('*, wholesalers(nom)').eq('agence_id', profile.agence_id).order('created_at', { ascending: false }).limit(20),
      supabase.from('aggregated_sales').select('*, produits(nom, laboratoire_id), laboratoires(nom)').eq('agence_id', profile.agence_id).order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('statut_produit', 'Normal').order('nom'),
      supabase.from('product_external_codes').select('*, produits(nom), wholesalers(nom)').order('created_at', { ascending: false })
    ])
    setWholesalers(w || [])
    setImports(i || [])
    setAggregated(a || [])
    setProduits(p || [])
    setExternalCodes(ec || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', code: '', type: 'national',
    integration_type: 'manual', extranet_url: '',
    contact_nom: '', contact_email: '', contact_telephone: ''
  })

  const handleSaveWholesaler = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    setSaving(true)
    await supabase.from('wholesalers').insert({
      ...form,
      agence_id: profile.agence_id
    })
    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Grossiste ajouté !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleDeleteWholesaler = async (id) => {
    if (!confirm('Supprimer ce grossiste ?')) return
    await supabase.from('wholesalers').delete().eq('id', id)
    fetchAll()
  }

  const handleSaveMapping = async () => {
    if (!mappingForm.produit_id || !mappingForm.external_code) {
      alert('Produit et code externe obligatoires')
      return
    }
    setSaving(true)
    await supabase.from('product_external_codes').insert({
      produit_id: mappingForm.produit_id,
      wholesaler_id: showMapping.id,
      external_code: mappingForm.external_code,
      external_name: mappingForm.external_name,
      unit: mappingForm.unit,
      conditioning: mappingForm.conditioning
    })
    setSaving(false)
    setMappingForm({ produit_id: '', external_code: '', external_name: '', unit: '', conditioning: '' })
    setSuccessMsg('Mapping ajouté !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleImportCSV = async (file) => {
    if (!selectedWholesaler) { alert('Sélectionnez un grossiste'); return }
    setImporting(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      const { data: importData } = await supabase.from('sales_imports').insert({
        agence_id: profile.agence_id,
        wholesaler_id: selectedWholesaler,
        period_month: importPeriod.month,
        period_year: importPeriod.year,
        file_url: '',
        total_lines: rows.length,
        statut: 'processing',
        imported_by: profile.id
      }).select().single()

      if (!importData) { setImporting(false); return }

      let valid = 0
      let errors = 0
      const codes = externalCodes.filter(ec => ec.wholesaler_id === selectedWholesaler)

      for (const row of rows) {
        const externalCode = String(row['Code'] || row['code'] || row['CODE'] || row['Référence'] || row['reference'] || '')
        const quantity = parseInt(row['Quantité'] || row['quantite'] || row['QTE'] || row['Qty'] || 0)
        const unitPrice = parseFloat(row['Prix'] || row['prix'] || row['PU'] || 0)
        const saleDate = row['Date'] || row['date'] || new Date().toISOString().slice(0, 10)

        if (!externalCode || !quantity) { errors++; continue }

        const mapping = codes.find(c => c.external_code === externalCode)

        await supabase.from('sales_lines').insert({
          import_id: importData.id,
          agence_id: profile.agence_id,
          wholesaler_id: selectedWholesaler,
          produit_id: mapping?.produit_id || null,
          external_code: externalCode,
          external_name: String(row['Nom'] || row['nom'] || row['Produit'] || ''),
          sale_date: saleDate,
          quantity,
          unit_price: unitPrice,
          total_amount: quantity * unitPrice,
          currency: 'XOF',
          period_month: importPeriod.month,
          period_year: importPeriod.year,
          is_mapped: !!mapping
        })
        valid++
      }

      await supabase.from('sales_imports').update({
        valid_lines: valid,
        error_lines: errors,
        statut: 'completed'
      }).eq('id', importData.id)

      await aggregateSales()
      setImporting(false)
      setSuccessMsg(`Import terminé — ${valid} lignes valides, ${errors} erreurs`)
      setTimeout(() => setSuccessMsg(''), 5000)
      fetchAll()
    }
    reader.readAsBinaryString(file)
  }

  const aggregateSales = async () => {
    const { data: lines } = await supabase
      .from('sales_lines')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .not('produit_id', 'is', null)

    if (!lines) return

    const grouped = {}
    for (const line of lines) {
      const key = `${line.produit_id}_${line.period_month}_${line.period_year}`
      if (!grouped[key]) {
        grouped[key] = {
          produit_id: line.produit_id,
          period_month: line.period_month,
          period_year: line.period_year,
          total_quantity: 0,
          total_amount: 0,
          wholesalers: new Set()
        }
      }
      grouped[key].total_quantity += line.quantity
      grouped[key].total_amount += line.total_amount || 0
      grouped[key].wholesalers.add(line.wholesaler_id)
    }

    for (const key of Object.keys(grouped)) {
      const g = grouped[key]
      const { data: prod } = await supabase.from('produits').select('laboratoire_id').eq('id', g.produit_id).single()

      await supabase.from('aggregated_sales').upsert({
        agence_id: profile.agence_id,
        produit_id: g.produit_id,
        laboratoire_id: prod?.laboratoire_id,
        period_month: g.period_month,
        period_year: g.period_year,
        total_quantity: g.total_quantity,
        total_amount: g.total_amount,
        wholesaler_count: g.wholesalers.size,
        currency: 'XOF',
        last_updated: new Date().toISOString()
      }, { onConflict: 'agence_id,produit_id,period_month,period_year' })
    }
  }

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

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
            <h1 className="text-white font-black text-lg">Ventes & Grossistes</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {wholesalers.length} grossiste{wholesalers.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {tab === 'grossistes' && (
          <button onClick={() => setShowForm(true)}
            className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
            + Ajouter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'grossistes', label: '🏭 Grossistes' },
          { id: 'mapping', label: '🔗 Mapping' },
          { id: 'import', label: '📥 Import' },
          { id: 'ventes', label: '📊 Ventes' },
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

      {/* GROSSISTES */}
      {tab === 'grossistes' && (
        <div className="p-6 flex flex-col gap-3 pb-10">
          {showForm && (
            <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
                <h2 className="font-black text-blue-950 text-lg mb-4">Nouveau grossiste</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                    <input value={form.nom} onChange={e => set('nom', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="Ex: CAMED SA" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Code</label>
                    <input value={form.code} onChange={e => set('code', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="Ex: CAMED" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                      {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL Extranet</label>
                    <input value={form.extranet_url} onChange={e => set('extranet_url', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</label>
                    <input value={form.contact_nom} onChange={e => set('contact_nom', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="Nom du contact" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                    <input value={form.contact_telephone} onChange={e => set('contact_telephone', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="00223XXXXXXXX" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setShowForm(false); resetForm() }}
                      className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                      Annuler
                    </button>
                    <button onClick={handleSaveWholesaler} disabled={saving}
                      className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                      {saving ? '...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {wholesalers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🏭</p>
              <p className="text-slate-400 text-sm font-bold">Aucun grossiste configuré</p>
            </div>
          ) : (
            wholesalers.map(w => (
              <div key={w.id} className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-black text-blue-950">{w.nom}</p>
                    {w.code && <p className="text-xs text-slate-400">Code: {w.code}</p>}
                    <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                      {TYPES[w.type]}
                    </span>
                    {w.contact_nom && <p className="text-xs text-slate-400 mt-1">👤 {w.contact_nom}</p>}
                    {w.contact_telephone && <p className="text-xs text-slate-400">📞 {w.contact_telephone}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowMapping(w); setTab('mapping') }}
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                      🔗 Mapper
                    </button>
                    <button onClick={() => handleDeleteWholesaler(w.id)}
                      className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MAPPING */}
      {tab === 'mapping' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grossiste</label>
            <select
              value={showMapping?.id || ''}
              onChange={e => setShowMapping(wholesalers.find(w => w.id === e.target.value))}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="">Sélectionner un grossiste...</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
            </select>
          </div>

          {showMapping && (
            <>
              <div className="bg-white rounded-2xl p-4">
                <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
                  Ajouter un mapping
                </p>
                <div className="flex flex-col gap-3">
                  <select value={mappingForm.produit_id}
                    onChange={e => setMappingForm(f => ({ ...f, produit_id: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                    <option value="">Produit MedTrack...</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                  <input value={mappingForm.external_code}
                    onChange={e => setMappingForm(f => ({ ...f, external_code: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Code chez le grossiste (ex: 45892)" />
                  <input value={mappingForm.external_name}
                    onChange={e => setMappingForm(f => ({ ...f, external_name: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nom chez le grossiste (optionnel)" />
                  <button onClick={handleSaveMapping} disabled={saving}
                    className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                    {saving ? '...' : '+ Ajouter le mapping'}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  Mappings existants — {showMapping.nom}
                </p>
                {externalCodes.filter(ec => ec.wholesaler_id === showMapping.id).length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center">
                    <p className="text-slate-400 text-sm">Aucun mapping configuré</p>
                  </div>
                ) : (
                  externalCodes.filter(ec => ec.wholesaler_id === showMapping.id).map(ec => (
                    <div key={ec.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-blue-950 text-sm">{ec.produits?.nom}</p>
                        <p className="text-xs text-slate-400">Code: {ec.external_code}</p>
                        {ec.external_name && <p className="text-xs text-slate-400">{ec.external_name}</p>}
                      </div>
                      <button onClick={async () => {
                        await supabase.from('product_external_codes').delete().eq('id', ec.id)
                        fetchAll()
                      }} className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* IMPORT */}
      {tab === 'import' && (
        <div className="p-6 flex flex-col gap-4 pb-10">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-blue-700 font-bold mb-1">📋 Format CSV/Excel attendu</p>
            <p className="text-xs text-blue-600">Colonnes : Code, Nom, Quantité, Prix, Date</p>
            <p className="text-xs text-blue-600 mt-1">Ex: 45892 | Doliprane 500mg | 120 | 450 | 2025-01-15</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grossiste *</label>
            <select value={selectedWholesaler || ''}
              onChange={e => setSelectedWholesaler(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
              <option value="">Sélectionner...</option>
              {wholesalers.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mois</label>
              <select value={importPeriod.month}
                onChange={e => setImportPeriod(p => ({ ...p, month: parseInt(e.target.value) }))}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm">
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Année</label>
              <input type="number" value={importPeriod.year}
                onChange={e => setImportPeriod(p => ({ ...p, year: parseInt(e.target.value) }))}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-sm" />
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
            onChange={e => e.target.files[0] && handleImportCSV(e.target.files[0])}
            className="hidden" />

          <button onClick={() => fileRef.current.click()} disabled={importing || !selectedWholesaler}
            className={`w-full font-black py-4 rounded-2xl text-sm ${
              !selectedWholesaler ? 'bg-slate-200 text-slate-400' : 'bg-teal-400 text-blue-950'
            }`}>
            {importing ? '⏳ Import en cours...' : '📥 Importer un fichier CSV/Excel'}
          </button>

          {/* Historique imports */}
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mt-2">Historique imports</p>
          {imports.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-slate-400 text-sm">Aucun import effectué</p>
            </div>
          ) : (
            imports.map(i => (
              <div key={i.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                i.statut === 'completed' ? 'border-teal-400' :
                i.statut === 'failed' ? 'border-rose-400' : 'border-amber-400'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-blue-950 text-sm">{i.wholesalers?.nom}</p>
                    <p className="text-xs text-slate-400">
                      {MONTHS[i.period_month - 1]} {i.period_year}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-teal-500">{i.valid_lines} valides</p>
                    {i.error_lines > 0 && (
                      <p className="text-xs font-bold text-rose-500">{i.error_lines} erreurs</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VENTES AGRÉGÉES */}
      {tab === 'ventes' && (
        <div className="p-6 flex flex-col gap-3 pb-10">
          <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Ventes consolidées par produit
          </p>

          {aggregated.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-slate-400 text-sm font-bold">Aucune donnée de vente</p>
              <p className="text-slate-300 text-xs mt-1">Importez des fichiers depuis l'onglet Import</p>
            </div>
          ) : (
            <>
              {/* Total global */}
              <div className="bg-blue-950 rounded-2xl p-4">
                <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-2">Total consolidé</p>
                <p className="text-white text-3xl font-black">
                  {aggregated.reduce((sum, a) => sum + a.total_quantity, 0).toLocaleString()}
                </p>
                <p className="text-teal-400 text-xs font-bold mt-1">unités vendues tous grossistes</p>
              </div>

              {aggregated.map(a => (
                <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-blue-950 text-sm truncate">{a.produits?.nom}</p>
                      <p className="text-xs text-slate-400">
                        {MONTHS[a.period_month - 1]} {a.period_year} · {a.wholesaler_count} grossiste{a.wholesaler_count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-black text-teal-500 text-xl">{a.total_quantity.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">unités</p>
                    </div>
                  </div>
                  {a.total_amount > 0 && (
                    <p className="text-xs text-slate-400 font-bold">
                      💰 {a.total_amount.toLocaleString()} XOF
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}