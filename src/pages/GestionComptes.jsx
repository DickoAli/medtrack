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
      email: form.email,
      password: form.password
    })

    if (error) { alert('Erreur: ' + error.message); setSaving(false); return }

    if (authData.user) {
      await supabase.from('profiles').insert({
        id: authData.user.id,
        role: form.role,
        agence_id: profile.agence_id,
        delegate_id: form.delegate_id || null,
        actif: true
      })

      // Lier territoire et manager au délégué si sélectionnés
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Gestion des comptes</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {comptes.length} compte{comptes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Créer
        </button>
      </div>

      <div className="px-6 pt-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="🔍 Rechercher..." />
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">Nouveau compte</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rôle</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="delegue">Délégué</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="email@exemple.com" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Min. 6 caractères" />
              </div>

              {form.role === 'delegue' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profil délégué</label>
                    <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                      <option value="">Sélectionner...</option>
                      {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Territoire</label>
                    <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                      <option value="">Aucun</option>
                      {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manager responsable</label>
                    <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
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
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste comptes */}
      <div className="p-6 flex flex-col gap-3 pb-10">
        {filtered.map(c => {
          const delegate = delegates.find(d => d.id === c.delegate_id)
          return (
            <div key={c.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              c.actif ? 'border-teal-400' : 'border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-black text-blue-950 text-sm">
                      {c.delegates?.prenom} {c.delegates?.nom}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.role === 'manager' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'
                    }`}>
                      {c.role === 'manager' ? 'Manager' : 'Délégué'}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.actif ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Territoire */}
                  {c.role === 'delegue' && delegate && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Territoire</label>
                        <select
                          value={delegate.territory_id || ''}
                          onChange={e => updateTerritoire(delegate.id, e.target.value)}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                          <option value="">Aucun territoire</option>
                          {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manager</label>
                        <select
                          value={delegate.manager_id || ''}
                          onChange={e => updateManager(delegate.id, e.target.value)}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 ${
                    c.actif ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-600'
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