import { useState } from 'react'
import { supabase } from '../supabase'
import GestionAgences from './GestionAgences'

export default function SuperAdmin({ session }) {
  const [page, setPage] = useState('dashboard')

  if (page === 'agences') return (
    <GestionAgences onBack={() => setPage('dashboard')} />
  )

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

        <button
          onClick={() => setPage('agences')}
          className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm hover:bg-blue-900 transition-colors"
        >
          🏢 Gérer les agences
        </button>
      </div>
    </div>
  )
}