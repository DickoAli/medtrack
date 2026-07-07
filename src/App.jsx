import { useState, useEffect } from 'react'
import { supabase, getProfile } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DelegueApp from './pages/DelegueApp'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const p = await getProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        const p = await getProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-teal-400 font-bold">Chargement...</p>
    </div>
  )

  if (!session) return <Login />

  if (profile?.role === 'manager') return <Dashboard session={session} profile={profile} />
  if (profile?.role === 'delegue') return <DelegueApp session={session} profile={profile} />

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-red-400 font-bold">Profil introuvable — contactez l'administrateur</p>
    </div>
  )
}