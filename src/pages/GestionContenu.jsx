import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionContenu({ onBack, profile }) {
  const [assets, setAssets] = useState([])
  const [laboratoires, setLaboratoires] = useState([])
  const [produits, setProduits] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterLabo, setFilterLabo] = useState('tous')
  const [filterType, setFilterType] = useState('tous')
  const [form, setForm] = useState({
    nom: '', type: 'pdf', laboratoire_id: '',
    produit_id: '', campaign_id: '',
    version: '1.0', is_published: false,
    is_offline: true, file: null
  })

  const TYPES = ['pdf', 'image', 'video', 'presentation', 'document']
  const TYPE_ICONS = {
    pdf: '📄', image: '🖼️', video: '🎥',
    presentation: '📊', document: '📝'
  }
  const TYPE_COLORS = {
    pdf: 'bg-red-100 text-red-600',
    image: 'bg-blue-100 text-blue-600',
    video: 'bg-purple-100 text-purple-600',
    presentation: 'bg-amber-100 text-amber-600',
    document: 'bg-slate-100 text-slate-500'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: a }, { data: l }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('content_assets')
        .select('*, laboratoires(nom), produits(nom), campaigns(nom)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id),
      supabase.from('produits').select('*').eq('agence_id', profile.agence_id).eq('statut_produit', 'Normal'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).eq('statut', 'active')
    ])
    setAssets(a || [])
    setLaboratoires(l || [])
    setProduits(p || [])
    setCampagnes(c || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', type: 'pdf', laboratoire_id: '',
    produit_id: '', campaign_id: '',
    version: '1.0', is_published: false,
    is_offline: true, file: null
  })

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    if (!form.laboratoire_id) { alert('Sélectionnez un laboratoire'); return }
    if (!form.file) { alert('Uploadez un fichier'); return }
    setSaving(true)
    setUploading(true)

    const fileName = `${profile.agence_id}/${Date.now()}_${form.file.name}`
    const { error: uploadError } = await supabase.storage.from('STATLABO').upload(fileName, form.file)

    if (uploadError) {
      alert('Erreur upload: ' + uploadError.message)
      setSaving(false)
      setUploading(false)
      return
    }

    const file_url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/STATLABO/${fileName}`
    setUploading(false)

    await supabase.from('content_assets').insert({
      agence_id: profile.agence_id,
      laboratoire_id: form.laboratoire_id,
      produit_id: form.produit_id || null,
      campaign_id: form.campaign_id || null,
      nom: form.nom,
      type: form.type,
      file_url,
      file_size: form.file.size,
      version: form.version,
      is_published: form.is_published,
      is_offline: form.is_offline,
      published_at: form.is_published ? new Date().toISOString() : null,
      created_by: profile.id
    })

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Support ajouté !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const togglePublish = async (asset) => {
    await supabase.from('content_assets').update({
      is_published: !asset.is_published,
      published_at: !asset.is_published ? new Date().toISOString() : null
    }).eq('id', asset.id)
    fetchAll()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce support ?')) return
    await supabase.from('content_assets').delete().eq('id', id)
    fetchAll()
  }

  const filtered = assets.filter(a => {
    const matchLabo = filterLabo === 'tous' || a.laboratoire_id === filterLabo
    const matchType = filterType === 'tous' || a.type === filterType
    return matchLabo && matchType
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
            <h1 className="text-white font-black text-lg">Bibliothèque</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {assets.length} support{assets.length > 1 ? 's' : ''} e-detailing
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      <div className="px-6 pt-4 flex flex-col gap-3">
        <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les laboratoires</option>
          {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', ...TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                filterType === t ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              {t === 'tous' ? 'Tous' : `${TYPE_ICONS[t]} ${t.toUpperCase()}`}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">Nouveau support</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Fiche produit CardioPlus 2025" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type *</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {TYPES.map(t => (
                    <button key={t} type="button" onClick={() => set('type', t)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        form.type === t ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-500 border-slate-200'
                      }`}>
                      {TYPE_ICONS[t]} {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produit associé</label>
                <select value={form.produit_id} onChange={e => set('produit_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucun</option>
                  {produits
                    .filter(p => !form.laboratoire_id || p.laboratoire_id === form.laboratoire_id)
                    .map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campagne associée</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Version</label>
                <input value={form.version} onChange={e => set('version', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="1.0" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fichier *</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4,.pptx,.docx"
                  onChange={e => set('file', e.target.files[0])}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                {form.file && (
                  <p className="text-xs text-teal-500 font-bold mt-1">
                    📎 {form.file.name} ({Math.round(form.file.size / 1024)} Ko)
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published}
                    onChange={e => set('is_published', e.target.checked)}
                    className="w-4 h-4 accent-teal-400" />
                  <span className="text-xs font-bold text-slate-600">Publier immédiatement</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_offline}
                    onChange={e => set('is_offline', e.target.checked)}
                    className="w-4 h-4 accent-teal-400" />
                  <span className="text-xs font-bold text-slate-600">Disponible hors ligne</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || uploading}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {uploading ? 'Upload...' : saving ? 'Enregistrement...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col gap-3 pb-10">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          {filtered.length} support{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-slate-400 text-sm font-bold">Aucun support disponible</p>
            <p className="text-slate-300 text-xs mt-1">Ajoutez des flyers, PDF ou vidéos produits</p>
          </div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl p-4 border-l-4 ${a.is_published ? 'border-teal-400' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-lg flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${TYPE_COLORS[a.type]}`}>
                    {TYPE_ICONS[a.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-blue-950 text-sm truncate">{a.nom}</p>
                    <p className="text-xs text-slate-400">🧪 {a.laboratoires?.nom}</p>
                    {a.produits && <p className="text-xs text-slate-400">💊 {a.produits.nom}</p>}
                    {a.campaigns && <p className="text-xs text-slate-400">🎯 {a.campaigns.nom}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type]}`}>
                        {a.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">v{a.version}</span>
                      {a.file_size && (
                        <span className="text-xs text-slate-400">{Math.round(a.file_size / 1024)} Ko</span>
                      )}
                      {a.is_offline && (
                        <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                          📵 Offline
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => togglePublish(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      a.is_published ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {a.is_published ? '✅ Publié' : '⏸ Brouillon'}
                  </button>
                  <a href={a.file_url} target="_blank" rel="noreferrer"
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold text-center">
                    👁️ Voir
                  </a>
                  <button onClick={() => handleDelete(a.id)}
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
