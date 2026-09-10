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

  const cardStyle = "bg-white rounded-xl border border-[#DDE4EA] p-4"
  const sectionTitle = "text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2"

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      {/* Header */}
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl text-[#087F5B]">⚕</span>
          <div>
            <h1 className="text-white font-semibold text-base">MedTrack</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <button onClick={fetchAll} disabled={refreshing}
              className="text-[#9AA9C2] w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#233858] transition-colors">
              <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
            </button>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="border border-[#3B4A63] text-[#C7D0E0] px-3 py-1.5 rounded-lg font-medium text-xs">
            Déconnexion
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-[#DDE4EA]">
        {[
          { id: 'overview', label: 'Vue globale' },
          { id: 'agences', label: 'Agences' },
          { id: 'activite', label: 'Activité' },
          { id: 'actions', label: 'Actions' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t.id ? 'text-[#087F5B] border-b-2 border-[#087F5B]' : 'text-[#667085]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Modal compte labo */}
      {showLaboForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Nouveau compte laboratoire</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Agence *</label>
                <select value={laboForm.agence_id}
                  onChange={e => setLaboForm(f => ({ ...f, agence_id: e.target.value, laboratoire_id: '' }))}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner une agence...</option>
                  {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Laboratoire *</label>
                <select value={laboForm.laboratoire_id}
                  onChange={e => setLaboForm(f => ({ ...f, laboratoire_id: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner un laboratoire...</option>
                  {labos.filter(l => !laboForm.agence_id || l.agence_id === laboForm.agence_id)
                    .map(l => <option key={l.id} value={l.id}>{l.nom} — {l.agences?.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email *</label>
                <input type="email" value={laboForm.email}
                  onChange={e => setLaboForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="contact@laboratoire.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mot de passe *</label>
                <input type="password" value={laboForm.password}
                  onChange={e => setLaboForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Min. 6 caractères" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowLaboForm(false); setLaboForm({ email: '', password: '', laboratoire_id: '', agence_id: '' }) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleCreateLaboAccount} disabled={savingLabo}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {savingLabo ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* VUE GLOBALE */}
        {tab === 'overview' && (
          <>
            <div className={cardStyle + " border-l-2 border-l-[#087F5B]"}>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide">Connecté en tant que</p>
              <p className="font-semibold text-[#172B4D] mt-1">{session.user.email}</p>
              <p className="text-xs text-[#087F5B] font-medium mt-1">Super Administrateur</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cardStyle + " border-l-2 border-l-[#087F5B]"}>
                <p className="text-2xl font-semibold text-[#172B4D]">{stats.agences}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Agences</p>
              </div>
              <div className={cardStyle + " border-l-2 border-l-[#2563EB]"}>
                <p className="text-2xl font-semibold text-[#172B4D]">{stats.delegates}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Délégués</p>
              </div>
              <div className={cardStyle}>
                <p className="text-2xl font-semibold text-[#172B4D]">{stats.visites}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Total visites</p>
              </div>
              <div className={cardStyle + " border-l-2 border-l-[#16A34A]"}>
                <p className="text-2xl font-semibold text-[#172B4D]">{stats.visitesToday}</p>
                <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Aujourd'hui</p>
              </div>
            </div>

            {demandes.length > 0 && (
              <div className={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">Demandes reset</p>
                  <span className="bg-[#DC2626] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {demandes.length}
                  </span>
                </div>
                {demandes.map(d => (
                  <div key={d.id} className="border border-[#DDE4EA] rounded-lg p-3 mb-3 last:mb-0">
                    <p className="font-medium text-[#172B4D] text-sm">{d.email}</p>
                    <p className="text-xs text-[#667085] mb-2">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Nouveau mot de passe..."
                        value={resetting === d.id ? newPassword : ''}
                        onChange={e => { setResetting(d.id); setNewPassword(e.target.value) }}
                        className="flex-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-sm" />
                      <button onClick={() => handleReset(d)}
                        className="bg-[#087F5B] text-white px-3 py-2 rounded-lg text-xs font-semibold">
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
            <p className={sectionTitle}>
              {agences.length} agence{agences.length > 1 ? 's' : ''}
            </p>
            {agences.map(a => {
              const exp = getExpirationInfo(a)
              const borderColor = exp?.estExpire ? '#DC2626' : exp?.joursRestants <= 3 ? '#F59E0B' : '#087F5B'
              return (
                <div key={a.id} className={cardStyle} style={{ borderLeft: `2px solid ${borderColor}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#172B4D]">{a.nom}</p>
                      <p className="text-xs text-[#667085]">{a.pays}</p>
                      {a.email && <p className="text-xs text-[#667085]">✉️ {a.email}</p>}
                      {exp && (
                        <p className="text-xs font-medium mt-1" style={{ color: borderColor }}>
                          {exp.estExpire
                            ? `Expiré le ${exp.expiration.toLocaleDateString('fr-FR')}`
                            : `Expire dans ${exp.joursRestants} jour(s)`}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      a.essai_actif ? 'bg-[#FEF3E2] text-[#B45309]' : 'bg-[#E7F5EF] text-[#087F5B]'
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
            <p className={sectionTitle}>10 dernières visites — toutes agences</p>
            {recentVisites.length === 0 ? (
              <div className={cardStyle + " text-center"}>
                <p className="text-[#667085] text-sm">Aucune visite récente</p>
              </div>
            ) : (
              recentVisites.map(v => {
                const borderColor = v.confidence_status === 'suspicious' ? '#DC2626' :
                  v.confidence_status === 'validated' ? '#16A34A' : '#DDE4EA'
                return (
                  <div key={v.id} className={cardStyle} style={{ borderLeft: `2px solid ${borderColor}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-[#172B4D] text-sm">{v.nom_contact || '—'}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        v.statut === 'Réalisée' ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
                      }`}>{v.statut}</span>
                    </div>
                    <p className="text-xs text-[#667085]">👤 {v.delegates?.prenom} {v.delegates?.nom}</p>
                    <p className="text-xs text-[#667085]">🏢 {v.agences?.nom}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-[#98A2B3]">{v.created_at?.slice(0, 16).replace('T', ' ')}</p>
                      {v.confidence_score !== null && v.confidence_score !== undefined && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          v.confidence_status === 'validated' ? 'bg-[#E9F9EE] text-[#16A34A]' :
                          v.confidence_status === 'suspicious' ? 'bg-[#FDE8E8] text-[#DC2626]' :
                          'bg-[#FEF3E2] text-[#B45309]'
                        }`}>{v.confidence_score}pts</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ACTIONS */}
        {tab === 'actions' && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setPage('agences')}
              className="w-full bg-[#172B4D] text-white font-semibold py-4 rounded-xl text-sm">
              Gérer les agences
            </button>
            <button onClick={() => setShowLaboForm(true)}
              className="w-full bg-white border border-[#DDE4EA] text-[#172B4D] font-semibold py-4 rounded-xl text-sm">
              Créer compte laboratoire
            </button>
            <button onClick={() => setPage('fichiers')}
              className="w-full bg-white border border-[#DDE4EA] text-[#172B4D] font-semibold py-4 rounded-xl text-sm">
              Déposer des fichiers stats
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
