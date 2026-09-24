import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

export default function GestionDelegues({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [visites, setVisites] = useState([])
  const [managers, setManagers] = useState([]) // ⚠ chef d'équipe informel (vient de delegates, pas de managers)
  const [managerAccounts, setManagerAccounts] = useState([]) // vrais comptes Manager, pour "Manager responsable"
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterTerritory, setFilterTerritory] = useState('tous')
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '',
    territory_id: '', manager_id: '', real_manager_id: '', statut: 'actif', date_entree: '', extranet_access: true
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [
      { data: d, error: errD },
      { data: t, error: errT },
      { data: p, error: errP },
      { data: v, error: errV },
      { data: m, error: errM },
      { data: ma, error: errMa }
    ] = await Promise.all([
      supabase.from('delegates').select('*, territories(nom)').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('territories').select('*').eq('agence_id', profile.agence_id).eq('is_active', true).order('nom'),
      supabase.from('delegate_portfolios').select('delegate_id').eq('agence_id', profile.agence_id).eq('is_active', true),
      supabase.from('visites').select('delegate_id, statut, created_at').eq('agence_id', profile.agence_id),
      supabase.from('delegates').select('id, nom, prenom').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('profiles').select('*, managers(id, nom, prenom)').eq('agence_id', profile.agence_id).eq('role', 'manager')
    ])

    if (errD || errT || errP || errV || errM || errMa) {
      console.error('Erreur chargement délégués:', { errD, errT, errP, errV, errM, errMa })
      setFetchError((errD || errT || errP || errV || errM || errMa).message)
    } else {
      setFetchError('')
    }

    setDelegates(d || [])
    setTerritoires(t || [])
    setPortfolios(p || [])
    setVisites(v || [])
    setManagers(m || [])
    setManagerAccounts((ma || []).filter(a => a.managers))
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const resetForm = () => setForm({
    nom: '', prenom: '', email: '', telephone: '',
    territory_id: '', manager_id: '', real_manager_id: '', statut: 'actif', date_entree: '', extranet_access: true
  })

  const handleSave = async () => {
    if (!form.nom || !form.prenom) { alert('Nom et prénom obligatoires'); return }
    if (!form.email) { alert('Email obligatoire'); return }
    setSaving(true)

    if (editing) {
      const { error } = await supabase.from('delegates').update({
        nom: form.nom, prenom: form.prenom, email: form.email,
        telephone: form.telephone || null, territory_id: form.territory_id || null,
        manager_id: form.manager_id || null, real_manager_id: form.real_manager_id || null, statut: form.statut,
        date_entree: form.date_entree || null, extranet_access: form.extranet_access,
        updated_at: new Date().toISOString()
      }).eq('id', editing)
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('delegates').insert({
        nom: form.nom, prenom: form.prenom, email: form.email,
        telephone: form.telephone || null, territory_id: form.territory_id || null,
        manager_id: form.manager_id || null, real_manager_id: form.real_manager_id || null, statut: form.statut,
        date_entree: form.date_entree || null, extranet_access: form.extranet_access,
        agence_id: profile.agence_id
      })
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
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
      nom: d.nom, prenom: d.prenom, email: d.email, telephone: d.telephone || '',
      territory_id: d.territory_id || '', manager_id: d.manager_id || '', real_manager_id: d.real_manager_id || '',
      statut: d.statut || 'actif', date_entree: d.date_entree || '',
      extranet_access: d.extranet_access !== false // défaut à true si colonne pas encore renseignée
    })
    setShowForm(true)
  }

  const toggleExtranetAccess = async (d) => {
    const { error } = await supabase.from('delegates')
      .update({ extranet_access: !(d.extranet_access !== false) })
      .eq('id', d.id)
    if (error) { alert('Erreur : ' + error.message); return }
    fetchAll()
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
        'Prénom': d.prenom, 'Nom': d.nom, 'Email': d.email, 'Téléphone': d.telephone || '',
        'Territoire': d.territories?.nom || '', 'Statut': d.statut || 'actif', 'Date entrée': d.date_entree || '',
        'Total visites': stats.total, 'Visites ce mois': stats.month,
        "Visites aujourd'hui": stats.today, 'Cibles assignées': stats.cibles
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
            <h1 className="text-white font-semibold text-base">Délégués</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {delegates.length} délégué{delegates.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="bg-white text-[#172B4D] px-3 py-2 rounded-lg font-semibold text-xs">
            📥
          </button>
          <button onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
            className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
            + Ajouter
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
          placeholder="🔍 Rechercher par nom, email..." />
        <div className="grid grid-cols-2 gap-3">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
            <option value="tous">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="suspendu">Suspendu</option>
          </select>
          <select value={filterTerritory} onChange={e => setFilterTerritory(e.target.value)}
            className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
            <option value="tous">Tous territoires</option>
            {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {fetchError && (
        <div className="mx-5 mt-4 bg-[#FDE8E8] border border-[#DC2626]/20 rounded-xl p-3 text-center">
          <p className="text-[#DC2626] font-semibold text-sm">⚠️ Erreur de chargement : {fetchError}</p>
        </div>
      )}

      <div className="px-5 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
          <p className="text-lg font-semibold text-[#172B4D]">{delegates.filter(d => (d.statut || 'actif') === 'actif').length}</p>
          <p className="text-xs text-[#667085] mt-1">Actifs</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
          <p className="text-lg font-semibold text-[#172B4D]">{portfolios.length}</p>
          <p className="text-xs text-[#667085] mt-1">Cibles total</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-[#DDE4EA]">
          <p className="text-lg font-semibold text-[#172B4D]">
            {visites.filter(v => v.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
          </p>
          <p className="text-xs text-[#667085] mt-1">Aujourd'hui</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">
              {editing ? 'Modifier le délégué' : 'Nouveau délégué'}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Prénom *</label>
                  <input value={form.prenom} onChange={e => set('prenom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                    placeholder="Prénom" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
                  <input value={form.nom} onChange={e => set('nom', e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                    placeholder="Nom" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="email@exemple.com" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
                <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="00223XXXXXXXX" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Territoire</label>
                <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucun territoire</option>
                  {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Manager responsable</label>
                <select value={form.real_manager_id} onChange={e => set('real_manager_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucun</option>
                  {managerAccounts.map(a => (
                    <option key={a.managers.id} value={a.managers.id}>{a.managers.prenom} {a.managers.nom}</option>
                  ))}
                </select>
                <p className="text-xs text-[#98A2B3] mt-1">Le vrai Manager qui pilote ce délégué — utilisé pour le coaching Country Manager.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Chef d'équipe (délégué référent)</label>
                <select value={form.manager_id} onChange={e => set('manager_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Aucun</option>
                  {managers.filter(m => m.id !== editing).map(m => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                  ))}
                </select>
                <p className="text-xs text-[#98A2B3] mt-1">Différent du Manager responsable ci-dessus — simple référent terrain informel.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Date d'entrée</label>
                <input type="date" value={form.date_entree} onChange={e => set('date_entree', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-[#F4F7F9] p-3 rounded-lg">
                <input type="checkbox" checked={form.extranet_access}
                  onChange={e => set('extranet_access', e.target.checked)}
                  className="w-4 h-4 accent-[#087F5B]" />
                <span className="text-sm text-[#172B4D]">
                  🌐 Accès à l'onglet Extranet
                  <span className="block text-xs text-[#667085] font-normal">Si décoché, l'onglet n'apparaît plus sur l'app de ce délégué.</span>
                </span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-3 rounded-lg text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                  {saving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 pb-10">
        <p className="text-xs text-[#667085] font-semibold uppercase tracking-wide">
          {filtered.length} délégué{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-[#667085] text-sm font-medium">Aucun délégué trouvé</p>
          </div>
        ) : (
          filtered.map(d => {
            const stats = getStats(d.id)
            const manager = managers.find(m => m.id === d.manager_id)
            return (
              <div key={d.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{
                borderLeft: `2px solid ${(d.statut || 'actif') === 'actif' ? '#087F5B' : (d.statut || 'actif') === 'suspendu' ? '#DC2626' : '#DDE4EA'}`
              }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#172B4D] flex items-center justify-center font-semibold text-[#087F5B] flex-shrink-0">
                      {d.prenom?.[0]}{d.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-[#172B4D]">{d.prenom} {d.nom}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          (d.statut || 'actif') === 'actif' ? 'bg-[#E7F5EF] text-[#087F5B]' :
                          (d.statut || 'actif') === 'suspendu' ? 'bg-[#FDE8E8] text-[#DC2626]' :
                          'bg-[#EEF1F4] text-[#98A2B3]'
                        }`}>
                          {d.statut || 'actif'}
                        </span>
                      </div>
                      <p className="text-xs text-[#667085]">{d.email}</p>
                      {d.telephone && <p className="text-xs text-[#667085]">📞 {d.telephone}</p>}
                      {d.territories && <p className="text-xs text-[#667085]">🗺️ {d.territories.nom}</p>}
                      {manager && <p className="text-xs text-[#667085]">👔 {manager.prenom} {manager.nom}</p>}
                      {d.date_entree && (
                        <p className="text-xs text-[#98A2B3]">
                          📅 Depuis {new Date(d.date_entree).toLocaleDateString('fr-FR')}
                        </p>
                      )}

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-[#E7F5EF] text-[#087F5B] font-semibold px-2 py-0.5 rounded-full">
                          {stats.total} visites
                        </span>
                        <span className="text-xs bg-[#FEF3E2] text-[#B45309] font-semibold px-2 py-0.5 rounded-full">
                          {stats.month} ce mois
                        </span>
                        <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                          {stats.cibles} cibles
                        </span>
                        {stats.today > 0 && (
                          <span className="text-xs bg-[#E9F9EE] text-[#16A34A] font-semibold px-2 py-0.5 rounded-full">
                            {stats.today} aujourd'hui
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleExtranetAccess(d)}
                      title={d.extranet_access !== false ? 'Extranet visible — cliquer pour masquer' : 'Extranet masqué — cliquer pour autoriser'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        d.extranet_access !== false ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#EEF1F4] text-[#98A2B3]'
                      }`}>🌐</button>
                    <button onClick={() => handleEdit(d)}
                      className="bg-[#E8F0FE] text-[#2563EB] px-3 py-1.5 rounded-lg text-xs font-semibold">✏️</button>
                    <button onClick={() => handleDelete(d.id)}
                      className="bg-[#FDE8E8] text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold">🗑️</button>
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
