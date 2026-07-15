import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionComptes({ onBack, profile }) {
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [showPasswordForm, setShowPasswordForm] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchComptes() }, [])

  const fetchComptes = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, delegates(*)')
      .eq('agence_id', profile.agence_id)
      .eq('role', 'delegue')
      .order('created_at', { ascending: false })
    setComptes(data || [])
    setLoading(false)
  }

  const toggleActif = async (compte) => {
    setSaving(compte.id)
    await supabase
      .from('profiles')
      .update({ actif: !compte.actif })
      .eq('id', compte.id)
    setSaving(null)
    setSuccessMsg(compte.actif ? 'Compte désactivé' : 'Compte activé')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchComptes()
  }

  const debloquer = async (compte) => {
    setSaving(compte.id)
    await supabase
      .from('profiles')
      .update({ tentatives_connexion: 0, bloque_at: null })
      .eq('id', compte.id)
    setSaving(null)
    setSuccessMsg('Compte débloqué !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchComptes()
  }

  const changerMotDePasse = async (compteId) => {
    if (!newPassword || newPassword.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setSaving(compteId)
    const { error } = await supabase.auth.admin.updateUserById(compteId, {
      password: newPassword
    })
    if (error) {
      // Fallback — utiliser la fonction RPC
      await supabase.rpc('reset_user_password', {
        user_id: compteId,
        new_password: newPassword
      })
    }
    setSaving(null)
    setShowPasswordForm(null)
    setNewPassword('')
    setSuccessMsg('Mot de passe modifié !')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-black">Gestion des comptes</h1>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-6 flex flex-col gap-3">
        {comptes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Aucun compte délégué</p>
          </div>
        ) : (
          comptes.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${c.actif ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                  {c.delegates?.prenom?.[0]}{c.delegates?.nom?.[0]}
                </div>
                <div className="flex-1">
                  <p className="font-black text-blue-950">{c.delegates?.prenom} {c.delegates?.nom}</p>
                  <p className="text-xs text-slate-400">{c.delegates?.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.actif ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                    {c.actif ? 'Actif' : 'Inactif'}
                  </span>
                  {c.tentatives_connexion >= 3 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-500">
                      Bloqué
                    </span>
                  )}
                </div>
              </div>

              {c.tentatives_connexion > 0 && (
                <p className="text-xs text-amber-500 font-bold mb-2">
                  ⚠️ {c.tentatives_connexion} tentative(s) échouée(s)
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => toggleActif(c)}
                  disabled={saving === c.id}
                  className={`px-3 py-2 rounded-xl text-xs font-black ${c.actif ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600'}`}
                >
                  {saving === c.id ? '...' : c.actif ? '🔒 Désactiver' : '✅ Activer'}
                </button>

                {c.tentatives_connexion >= 3 && (
                  <button
                    onClick={() => debloquer(c)}
                    disabled={saving === c.id}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-amber-50 text-amber-600"
                  >
                    🔓 Débloquer
                  </button>
                )}

                <button
                  onClick={() => { setShowPasswordForm(c.id); setNewPassword('') }}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-blue-50 text-blue-600"
                >
                  🔑 Mot de passe
                </button>
              </div>

              {showPasswordForm === c.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nouveau mot de passe..."
                  />
                  <button
                    onClick={() => changerMotDePasse(c.id)}
                    disabled={saving === c.id}
                    className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black"
                  >
                    {saving === c.id ? '...' : 'OK'}
                  </button>
                  <button
                    onClick={() => setShowPasswordForm(null)}
                    className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl text-xs font-black"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}