import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionDelegues({ onBack }) {
  const [delegues, setDelegues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    prenom: '', nom: '', email: '', telephone: '', zone: '', password: ''
  })

  useEffect(() => {
    fetchDelegues()
  }, [])

  const fetchDelegues = async () => {
    const { data } = await supabase
      .from('delegates')
      .select('*')
      .order('created_at', { ascending: false })
    setDelegues(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Créer compte auth
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: form.email,
  password: form.password || 'delegue123',
})

if (authError) {
  alert('Erreur: ' + authError.message)
  setSaving(false)
  return
}

// Créer délégué
const { data: delegueData } = await supabase
  .from('delegates')
  .insert({ prenom: form.prenom, nom: form.nom, email: form.email, telephone: form.telephone, zone: form.zone })
  .select()
  .single()

// Créer profil lié
if (authData.user && delegueData) {
  await supabase.from('profiles').insert({
    id: authData.user.id,
    role: 'delegue',
    delegate_id: delegueData.id
  })
}

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ prenom: '', nom: '', email: '', telephone: '', zone: '', password: '' })
    fetchDelegues()
  }

  const handleEdit = (d) => {
    setEditing(d.id)
    setForm({ prenom: d.prenom, nom: d.nom, email: d.email, telephone: d.telephone || '', zone: d.zone || '', password: '' })
    setShowForm(true)
  }

  const handleDelete = async (d) => {
    if (!confirm(`Supprimer ${d.prenom} ${d.nom} ?`)) return
    await supabase.from('delegates').delete().eq('id', d.id)
    fetchDelegues()
  }

  const ZONES = ['Alger Centre', 'Blida', 'Bab Ezzouar', 'Hussein Dey', 'Oran', 'Constantine', 'Autre']

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
          <h1 className="text-white font-black">Gestion des délégués</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ prenom: '', nom: '', email: '', telephone: '', zone: '', password: '' }) }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier le délégué' : 'Nouveau délégué'}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prénom *</label>
                  <input
                    value={form.prenom}
                    onChange={(e) => set('prenom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                  <input
                    value={form.nom}
                    onChange={(e) => set('nom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nom"
                  />
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="email@exemple.com"
                  />
                </div>
              )}

              {!editing && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Par défaut: delegue123"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input
                  value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="0550000000"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zone</label>
                <select
                  value={form.zone}
                  onChange={(e) => set('zone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                >
                  <option value="">Sélectionner une zone</option>
                  {ZONES.map((z) => <option key={z}>{z}</option>)}
                </select>
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

      {/* Liste délégués */}
      <div className="p-6 flex flex-col gap-3">
        {delegues.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucun délégué enregistré</p>
          </div>
        ) : (
          delegues.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center font-black text-teal-600 text-lg flex-shrink-0">
                  {d.prenom?.[0]}{d.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-blue-950">{d.prenom} {d.nom}</p>
                  <p className="text-xs text-slate-400">{d.email}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {d.zone && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                        {d.zone}
                      </span>
                    )}
                    {d.telephone && (
                      <span className="text-xs text-slate-400">{d.telephone}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(d)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
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