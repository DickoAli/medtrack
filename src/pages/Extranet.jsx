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
        nom: form.nom, url, identifiant: form.identifiant,
        mot_de_passe: form.mot_de_passe, note: form.note
      }).eq('id', editing)
    } else {
      await supabase.from('extranets').insert({
        nom: form.nom, url, identifiant: form.identifiant,
        mot_de_passe: form.mot_de_passe, note: form.note,
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

  const handleOpen = (extranet) => {
    if (extranet.identifiant) {
      setShowCredentials(extranet)
    } else {
      window.open(extranet.url, '_blank')
    }
  }

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
          <h1 className="text-white font-black">Extranet</h1>
        </div>
        {profile.role === 'manager' && (
          <button
            onClick={() => {
              setShowForm(true)
              setEditing(null)
              setForm({ nom: '', url: '', identifiant: '', mot_de_passe: '', note: '' })
            }}
            className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
          >
            + Ajouter
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {/* Modal identifiants */}
      {showCredentials && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-black text-blue-950 text-lg mb-1">{showCredentials.nom}</h2>
            <p className="text-xs text-slate-400 mb-4">{showCredentials.url}</p>

            <div className="flex flex-col gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Identifiant</p>
                <div className="flex items-center justify-between">
                  <p className="font-black text-blue-950">{showCredentials.identifiant}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(showCredentials.identifiant)}
                    className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mot de passe</p>
                <div className="flex items-center justify-between">
                  <p className="font-black text-blue-950">{showCredentials.mot_de_passe}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(showCredentials.mot_de_passe)}
                    className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold"
                  >
                    Copier
                  </button>
                </div>
              </div>

              {showCredentials.note && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Note</p>
                  <p className="text-xs text-slate-600">{showCredentials.note}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                window.open(showCredentials.url, '_blank')
                setShowCredentials(null)
              }}
              className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm mb-2"
            >
              🌐 Ouvrir le site extranet
            </button>
            <button
              onClick={() => setShowCredentials(null)}
              className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-xl text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier l\'extranet' : 'Nouvel extranet'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du grossiste *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: CAMED SA"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL du site *</label>
                <input
                  value={form.url}
                  onChange={(e) => set('url', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: www.camed.ml"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identifiant</label>
                <input
                  value={form.identifiant}
                  onChange={(e) => set('identifiant', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Identifiant de connexion"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe</label>
                <input
                  value={form.mot_de_passe}
                  onChange={(e) => set('mot_de_passe', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Mot de passe extranet"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Note</label>
                <textarea
                  value={form.note}
                  onChange={(e) => set('note', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Informations supplémentaires..."
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

      {/* Liste extranets */}
      <div className="p-6 flex flex-col gap-3">
        {extranets.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🌐</p>
            <p className="text-slate-400 text-sm">Aucun extranet configuré</p>
            {profile.role === 'manager' && (
              <p className="text-slate-300 text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer</p>
            )}
          </div>
        ) : (
          extranets.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-950 flex items-center justify-center font-black text-teal-400 text-lg flex-shrink-0">
                  {e.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-blue-950">{e.nom}</p>
                  <p className="text-xs text-slate-400 truncate">{e.url}</p>
                  {e.identifiant && (
                    <p className="text-xs text-teal-500 font-bold mt-0.5">🔑 Identifiants configurés</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {profile.role === 'manager' && (
                    <>
                      <button onClick={() => handleEdit(e)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                      <button onClick={() => handleDelete(e.id)} className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleOpen(e)}
                className="w-full mt-3 bg-blue-950 text-white font-black py-3 rounded-xl text-sm hover:bg-blue-900 transition-colors"
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