import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionComptes({ onBack, profile }) {
  const [comptes, setComptes] = useState([])
  const [delegates, setDelegates] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    email: '', password: '', role: 'delegue',
    delegate_id: '', territory_id: '', manager_id: ''
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: c }, { data: d }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('profiles')
        .select('*, delegates(nom, prenom, zone, territory_id), territories(nom)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('territories').select('*').eq('agence_id', profile.agence_id).eq('is_active', true).order('nom'),
      supabase.from('profiles').select('*, delegates(nom, prenom)').eq('agence_id', profile.agence_id).eq('role', 'manager')
    ])
    setComptes(c || [])
    setDelegates(d || [])
    setTerritoires(t || [])
    setManagers(m || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    email: '', password: '', role: 'delegue',
    delegate_id: '', territory_id: '', manager_id: ''
  })

  const handleSave = async () => {
    if (!form.email || !form.password) { alert('Email et mot de passe obligatoires'); return }
    setSaving(true)

    const { data: authData, error } = await supabase.auth.signUp({
      email: form.email, password: form.password
    })

    if (error) { alert('Erreur: ' + error.message); setSaving(false); return }

    if (authData.user) {
      await supabase.from('profiles').insert({
        id: authData.user.id, role: form.role,
        agence_id: profile.agence_id,
        delegate_id: form.delegate_id || null, actif: true
      })

      if (form.delegate_id && (form.territory_id || form.manager_id)) {
        await supabase.from('delegates').update({
          territory_id: form.territory_id || null,
          manager_id: form.manager_id || null
        }).eq('id', form.delegate_id)
      }
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Compte créé !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const toggleActif = async (c) => {
    await supabase.from('profiles').update({ actif: !c.actif }).eq('id', c.id)
    fetchAll()
  }

  const updateTerritoire = async (delegateId, territoryId) => {
    await supabase.from('delegates').update({ territory_id: territoryId || null }).eq('id', delegateId)
    setSuccessMsg('Territoire mis à jour !')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const updateManager = async (delegateId, managerId) => {
    await supabase.from('delegates').update({ manager_id: managerId || null }).eq('id', delegateId)
    setSuccessMsg('Manager mis à jour !')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const filtered = comptes.filter(c => {
    const nom = `${c.delegates?.prenom || ''} ${c.delegates?.nom || ''}`.toLowerCase()
    return nom.includes(search.toLowerCase()) || c.id.includes(search)
  })

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Gestion des comptes</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {comptes.length} compte{comptes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Créer
        </button>
      </div>

      <div className="px-5 pt-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
          placeholder="🔍 Rechercher..." />
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Nouveau compte</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Rôle</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="delegue">Délégué</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="email@exemple.com" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Mot de passe *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Min. 6 caractères" />
              </div>

              {form.role === 'delegue' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Profil délégué</label>
                    <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                      <option value="">Sélectionner...</option>
                      {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Territoire</label>
                    <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                      <option value="">Aucun</option>
                      {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Manager responsable</label>
                    <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                      <option value="">Aucun</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.delegate_id}>
                          {m.delegates?.prenom} {m.delegates?.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 pb-10">
        {filtered.map(c => {
          const delegate = delegates.find(d => d.id === c.delegate_id)
          return (
            <div key={c.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${c.actif ? '#087F5B' : '#DDE4EA'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-[#172B4D] text-sm">
                      {c.delegates?.prenom} {c.delegates?.nom}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.role === 'manager' ? 'bg-[#E8F0FE] text-[#2563EB]' : 'bg-[#E7F5EF] text-[#087F5B]'
                    }`}>
                      {c.role === 'manager' ? 'Manager' : 'Délégué'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.actif ? 'bg-[#E9F9EE] text-[#16A34A]' : 'bg-[#EEF1F4] text-[#98A2B3]'
                    }`}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {c.role === 'delegue' && delegate && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div>
                        <label className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide">Territoire</label>
                        <select
                          value={delegate.territory_id || ''}
                          onChange={e => updateTerritoire(delegate.id, e.target.value)}
                          className="w-full mt-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
                          <option value="">Aucun territoire</option>
                          {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide">Manager</label>
                        <select
                          value={delegate.manager_id || ''}
                          onChange={e => updateManager(delegate.id, e.target.value)}
                          className="w-full mt-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
                          <option value="">Aucun manager</option>
                          {managers.map(m => (
                            <option key={m.delegate_id} value={m.delegate_id}>
                              {m.delegates?.prenom} {m.delegates?.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => toggleActif(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${
                    c.actif ? 'bg-[#EEF1F4] text-[#667085]' : 'bg-[#E7F5EF] text-[#087F5B]'
                  }`}>
                  {c.actif ? '⏸ Désactiver' : '▶ Activer'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
