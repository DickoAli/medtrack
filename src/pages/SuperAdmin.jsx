import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import GestionAgences from './GestionAgences'
import Fichiers from './Fichiers'

export default function SuperAdmin({ session, profile }) {
  const [stats, setStats] = useState({ agences: 0, delegates: 0, visites: 0 })
  const [demandes, setDemandes] = useState([])
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(null)

  useEffect(() => {
    fetchStats()
    fetchDemandes()
  }, [])

  const fetchStats = async () => {
    const { count: agences } = await supabase.from('agences').select('*', { count: 'exact', head: true })
    const { count: delegates } = await supabase.from('delegates').select('*', { count: 'exact', head: true })
    const { count: visites } = await supabase.from('visites').select('*', { count: 'exact', head: true })
    setStats({ agences: agences || 0, delegates: delegates || 0, visites: visites || 0 })
    setLoading(false)
  }

  const fetchDemandes = async () => {
    const { data } = await supabase
      .from('demandes_reset')
      .select('*')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
    setDemandes(data || [])
  }

  const handleReset = async (demande) => {
    if (!newPassword || newPassword.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setResetting(demande.id)

    await supabase.rpc('reset_user_password_by_email', {
      user_email: demande.email,
      new_password: newPassword
    })

    await supabase.from('demandes_reset').update({ statut: 'traite' }).eq('id', demande.id)

    setResetting(null)
    setNewPassword('')
    fetchDemandes()
    alert(`✅ Mot de passe réinitialisé pour ${demande.email}`)
  }

  if (page === 'agences') return <GestionAgences onBack={() => setPage('dashboard')} profile={profile} />
  if (page === 'fichiers') return <Fichiers profile={profile} onBack={() => setPage('dashboard')} />

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">Super Admin</p>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs"
        >
          Déconnexion
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connecté en tant que</p>
          <p className="font-black text-blue-950 mt-1">{session.user.email}</p>
          <p className="text-xs text-teal-500 font-bold mt-1">Super Administrateur</p>
        </div>

        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{stats.agences}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Agences</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{stats.delegates}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Délégués</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
              <p className="text-2xl font-black text-blue-950">{stats.visites}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites</p>
            </div>
          </div>
        )}

        {/* Demandes de reset */}
        {demandes.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-black text-blue-950 uppercase tracking-wider">🔑 Demandes de réinitialisation</p>
              <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{demandes.length}</span>
            </div>
            {demandes.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-xl p-3 mb-3">
                <p className="font-bold text-blue-950 text-sm">{d.email}</p>
                <p className="text-xs text-slate-400 mb-3">
                  Demandé le {new Date(d.created_at).toLocaleDateString('fr-FR')} à {new Date(d.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nouveau mot de passe..."
                    value={resetting === d.id ? newPassword : ''}
                    onChange={(e) => { setResetting(d.id); setNewPassword(e.target.value) }}
                    className="flex-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                  <button
                    onClick={() => handleReset(d)}
                    className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setPage('agences')}
          className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm hover:bg-blue-900 transition-colors"
        >
          🏢 Gérer les agences
        </button>

        <button
          onClick={() => setPage('fichiers')}
          className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm hover:bg-emerald-500 transition-colors"
        >
          📊 Déposer des fichiers stats
        </button>
      </div>
    </div>
  )
}