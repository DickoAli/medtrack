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
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', adresse: '', pays: 'Mali',
    manager_email: '', manager_password: ''
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

  const prolonger = async (id) => {
    const { data: agence } = await supabase
      .from('agences')
      .select('date_expiration')
      .eq('id', id)
      .single()

    const baseDate = new Date(agence.date_expiration) > new Date()
      ? new Date(agence.date_expiration)
      : new Date()

    baseDate.setDate(baseDate.getDate() + 30)

    await supabase.from('agences').update({
      date_expiration: baseDate.toISOString(),
      essai_actif: false
    }).eq('id', id)

    setSuccessMsg('Accès prolongé de 30 jours !')
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

      // Créer l'agence avec 15 jours d'essai
      const { data: agenceData } = await supabase
        .from('agences')
        .insert({
          nom: form.nom, email: form.email,
          telephone: form.telephone, adresse: form.adresse, pays: form.pays,
          date_expiration: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          essai_actif: true
        })
        .select()
        .single()

      if (!agenceData) { alert('Erreur lors de la création'); setSaving(false); return }

      // Créer le compte manager
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
    setForm({ nom: '', email: '', telephone: '', adresse: '', pays: 'Mali', manager_email: '', manager_password: '' })
    setSuccessMsg(editing ? 'Agence modifiée !' : 'Agence créée avec succès !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAgences()
  }

  const handleEdit = (a) => {
    setEditing(a.id)
    setForm({
      nom: a.nom, email: a.email || '', telephone: a.telephone || '',
      adresse: a.adresse || '', pays: a.pays || 'Mali',
      manager_email: '', manager_password: ''
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
    const estExpire = expiration < maintenant
    return { expiration, joursRestants, estExpire }
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
          <h1 className="text-white font-black">Gestion des agences</h1>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditing(null)
            setForm({ nom: '', email: '', telephone: '', adresse: '', pays: 'Mali', manager_email: '', manager_password: '' })
          }}
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
              {editing ? 'Modifier l\'agence' : 'Nouvelle agence'}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom de l'agence *</label>
                <input
                  value={form.nom}
                  onChange={(e) => set('nom', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: PharmaCare Mali"
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="contact@agence.com"
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adresse</label>
                <textarea
                  value={form.adresse}
                  onChange={(e) => set('adresse', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Adresse de l'agence..."
                />
              </div>

              {!editing && (
                <>
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
                      Compte Manager
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                      <p className="text-xs text-amber-600 font-bold">
                        ⏱️ L'agence aura 15 jours d'essai gratuit
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email manager *</label>
                    <input
                      type="email"
                      value={form.manager_email}
                      onChange={(e) => set('manager_email', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="manager@agence.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe manager</label>
                    <input
                      type="password"
                      value={form.manager_password}
                      onChange={(e) => set('manager_password', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                      placeholder="Par défaut: manager123"
                    />
                  </div>
                </>
              )}

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
                  {saving ? 'Création...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col gap-3">
        {agences.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucune agence enregistrée</p>
          </div>
        ) : (
          agences.map((a) => {
            const exp = getExpirationInfo(a)
            return (
              <div key={a.id} className={`bg-white rounded-2xl p-4 border-l-4 ${exp?.estExpire ? 'border-rose-400' : exp?.joursRestants <= 3 ? 'border-amber-400' : 'border-teal-400'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-blue-950 flex items-center justify-center font-black text-teal-400 text-lg flex-shrink-0">
                      {a.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-blue-950">{a.nom}</p>
                      <p className="text-xs text-slate-400">{a.pays}</p>
                      {a.email && <p className="text-xs text-slate-400">✉️ {a.email}</p>}
                      {a.telephone && <p className="text-xs text-slate-400">📞 {a.telephone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(a)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                    <button onClick={() => handleDelete(a.id)} className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                  </div>
                </div>

                {/* Expiration */}
                {exp && (
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      {exp.estExpire ? (
                        <p className="text-xs font-bold text-rose-500">
                          ⛔ Expiré le {exp.expiration.toLocaleDateString('fr-FR')}
                        </p>
                      ) : exp.joursRestants <= 3 ? (
                        <p className="text-xs font-bold text-amber-500">
                          ⚠️ Expire dans {exp.joursRestants} jour(s)
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-teal-500">
                          ✅ Expire le {exp.expiration.toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      {a.essai_actif && (
                        <p className="text-xs text-slate-400 mt-0.5">Période d'essai</p>
                      )}
                    </div>
                    <button
                      onClick={() => prolonger(a.id)}
                      className="bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg text-xs font-black"
                    >
                      +30 jours
                    </button>
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