import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DelegueApp from './pages/DelegueApp'
import SuperAdmin from './pages/SuperAdmin'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [agence, setAgence] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, delegates(*)')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data?.agence_id) {
      const { data: agenceData } = await supabase
        .from('agences')
        .select('*')
        .eq('id', data.agence_id)
        .single()
      setAgence(agenceData)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
        setAgence(null)
      }
    })

    // Déconnexion automatique après 15 min d'inactivité
    let inactivityTimer
    const resetTimer = () => {
      clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(async () => {
        await supabase.auth.signOut()
      }, 15 * 60 * 1000)
    }
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(inactivityTimer)
      events.forEach(e => window.removeEventListener(e, resetTimer))
      subscription.unsubscribe()
    }
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement...</p>
    </div>
  )

  if (!session) return <Login />

  if (!profile) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement du profil...</p>
    </div>
  )

  if (agence && profile.role_global !== 'superadmin') {
    const expiration = new Date(agence.date_expiration)
    const maintenant = new Date()
    if (expiration < maintenant) {
      return (
        <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="text-5xl mb-4">⏰</div>
            <h1 className="text-xl font-black text-blue-950 mb-2">Accès expiré</h1>
            <p className="text-slate-400 text-sm mb-4">
              Votre période d'essai est terminée.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500">Expirée le</p>
              <p className="font-black text-rose-500">
                {expiration.toLocaleDateString('fr-FR')}
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Contactez l'administrateur MedTrack pour réactiver votre accès.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-xl text-sm"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )
    }
  }

  if (profile.role_global === 'superadmin') return <SuperAdmin session={session} profile={profile} />
  if (profile.role === 'manager') return <Dashboard session={session} profile={profile} agence={agence} />
  if (profile.role === 'delegue') return <DelegueApp session={session} profile={profile} />

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-red-400 font-bold">Rôle non reconnu</p>
    </div>
  )
}