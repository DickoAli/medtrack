import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionLabos({ onBack, profile }) {
  const [labos, setLabos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    nom: '', pays: 'Mali', telephone: '', email: '', adresse: ''
  })

  useEffect(() => { fetchLabos() }, [])

  const fetchLabos = async () => {
    const { data } = await supabase
      .from('laboratoires')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .order('nom')
    setLabos(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom est obligatoire'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('laboratoires').update(form).eq('id', editing)
    } else {
      await supabase.from('laboratoires').insert({
        ...form,
        agence_id: profile.agence_id
      })
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', pays: 'Mali', telephone: '', email: '', adresse: '' })
    setSuccessMsg('Laboratoire enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchLabos()
  }

  const handleEdit = (l) => {
    setEditing(l.id)
    setForm({ nom: l.nom, pays: l.pays || 'Mali', telephone: l.telephone || '', email: l.email || '', adresse: l.adresse || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce laboratoire ?')) return
    await supabase.from('laboratoires').delete().eq('id', id)
    fetchLabos()
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
          <h1 className="text-white font-black">Laboratoires</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ nom: '', pays: 'Mali', telephone: '', email: '', adresse: '' }) }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier le laboratoire' : 'Nouveau laboratoire'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom du laboratoire *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Sanofi, Pfizer..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pays</label>
                <input
                  value={form.pays}
                  onChange={(e) => set('pays', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Mali"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input
                  value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="00223XXXXXXXX"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="contact@labo.com"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adresse</label>
                <textarea
                  value={form.adresse}
                  onChange={(e) => set('adresse', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Adresse du laboratoire..."
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

      <div className="p-6 flex flex-col gap-3">
        {labos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucun laboratoire enregistré</p>
            <p className="text-slate-300 text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer</p>
          </div>
        ) : (
          labos.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-blue-950 flex items-center justify-center font-black text-teal-400 text-lg flex-shrink-0">
                    {l.nom?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-blue-950">{l.nom}</p>
                    <p className="text-xs text-slate-400">{l.pays}</p>
                    {l.telephone && <p className="text-xs text-slate-400">📞 {l.telephone}</p>}
                    {l.email && <p className="text-xs text-slate-400">✉️ {l.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(l)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(l.id)} className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}