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
    nom: '', type: 'pdf', laboratoire_id: '', produit_id: '', campaign_id: '',
    version: '1.0', is_published: false, is_offline: true, file: null
  })

  const TYPES = ['pdf', 'image', 'video', 'presentation', 'document']
  const TYPE_ICONS = { pdf: '📄', image: '🖼️', video: '🎥', presentation: '📊', document: '📝' }
  const TYPE_COLORS = {
    pdf: 'bg-[#FDE8E8] text-[#DC2626]',
    image: 'bg-[#E8F0FE] text-[#2563EB]',
    video: 'bg-[#E7F5EF] text-[#087F5B]',
    presentation: 'bg-[#FEF3E2] text-[#B45309]',
    document: 'bg-[#EEF1F4] text-[#667085]'
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
    nom: '', type: 'pdf', laboratoire_id: '', produit_id: '', campaign_id: '',
    version: '1.0', is_published: false, is_offline: true, file: null
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
      agence_id: profile.agence_id, laboratoire_id: form.laboratoire_id,
      produit_id: form.produit_id || null, campaign_id: form.campaign_id || null,
      nom: form.nom, type: form.type, file_url, file_size: form.file.size,
      version: form.version, is_published: form.is_published, is_offline: form.is_offline,
      published_at: form.is_published ? new Date().toISOString() : null, created_by: profile.id
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
            <h1 className="text-white font-semibold text-base">Bibliothèque</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {assets.length} support{assets.length > 1 ? 's' : ''} e-detailing
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Ajouter
        </button>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <select value={filterLabo} onChange={e => setFilterLabo(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les laboratoires</option>
          {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['tous', ...TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                filterType === t ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
              }`}>
              {t === 'tous' ? 'Tous' : `${TYPE_ICONS[t]} ${t.toUpperCase()}`}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Nouveau support</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
                <input value={form.nom} onChange={e => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Fiche produit CardioPlus 2025" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type *</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {TYPES.map(t => (
                    <button key={t} type="button" onClick={() => set('type', t)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        form.type === t ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                      }`}>
                      {TYPE_ICONS[t]} {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Laboratoire *</label>
                <select value={form.laboratoire_id} onChange={e => set('laboratoire_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {laboratoires.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Produit associé</label>
                <select value={form.produit_id} onChange={e => set('produit_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucun</option>
                  {produits.filter(p => !form.laboratoire_id || p.laboratoire_id === form.laboratoire_id)
                    .map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Campagne associée</label>
                <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucune</option>
                  {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Version</label>
                <input value={form.version} onChange={e => set('version', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="1.0" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Fichier *</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4,.pptx,.docx"
                  onChange={e => set('file', e.target.files[0])}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm" />
                {form.file && (
                  <p className="text-xs text-[#087F5B] font-semibold mt-1">
                    📎 {form.file.name} ({Math.round(form.file.size / 1024)} Ko)
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published}
                    onChange={e => set('is_published', e.target.checked)}
                    className="w-4 h-4 accent-[#087F5B]" />
                  <span className="text-xs font-medium text-[#667085]">Publier immédiatement</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_offline}
                    onChange={e => set('is_offline', e.target.checked)}
                    className="w-4 h-4 accent-[#087F5B]" />
                  <span className="text-xs font-medium text-[#667085]">Disponible hors ligne</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || uploading}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {uploading ? 'Upload...' : saving ? 'Enregistrement...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 pb-10">
        <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">
          {filtered.length} support{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">📚</p>
            <p className="text-[#667085] text-sm font-medium">Aucun support disponible</p>
            <p className="text-[#98A2B3] text-xs mt-1">Ajoutez des flyers, PDF ou vidéos produits</p>
          </div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${a.is_published ? '#087F5B' : '#DDE4EA'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-lg flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${TYPE_COLORS[a.type]}`}>
                    {TYPE_ICONS[a.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#172B4D] text-sm truncate">{a.nom}</p>
                    <p className="text-xs text-[#667085]">🧪 {a.laboratoires?.nom}</p>
                    {a.produits && <p className="text-xs text-[#667085]">💊 {a.produits.nom}</p>}
                    {a.campaigns && <p className="text-xs text-[#667085]">🎯 {a.campaigns.nom}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type]}`}>
                        {a.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-[#98A2B3]">v{a.version}</span>
                      {a.file_size && (
                        <span className="text-xs text-[#98A2B3]">{Math.round(a.file_size / 1024)} Ko</span>
                      )}
                      {a.is_offline && (
                        <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                          📵 Offline
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => togglePublish(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      a.is_published ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#EEF1F4] text-[#667085]'
                    }`}>
                    {a.is_published ? '✅ Publié' : '⏸ Brouillon'}
                  </button>
                  <a href={a.file_url} target="_blank" rel="noreferrer"
                    className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold text-center">
                    👁️ Voir
                  </a>
                  <button onClick={() => handleDelete(a.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">
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
