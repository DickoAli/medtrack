import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

export default function GestionDelegues({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [visites, setVisites] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterTerritory, setFilterTerritory] = useState('tous')
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '',
    territory_id: '', manager_id: '', statut: 'actif', date_entree: ''
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d }, { data: t }, { data: p }, { data: v }, { data: m }] = await Promise.all([
      supabase.from('delegates').select('*, territories(nom)').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('territories').select('*').eq('agence_id', profile.agence_id).eq('is_active', true).order('nom'),
      supabase.from('delegate_portfolios').select('delegate_id').eq('agence_id', profile.agence_id).eq('is_active', true),
      supabase.from('visites').select('delegate_id, statut, created_at').eq('agence_id', profile.agence_id),
      supabase.from('delegates').select('id, nom, prenom').eq('agence_id', profile.agence_id).order('nom')
    ])
    setDelegates(d || [])
    setTerritoires(t || [])
    setPortfolios(p || [])
    setVisites(v || [])
    setManagers(m || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', prenom: '', email: '', telephone: '',
    territory_id: '', manager_id: '', statut: 'actif', date_entree: ''
  })

  const handleSave = async () => {
    if (!form.nom || !form.prenom) { alert('Nom et prénom obligatoires'); return }
    if (!form.email) { alert('Email obligatoire'); return }
    setSaving(true)

    if (editing) {
      await supabase.from('delegates').update({
        nom: form.nom, prenom: form.prenom,
        email: form.email, telephone: form.telephone || null,
        territory_id: form.territory_id || null,
        manager_id: form.manager_id || null,
        statut: form.statut,
        date_entree: form.date_entree || null,
        updated_at: new Date().toISOString()
      }).eq('id', editing)
    } else {
      await supabase.from('delegates').insert({
        nom: form.nom, prenom: form.prenom,
        email: form.email, telephone: form.telephone || null,
        territory_id: form.territory_id || null,
        manager_id: form.manager_id || null,
        statut: form.statut,
        date_entree: form.date_entree || null,
        agence_id: profile.agence_id
      })
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg(editing ? 'Délégué modifié !' : 'Délégué créé !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (d) => {
    setEditing(d.id)
    setForm({
      nom: d.nom, prenom: d.prenom,
      email: d.email, telephone: d.telephone || '',
      territory_id: d.territory_id || '',
      manager_id: d.manager_id || '',
      statut: d.statut || 'actif',
      date_entree: d.date_entree || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce délégué ?')) return
    await supabase.from('delegates').delete().eq('id', id)
    fetchAll()
  }

  const getStats = (delegateId) => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const monthStr = new Date().toISOString().slice(0, 7)
    const dvs = visites.filter(v => v.delegate_id === delegateId)
    const today = dvs.filter(v => v.created_at?.slice(0, 10) === todayStr).length
    const month = dvs.filter(v => v.created_at?.slice(0, 7) === monthStr && v.statut === 'Réalisée').length
    const cibles = portfolios.filter(p => p.delegate_id === delegateId).length
    return { total: dvs.length, today, month, cibles }
  }

  const exportExcel = () => {
    const data = delegates.map(d => {
      const stats = getStats(d.id)
      return {
        'Prénom': d.prenom,
        'Nom': d.nom,
        'Email': d.email,
        'Téléphone': d.telephone || '',
        'Territoire': d.territories?.nom || '',
        'Statut': d.statut || 'actif',
        'Date entrée': d.date_entree || '',
        'Total visites': stats.total,
        'Visites ce mois': stats.month,
        'Visites aujourd\'hui': stats.today,
        'Cibles assignées': stats.cibles
      }
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Délégués')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `delegues_medtrack_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
  }

  const filtered = delegates.filter(d => {
    const matchSearch = `${d.prenom} ${d.nom} ${d.email}`.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || (d.statut || 'actif') === filterStatut
    const matchTerritory = filterTerritory === 'tous' || d.territory_id === filterTerritory
    return matchSearch && matchStatut && matchTerritory
  })

  const STATUT_COLORS = {
    actif: 'border-teal-400',
    inactif: 'border-slate-200',
    suspendu: 'border-rose-400'
  }

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
            <h1 className="text-white font-black text-lg">Délégués</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {delegates.length} délégué{delegates.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="bg-green-600 text-white px-3 py-2 rounded-xl font-black text-xs">
            📥
          </button>
          <button onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
            className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="🔍 Rechercher par nom, email..." />
        <div className="grid grid-cols-2 gap-3">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="tous">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="suspendu">Suspendu</option>
          </select>
          <select value={filterTerritory} onChange={e => setFilterTerritory(e.target.value)}
            className="p-3 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="tous">Tous territoires</option>
            {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Stats globales */}
      <div className="px-6 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 text-center border-l-4 border-teal-400">
          <p className="text-xl font-black text-blue-950">{delegates.filter(d => (d.statut || 'actif') === 'actif').length}</p>
          <p className="text-xs text-slate-500 font-bold mt-1">Actifs</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center border-l-4 border-blue-400">
          <p className="text-xl font-black text-blue-950">{portfolios.length}</p>
          <p className="text-xs text-slate-500 font-bold mt-1">Cibles total</p>
        </div>
        <div className="bg-white rounded-2xl p-3 text-center border-l-4 border-amber-400">
          <p className="text-xl font-black text-blue-950">
            {visites.filter(v => v.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
          </p>
          <p className="text-xs text-slate-500 font-bold mt-1">Aujourd'hui</p>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier le délégué' : 'Nouveau délégué'}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prénom *</label>
                  <input value={form.prenom} onChange={e => set('prenom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Prénom" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom *</label>
                  <input value={form.nom} onChange={e => set('nom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                    placeholder="Nom" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="email@exemple.com" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="00223XXXXXXXX" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Territoire</label>
                <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucun territoire</option>
                  {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manager responsable</label>
                <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Aucun manager</option>
                  {managers.filter(m => m.id !== editing).map(m => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date d'entrée</label>
                <input type="date" value={form.date_entree} onChange={e => set('date_entree', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="p-6 flex flex-col gap-3 pb-10">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          {filtered.length} délégué{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-slate-400 text-sm font-bold">Aucun délégué trouvé</p>
          </div>
        ) : (
          filtered.map(d => {
            const stats = getStats(d.id)
            const manager = managers.find(m => m.id === d.manager_id)
            return (
              <div key={d.id} className={`bg-white rounded-2xl p-4 border-l-4 ${STATUT_COLORS[d.statut || 'actif']}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-950 flex items-center justify-center font-black text-teal-400 flex-shrink-0">
                      {d.prenom?.[0]}{d.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-black text-blue-950">{d.prenom} {d.nom}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          (d.statut || 'actif') === 'actif' ? 'bg-teal-100 text-teal-600' :
                          (d.statut || 'actif') === 'suspendu' ? 'bg-rose-100 text-rose-500' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {d.statut || 'actif'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{d.email}</p>
                      {d.telephone && <p className="text-xs text-slate-400">📞 {d.telephone}</p>}
                      {d.territories && (
                        <p className="text-xs text-slate-400">🗺️ {d.territories.nom}</p>
                      )}
                      {manager && (
                        <p className="text-xs text-slate-400">👔 {manager.prenom} {manager.nom}</p>
                      )}
                      {d.date_entree && (
                        <p className="text-xs text-slate-400">
                          📅 Depuis {new Date(d.date_entree).toLocaleDateString('fr-FR')}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-0.5 rounded-full">
                          {stats.total} visites
                        </span>
                        <span className="text-xs bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                          {stats.month} ce mois
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                          {stats.cibles} cibles
                        </span>
                        {stats.today > 0 && (
                          <span className="text-xs bg-green-50 text-green-600 font-bold px-2 py-0.5 rounded-full">
                            {stats.today} aujourd'hui
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(d)}
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(d.id)}
                      className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}