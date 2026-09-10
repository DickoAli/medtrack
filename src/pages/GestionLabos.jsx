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
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <h1 className="text-white font-semibold text-base">Laboratoires</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ nom: '', pays: 'Mali', telephone: '', email: '', adresse: '' }) }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs"
        >
          + Ajouter
        </button>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-4 text-center">
          <p className="text-[#087F5B] font-semibold">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier le laboratoire' : 'Nouveau laboratoire'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom du laboratoire *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Sanofi, Pfizer..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Pays</label>
                <input
                  value={form.pays}
                  onChange={(e) => set('pays', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Mali"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
                <input
                  value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="00223XXXXXXXX"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="contact@labo.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Adresse</label>
                <textarea
                  value={form.adresse}
                  onChange={(e) => set('adresse', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none"
                  placeholder="Adresse du laboratoire..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm"
                >
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3">
        {labos.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-[#667085] text-sm font-medium">Aucun laboratoire enregistré</p>
            <p className="text-[#98A2B3] text-xs mt-1">Cliquez sur "+ Ajouter" pour commencer</p>
          </div>
        ) : (
          labos.map((l) => (
            <div key={l.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-[#172B4D] flex items-center justify-center font-semibold text-[#087F5B] text-lg flex-shrink-0">
                    {l.nom?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#172B4D]">{l.nom}</p>
                    <p className="text-xs text-[#667085]">{l.pays}</p>
                    {l.telephone && <p className="text-xs text-[#667085]">📞 {l.telephone}</p>}
                    {l.email && <p className="text-xs text-[#667085]">✉️ {l.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(l)} className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                  <button onClick={() => handleDelete(l.id)} className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
