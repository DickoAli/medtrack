import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Extranet({ onBack, profile }) {
  const [extranets, setExtranets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showCredentials, setShowCredentials] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    nom: '', url: '', identifiant: '', mot_de_passe: '', note: ''
  })

  useEffect(() => { fetchExtranets() }, [])

  const fetchExtranets = async () => {
    const { data } = await supabase
      .from('extranets')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .order('nom')
    setExtranets(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nom || !form.url) { alert('Le nom et l\'URL sont obligatoires'); return }
    setSaving(true)
    const url = form.url.startsWith('http') ? form.url : `https://${form.url}`
    if (editing) {
      await supabase.from('extranets').update({
        nom: form.nom, url,
        identifiant_enc: form.identifiant ? btoa(form.identifiant) : null,
        mot_de_passe_enc: form.mot_de_passe ? btoa(form.mot_de_passe) : null,
        note: form.note
      }).eq('id', editing)
    } else {
      await supabase.from('extranets').insert({
        nom: form.nom, url,
        identifiant_enc: form.identifiant ? btoa(form.identifiant) : null,
        mot_de_passe_enc: form.mot_de_passe ? btoa(form.mot_de_passe) : null,
        note: form.note,
        agence_id: profile.agence_id
      })
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', url: '', identifiant: '', mot_de_passe: '', note: '' })
    setSuccessMsg('Extranet enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchExtranets()
  }

  const handleEdit = (e) => {
    setEditing(e.id)
    setForm({ nom: e.nom, url: e.url, identifiant: e.identifiant || '', mot_de_passe: e.mot_de_passe || '', note: e.note || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet extranet ?')) return
    await supabase.from('extranets').delete().eq('id', id)
    fetchExtranets()
  }

  const decrypt = (encrypted) => {
    if (!encrypted) return ''
    try {
      return atob(encrypted)
    } catch {
      return encrypted
    }
  }

  const handleOpen = (extranet) => {
    if (extranet.identifiant_enc || extranet.mot_de_passe_enc) {
      setShowCredentials({
        ...extranet,
        identifiant_dec: decrypt(extranet.identifiant_enc),
        mot_de_passe_dec: decrypt(extranet.mot_de_passe_enc)
      })
      setShowPassword(false)
    } else {
      window.open(extranet.url, '_blank')
    }
  }

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
          <h1 className="text-white font-semibold text-base">Extranet</h1>
        </div>
        {profile.role === 'manager' && (
          <button
            onClick={() => {
              setShowForm(true)
              setEditing(null)
              setForm({ nom: '', url: '', identifiant: '', mot_de_passe: '', note: '' })
            }}
            className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs"
          >
            + Ajouter
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
          <p className="text-[#087F5B] font-semibold">✅ {successMsg}</p>
        </div>
      )}

      {showCredentials && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-1">{showCredentials.nom}</h2>
            <p className="text-xs text-[#98A2B3] mb-4">{showCredentials.url}</p>

            <div className="flex flex-col gap-3 mb-4">
              <div className="bg-[#F4F7F9] rounded-xl p-3">
                <p className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide mb-1">Identifiant</p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#172B4D]">{showCredentials.identifiant_dec}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showCredentials.identifiant_dec)
                      alert('Identifiant copié !')
                    }}
                    className="bg-[#E8F0FE] text-[#2563EB] px-2 py-1 rounded-lg text-xs font-semibold"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div className="bg-[#F4F7F9] rounded-xl p-3">
                <p className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide mb-1">Mot de passe</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#172B4D] flex-1">
                    {showPassword ? showCredentials.mot_de_passe_dec : '••••••••••'}
                  </p>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="bg-[#EEF1F4] text-[#667085] px-2 py-1 rounded-lg text-xs font-semibold"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showCredentials.mot_de_passe_dec)
                      alert('Mot de passe copié !')
                    }}
                    className="bg-[#E8F0FE] text-[#2563EB] px-2 py-1 rounded-lg text-xs font-semibold"
                  >
                    Copier
                  </button>
                </div>
              </div>

              {showCredentials.note && (
                <div className="bg-[#FEF3E2] rounded-xl p-3">
                  <p className="text-xs font-medium text-[#B45309] uppercase tracking-wide mb-1">Note</p>
                  <p className="text-xs text-[#667085]">{showCredentials.note}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                window.open(showCredentials.url, '_blank')
                setShowCredentials(null)
              }}
              className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm mb-2"
            >
              🌐 Ouvrir le site extranet
            </button>
            <button
              onClick={() => setShowCredentials(null)}
              className="w-full bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier l\'extranet' : 'Nouvel extranet'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom du grossiste *</label>
                <input value={form.nom} onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: CAMED SA" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">URL du site *</label>
                <input value={form.url} onChange={(e) => set('url', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: www.camed.ml" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Identifiant</label>
                <input value={form.identifiant} onChange={(e) => set('identifiant', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Identifiant de connexion" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mot de passe</label>
                <input value={form.mot_de_passe} onChange={(e) => set('mot_de_passe', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Mot de passe extranet" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Note</label>
                <textarea value={form.note} onChange={(e) => set('note', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Informations supplémentaires..." />
              </div>
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

      <div className="p-5 flex flex-col gap-3">
        {extranets.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🌐</p>
            <p className="text-[#667085] text-sm font-medium">Aucun extranet configuré</p>
            {profile.role === 'manager' && (
              <p className="text-[#98A2B3] text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer</p>
            )}
          </div>
        ) : (
          extranets.map((e) => (
            <div key={e.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#172B4D] flex items-center justify-center font-semibold text-[#087F5B] text-lg flex-shrink-0">
                  {e.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#172B4D]">{e.nom}</p>
                  <p className="text-xs text-[#667085] truncate">{e.url}</p>
                  {e.identifiant_enc && (
                    <p className="text-xs text-[#087F5B] font-semibold mt-0.5">🔑 Identifiants configurés</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {profile.role === 'manager' && (
                    <>
                      <button onClick={() => handleEdit(e)} className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                      <button onClick={() => handleDelete(e.id)} className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleOpen(e)}
                className="w-full mt-3 bg-[#172B4D] text-white font-semibold py-3 rounded-lg text-sm hover:bg-[#233858] transition-colors"
              >
                🌐 Ouvrir {e.nom}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
