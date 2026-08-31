import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import GestionAgences from './GestionAgences'
import Fichiers from './Fichiers'

export default function SuperAdmin({ session, profile }) {
  const [stats, setStats] = useState({ agences: 0, delegates: 0, visites: 0, visitesToday: 0 })
  const [demandes, setDemandes] = useState([])
  const [agences, setAgences] = useState([])
  const [labos, setLabos] = useState([])
  const [recentVisites, setRecentVisites] = useState([])
  const [page, setPage] = useState('dashboard')
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [showLaboForm, setShowLaboForm] = useState(false)
  const [savingLabo, setSavingLabo] = useState(false)
  const [laboForm, setLaboForm] = useState({
    email: '', password: '', laboratoire_id: '', agence_id: ''
  })

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    setRefreshing(true)
    const todayStr = new Date().toISOString().slice(0, 10)

    const [
      { count: agencesCount },
      { count: delegatesCount },
      { count: visitesCount },
      { count: visitesTodayCount },
      { data: demandesData },
      { data: agencesData },
      { data: labosData },
      { data: recentData },
    ] = await Promise.all([
      supabase.from('agences').select('*', { count: 'exact', head: true }),
      supabase.from('delegates').select('*', { count: 'exact', head: true }),
      supabase.from('visites').select('*', { count: 'exact', head: true }),
      supabase.from('visites').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('demandes_reset').select('*').eq('statut', 'en_attente').order('created_at', { ascending: false }),
      supabase.from('agences').select('*').order('created_at', { ascending: false }),
      supabase.from('laboratoires').select('*, agences(nom)').order('nom'),
      supabase.from('visites').select('*, delegates(nom, prenom), agences(nom)').order('created_at', { ascending: false }).limit(10),
    ])

    setStats({
      agences: agencesCount || 0,
      delegates: delegatesCount || 0,
      visites: visitesCount || 0,
      visitesToday: visitesTodayCount || 0
    })
    setDemandes(demandesData || [])
    setAgences(agencesData || [])
    setLabos(labosData || [])
    setRecentVisites(recentData || [])
    setRefreshing(false)
    setLoading(false)
    setLastRefresh(new Date())
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
    fetchAll()
    alert(`✅ Mot de passe réinitialisé pour ${demande.email}`)
  }

  const handleCreateLaboAccount = async () => {
    if (!laboForm.email || !laboForm.password || !laboForm.laboratoire_id || !laboForm.agence_id) {
      alert('Tous les champs sont obligatoires')
      return
    }
    setSavingLabo(true)
    const { data: authData, error } = await supabase.auth.signUp({
      email: laboForm.email,
      password: laboForm.password
    })
    if (error) { alert('Erreur: ' + error.message); setSavingLabo(false); return }
    if (authData.user) {
      await supabase.from('profiles').insert({
        id: authData.user.id,
        role: 'client_labo',
        agence_id: laboForm.agence_id,
        laboratory_id: laboForm.laboratoire_id,
        actif: true
      })
    }
    setSavingLabo(false)
    setShowLaboForm(false)
    setLaboForm({ email: '', password: '', laboratoire_id: '', agence_id: '' })
    setSuccessMsg('Compte laboratoire créé !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const getExpirationInfo = (agence) => {
    if (!agence.date_expiration) return null
    const expiration = new Date(agence.date_expiration)
    const maintenant = new Date()
    const joursRestants = Math.ceil((expiration - maintenant) / (1000 * 60 * 60 * 24))
    return { expiration, joursRestants, estExpire: expiration < maintenant }
  }

  if (page === 'agences') return <GestionAgences onBack={() => setPage('dashboard')} profile={profile} />
  if (page === 'fichiers') return <Fichiers profile={profile} onBack={() => setPage('dashboard')} />

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <button onClick={fetchAll} disabled={refreshing}
              className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl font-bold text-xs">
              {refreshing ? '...' : '🔄'}
            </button>
            <p className="text-teal-400 text-xs mt-0.5">
              {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs">
            Déconnexion
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'overview', label: '📊 Vue globale' },
          { id: 'agences', label: '🏢 Agences' },
          { id: 'activite', label: '📍 Activité' },
          { id: 'actions', label: '⚙️ Actions' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${
              tab === t.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Modal compte labo */}
      {showLaboForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-black text-blue-950 text-lg mb-4">Nouveau compte laboratoire</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agence *</label>
                <select value={laboForm.agence_id}
                  onChange={e => setLaboForm(f => ({ ...f, agence_id: e.target.value, laboratoire_id: '' }))}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner une agence...</option>
                  {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Laboratoire *</label>
                <select value={laboForm.laboratoire_id}
                  onChange={e => setLaboForm(f => ({ ...f, laboratoire_id: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner un laboratoire...</option>
                  {labos.filter(l => !laboForm.agence_id || l.agence_id === laboForm.agence_id)
                    .map(l => <option key={l.id} value={l.id}>{l.nom} — {l.agences?.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                <input type="email" value={laboForm.email}
                  onChange={e => setLaboForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="contact@laboratoire.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe *</label>
                <input type="password" value={laboForm.password}
                  onChange={e => setLaboForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Min. 6 caractères" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowLaboForm(false); setLaboForm({ email: '', password: '', laboratoire_id: '', agence_id: '' }) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleCreateLaboAccount} disabled={savingLabo}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {savingLabo ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* VUE GLOBALE */}
        {tab === 'overview' && (
          <>
            {/* Compte connecté */}
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connecté en tant que</p>
              <p className="font-black text-blue-950 mt-1">{session.user.email}</p>
              <p className="text-xs text-teal-500 font-bold mt-1">Super Administrateur</p>
            </div>

            {/* KPIs globaux */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
                <p className="text-3xl font-black text-blue-950">{stats.agences}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Agences</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
                <p className="text-3xl font-black text-blue-950">{stats.delegates}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Délégués</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
                <p className="text-3xl font-black text-blue-950">{stats.visites}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total visites</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-l-4 border-green-400">
                <p className="text-3xl font-black text-blue-950">{stats.visitesToday}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Aujourd'hui</p>
              </div>
            </div>

            {/* Demandes reset */}
            {demandes.length > 0 && (
              <div className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-black text-blue-950 uppercase tracking-wider">🔑 Demandes reset</p>
                  <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                    {demandes.length}
                  </span>
                </div>
                {demandes.map(d => (
                  <div key={d.id} className="border border-slate-200 rounded-xl p-3 mb-3">
                    <p className="font-bold text-blue-950 text-sm">{d.email}</p>
                    <p className="text-xs text-slate-400 mb-2">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Nouveau mot de passe..."
                        value={resetting === d.id ? newPassword : ''}
                        onChange={e => { setResetting(d.id); setNewPassword(e.target.value) }}
                        className="flex-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
                      <button onClick={() => handleReset(d)}
                        className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl text-xs font-black">
                        ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* AGENCES */}
        {tab === 'agences' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {agences.length} agence{agences.length > 1 ? 's' : ''}
            </p>
            {agences.map(a => {
              const exp = getExpirationInfo(a)
              return (
                <div key={a.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                  exp?.estExpire ? 'border-rose-400' :
                  exp?.joursRestants <= 3 ? 'border-amber-400' : 'border-teal-400'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-blue-950">{a.nom}</p>
                      <p className="text-xs text-slate-400">{a.pays}</p>
                      {a.email && <p className="text-xs text-slate-400">✉️ {a.email}</p>}
                      {exp && (
                        <p className={`text-xs font-bold mt-1 ${
                          exp.estExpire ? 'text-rose-500' :
                          exp.joursRestants <= 3 ? 'text-amber-500' : 'text-teal-500'
                        }`}>
                          {exp.estExpire
                            ? `⛔ Expiré le ${exp.expiration.toLocaleDateString('fr-FR')}`
                            : `✅ Expire dans ${exp.joursRestants} jour(s)`}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      a.essai_actif ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'
                    }`}>
                      {a.essai_actif ? 'Essai' : 'Actif'}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ACTIVITE */}
        {tab === 'activite' && (
          <>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
              10 dernières visites — toutes agences
            </p>
            {recentVisites.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">Aucune visite récente</p>
              </div>
            ) : (
              recentVisites.map(v => (
                <div key={v.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
                  v.confidence_status === 'suspicious' ? 'border-rose-400' :
                  v.confidence_status === 'validated' ? 'border-green-400' : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-black text-blue-950 text-sm">{v.nom_contact || '—'}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'
                    }`}>{v.statut}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    👤 {v.delegates?.prenom} {v.delegates?.nom}
                  </p>
                  <p className="text-xs text-slate-400">
                    🏢 {v.agences?.nom}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-300">{v.created_at?.slice(0, 16).replace('T', ' ')}</p>
                    {v.confidence_score !== null && v.confidence_score !== undefined && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        v.confidence_status === 'validated' ? 'bg-green-100 text-green-600' :
                        v.confidence_status === 'suspicious' ? 'bg-rose-100 text-rose-500' :
                        'bg-amber-100 text-amber-600'
                      }`}>{v.confidence_score}pts</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ACTIONS */}
        {tab === 'actions' && (
          <>
            <button onClick={() => setPage('agences')}
              className="w-full bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">
              🏢 Gérer les agences
            </button>
            <button onClick={() => setShowLaboForm(true)}
              className="w-full bg-cyan-600 text-white font-black py-4 rounded-2xl text-sm">
              🧪 Créer compte laboratoire
            </button>
            <button onClick={() => setPage('fichiers')}
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm">
              📊 Déposer des fichiers stats
            </button>
          </>
        )}
      </div>
    </div>
  )
}