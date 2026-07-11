import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DelegueApp from './pages/DelegueApp'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, delegates(*)')
      .eq('id', userId)
      .single()
    console.log('profil chargé dans App:', data)
    setProfile(data)
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
      }
    })

    return () => subscription.unsubscribe()
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

  if (profile.role === 'manager') return <Dashboard session={session} profile={profile} />
  if (profile.role === 'delegue') return <DelegueApp session={session} profile={profile} />

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <p className="text-red-400 font-bold">Rôle non reconnu</p>
    </div>
  )
}