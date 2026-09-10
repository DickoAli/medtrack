import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseSecondary = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: 'supabase-secondary',
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default function GestionAgences({ onBack, profile }) {
  const [agences, setAgences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [showDaysForm, setShowDaysForm] = useState(null)
  const [customDays, setCustomDays] = useState(30)
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', adresse: '', pays: 'Mali',
    manager_email: '', manager_password: '', duree_essai: 15
  })

  useEffect(() => { fetchAgences() }, [])

  const fetchAgences = async () => {
    const { data } = await supabase
      .from('agences')
      .select('*')
      .order('created_at', { ascending: false })
    setAgences(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const modifierDuree = async (id, jours) => {
    const { data: agence } = await supabase
      .from('agences')
      .select('date_expiration')
      .eq('id', id)
      .single()

    const baseDate = new Date(agence.date_expiration) > new Date()
      ? new Date(agence.date_expiration)
      : new Date()

    baseDate.setDate(baseDate.getDate() + Number(jours))

    await supabase.from('agences').update({
      date_expiration: baseDate.toISOString(),
      essai_actif: false
    }).eq('id', id)

    setShowDaysForm(null)
    setCustomDays(30)
    setSuccessMsg(`Durée modifiée de ${jours > 0 ? '+' : ''}${jours} jours !`)
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAgences()
  }

  const handleSave = async () => {
    if (!form.nom) { alert('Le nom de l\'agence est obligatoire'); return }
    setSaving(true)

    if (editing) {
      await supabase.from('agences').update({
        nom: form.nom, email: form.email,
        telephone: form.telephone, adresse: form.adresse, pays: form.pays
      }).eq('id', editing)
    } else {
      if (!form.manager_email) { alert('L\'email du manager est obligatoire'); setSaving(false); return }

      const { data: agenceData } = await supabase
        .from('agences')
        .insert({
          nom: form.nom, email: form.email,
          telephone: form.telephone, adresse: form.adresse, pays: form.pays,
          date_expiration: new Date(Date.now() + Number(form.duree_essai) * 24 * 60 * 60 * 1000).toISOString(),
          essai_actif: true
        })
        .select()
        .single()

      if (!agenceData) { alert('Erreur lors de la création'); setSaving(false); return }

      const { data: authData, error: authError } = await supabaseSecondary.auth.signUp({
        email: form.manager_email,
        password: form.manager_password || 'manager123',
      })

      if (authError) { alert('Erreur: ' + authError.message); setSaving(false); return }

      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          role: 'manager',
          agence_id: agenceData.id
        })
      }

      await supabaseSecondary.auth.signOut()
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ nom: '', email: '', telephone: '', adresse: '', pays: 'Mali', manager_email: '', manager_password: '', duree_essai: 15 })
    setSuccessMsg(editing ? 'Agence modifiée !' : 'Agence créée avec succès !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAgences()
  }

  const handleEdit = (a) => {
    setEditing(a.id)
    setForm({
      nom: a.nom, email: a.email || '', telephone: a.telephone || '',
      adresse: a.adresse || '', pays: a.pays || 'Mali',
      manager_email: '', manager_password: '', duree_essai: 15
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette agence ? Toutes ses données seront perdues.')) return
    await supabase.from('agences').delete().eq('id', id)
    fetchAgences()
  }

  const getExpirationInfo = (agence) => {
    if (!agence.date_expiration) return null
    const expiration = new Date(agence.date_expiration)
    const maintenant = new Date()
    const joursRestants = Math.ceil((expiration - maintenant) / (1000 * 60 * 60 * 24))
    return { expiration, joursRestants, estExpire: expiration < maintenant }
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
          <h1 className="text-white font-semibold text-base">Gestion des agences</h1>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditing(null)
            setForm({ nom: '', email: '', telephone: '', adresse: '', pays: 'Mali', manager_email: '', manager_password: '', duree_essai: 15 })
          }}
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
              {editing ? 'Modifier l\'agence' : 'Nouvelle agence'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
                <input value={form.nom} onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="Ex: PharmaCare Mali" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Pays</label>
                <input value={form.pays} onChange={(e) => set('pays', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="Mali" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="contact@agence.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
                <input value={form.telephone} onChange={(e) => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="00223XXXXXXXX" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Adresse</label>
                <textarea value={form.adresse} onChange={(e) => set('adresse', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] h-16 resize-none" />
              </div>

              {!editing && (
                <>
                  <div className="border-t border-[#DDE4EA] pt-4">
                    <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">Compte Manager</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Durée d'essai (jours)</label>
                    <input
                      type="number"
                      value={form.duree_essai}
                      onChange={(e) => set('duree_essai', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                      min="1" max="365"
                    />
                    <p className="text-xs text-[#98A2B3] mt-1">Par défaut : 15 jours</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email manager *</label>
                    <input type="email" value={form.manager_email} onChange={(e) => set('manager_email', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="manager@agence.com" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mot de passe manager</label>
                    <input type="password" value={form.manager_password} onChange={(e) => set('manager_password', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" placeholder="Par défaut: manager123" />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? 'Création...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3">
        {agences.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-[#667085] text-sm font-medium">Aucune agence enregistrée</p>
          </div>
        ) : (
          agences.map((a) => {
            const exp = getExpirationInfo(a)
            const borderColor = exp?.estExpire ? '#DC2626' : exp?.joursRestants <= 3 ? '#F59E0B' : '#087F5B'
            return (
              <div key={a.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${borderColor}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-[#172B4D] flex items-center justify-center font-semibold text-[#087F5B] text-lg flex-shrink-0">
                      {a.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#172B4D]">{a.nom}</p>
                      <p className="text-xs text-[#667085]">{a.pays}</p>
                      {a.email && <p className="text-xs text-[#667085]">✉️ {a.email}</p>}
                      {a.telephone && <p className="text-xs text-[#667085]">📞 {a.telephone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(a)} className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                    <button onClick={() => handleDelete(a.id)} className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
                  </div>
                </div>

                {exp && (
                  <div className="mt-3">
                    {exp.estExpire ? (
                      <p className="text-xs font-semibold text-[#DC2626]">
                        ⛔ Expiré le {exp.expiration.toLocaleDateString('fr-FR')}
                      </p>
                    ) : exp.joursRestants <= 3 ? (
                      <p className="text-xs font-semibold text-[#B45309]">
                        ⚠️ Expire dans {exp.joursRestants} jour(s)
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-[#087F5B]">
                        ✅ Expire le {exp.expiration.toLocaleDateString('fr-FR')} ({exp.joursRestants} jours restants)
                      </p>
                    )}

                    {showDaysForm === a.id ? (
                      <div className="flex gap-2 items-center mt-2">
                        <input
                          type="number"
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          className="flex-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                          placeholder="Jours (négatif pour réduire)"
                        />
                        <button
                          onClick={() => modifierDuree(a.id, customDays)}
                          className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setShowDaysForm(null)}
                          className="bg-[#EEF1F4] text-[#667085] px-3 py-2 rounded-lg text-xs font-semibold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowDaysForm(a.id); setCustomDays(30) }}
                        className="mt-2 bg-[#E7F5EF] text-[#087F5B] px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        ✏️ Modifier la durée
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
