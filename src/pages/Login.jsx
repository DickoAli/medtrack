import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#172B4D] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2 text-[#087F5B]">⚕</div>
          <h1 className="text-2xl font-semibold text-[#172B4D]">MedTrack</h1>
          <p className="text-[#667085] text-sm mt-1">Connectez-vous pour continuer</p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] focus:outline-none focus:border-[#087F5B]"
              placeholder="votre@email.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D] focus:outline-none focus:border-[#087F5B] pr-12"
                placeholder="••••••••"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] text-lg"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#FDE8E8] border border-[#DC2626]/20 rounded-lg p-3">
              <p className="text-[#DC2626] text-xs font-semibold text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm mt-2 hover:bg-[#066A4B] transition-colors"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
