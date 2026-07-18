import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('Remplissez tous les champs'); return }
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    if (!data.user) { setError('Erreur de connexion'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('actif, tentatives_connexion')
      .eq('id', data.user.id)
      .single()

    if (!profile) { setLoading(false); return }

    if (profile.actif === false) {
      await supabase.auth.signOut()
      setError('Votre compte a été désactivé. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    if (profile.tentatives_connexion >= 3) {
      await supabase.auth.signOut()
      setError('Compte bloqué après 3 tentatives. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    await supabase
      .from('profiles')
      .update({ tentatives_connexion: 0 })
      .eq('id', data.user.id)

    setLoading(false)
  }

  const handleResetRequest = async () => {
    if (!resetEmail) { alert('Entrez votre email'); return }
    setResetLoading(true)

    // Vérifier que l'email existe
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, agence_id, role')
      .eq('id', (
        await supabase.auth.signInWithPassword({ email: resetEmail, password: 'wrong' })
      )?.data?.user?.id || '')
      .single()

    // Créer la demande de reset
    await supabase.from('demandes_reset').insert({
      email: resetEmail,
      statut: 'en_attente'
    })

    setResetLoading(false)
    setResetSuccess(true)
  }

  if (showReset) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <button
            onClick={() => { setShowReset(false); setResetSuccess(false); setResetEmail('') }}
            className="text-slate-400 text-sm mb-4 flex items-center gap-1"
          >
            ← Retour
          </button>

          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔑</div>
            <h1 className="text-xl font-black text-blue-950">Mot de passe oublié</h1>
            <p className="text-slate-400 text-sm mt-1">
              Une demande sera envoyée à l'administrateur
            </p>
          </div>

          {resetSuccess ? (
            <div className="text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-black text-blue-950 mb-2">Demande envoyée !</p>
              <p className="text-slate-400 text-sm mb-6">
                L'administrateur va réinitialiser votre mot de passe et vous contacter.
              </p>
              <button
                onClick={() => { setShowReset(false); setResetSuccess(false); setResetEmail('') }}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Votre email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="votre@email.com"
                />
              </div>
              <button
                onClick={handleResetRequest}
                disabled={resetLoading}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm"
              >
                {resetLoading ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚕</div>
          <h1 className="text-2xl font-black text-blue-950">MedTrack</h1>
          <p className="text-slate-400 text-sm mt-1">Connectez-vous pour continuer</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-teal-400"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-teal-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-rose-500 text-xs font-bold text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm mt-2 hover:bg-teal-300 transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <button
            onClick={() => setShowReset(true)}
            className="text-slate-400 text-xs text-center hover:text-teal-500 transition-colors"
          >
            Mot de passe oublié ?
          </button>
        </div>
      </div>
    </div>
  )
}