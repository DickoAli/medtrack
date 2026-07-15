import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('Remplissez tous les champs'); return }
    setLoading(true)
    setError('')

    // Vérifier si le compte est bloqué ou désactivé
    const { data: profileData } = await supabase
      .from('profiles')
      .select('actif, tentatives_connexion, bloque_at')
      .eq('id', (await supabase.auth.signInWithPassword({ email, password }))?.data?.user?.id || '')
      .single()

    // Tentative de connexion
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      // Récupérer le profil par email
      const { data: users } = await supabase
        .from('profiles')
        .select('id, tentatives_connexion, actif, bloque_at')
        .eq('id', (
          await supabase.from('delegates').select('id').eq('email', email).single()
        )?.data?.id || '')

      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    if (!data.user) { setError('Erreur de connexion'); setLoading(false); return }

    // Vérifier le profil après connexion
    const { data: profile } = await supabase
      .from('profiles')
      .select('actif, tentatives_connexion, bloque_at')
      .eq('id', data.user.id)
      .single()

    if (!profile) { setLoading(false); return }

    // Compte désactivé
    if (profile.actif === false) {
      await supabase.auth.signOut()
      setError('Votre compte a été désactivé. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    // Compte bloqué après 3 tentatives
    if (profile.tentatives_connexion >= 3) {
      await supabase.auth.signOut()
      setError('Compte bloqué après 3 tentatives. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    // Connexion réussie — réinitialiser les tentatives
    await supabase
      .from('profiles')
      .update({ tentatives_connexion: 0 })
      .eq('id', data.user.id)

    setLoading(false)
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
        </div>
      </div>
    </div>
  )
}