import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Cascade stricte : chaque rôle ne peut créer QUE le rôle juste en dessous,
// et le rattachement se fait automatiquement à soi-même — jamais un choix libre.
// superadmin (agence) → country_manager → manager → delegue
const NEXT_ROLE = { country_manager: 'manager', manager: 'delegue' }
const ROLE_LABELS = { delegue: 'Délégué', manager: 'Manager', country_manager: 'Country Manager' }

export default function GestionComptes({ onBack, profile }) {
  const [comptes, setComptes] = useState([])
  const [orphanComptes, setOrphanComptes] = useState([]) // comptes du même rôle, pas encore rattachés à personne (legacy)
  const [delegates, setDelegates] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [teamLeadDelegates, setTeamLeadDelegates] = useState([]) // "chef d'équipe" informel, sans rapport avec la hiérarchie
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    email: '', password: '',
    delegate_id: '', territory_id: '', team_lead_id: '',
    nom: '', prenom: '', telephone: ''
  })

  const myManagerId = profile.managers?.id // ma propre fiche managers (si je suis country_manager ou manager)
  const creatableRole = NEXT_ROLE[profile.role] // ce que JE peux créer — undefined si aucun droit ici

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)

    if (creatableRole === 'delegue') {
      // Vue Manager : uniquement MES délégués, plus les orphelins à rattacher
      const [
        { data: c, error: errC },
        { data: orphans, error: errO },
        { data: d, error: errD },
        { data: t, error: errT },
        { data: tl, error: errTl }
      ] = await Promise.all([
        supabase.from('profiles')
          .select('*, delegates!inner(nom, prenom, zone, territory_id, real_manager_id)')
          .eq('agence_id', profile.agence_id).eq('role', 'delegue')
          .eq('delegates.real_manager_id', myManagerId),
        supabase.from('profiles')
          .select('*, delegates!inner(nom, prenom, zone, territory_id, real_manager_id)')
          .eq('agence_id', profile.agence_id).eq('role', 'delegue')
          .is('delegates.real_manager_id', null),
        supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
        supabase.from('territories').select('*').eq('agence_id', profile.agence_id).eq('is_active', true).order('nom'),
        supabase.from('delegates').select('id, nom, prenom').eq('agence_id', profile.agence_id).order('nom')
      ])
      if (errC || errO || errD || errT || errTl) {
        console.error('Erreur chargement comptes:', { errC, errO, errD, errT, errTl })
        alert('Erreur de chargement : ' + (errC || errO || errD || errT || errTl).message)
      }
      setComptes(c || [])
      setOrphanComptes(orphans || [])
      setDelegates(d || [])
      setTerritoires(t || [])
      setTeamLeadDelegates(tl || [])
    } else if (creatableRole === 'manager') {
      // Vue Country Manager : uniquement MES managers, plus les orphelins
      const [
        { data: c, error: errC },
        { data: orphans, error: errO }
      ] = await Promise.all([
        supabase.from('profiles')
          .select('*, managers!inner(id, nom, prenom, telephone, email, country_manager_id)')
          .eq('agence_id', profile.agence_id).eq('role', 'manager')
          .eq('managers.country_manager_id', myManagerId),
        supabase.from('profiles')
          .select('*, managers!inner(id, nom, prenom, telephone, email, country_manager_id)')
          .eq('agence_id', profile.agence_id).eq('role', 'manager')
          .is('managers.country_manager_id', null)
      ])
      if (errC || errO) {
        console.error('Erreur chargement comptes:', { errC, errO })
        alert('Erreur de chargement : ' + (errC || errO).message)
      }
      setComptes(c || [])
      setOrphanComptes(orphans || [])
    }

    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const resetForm = () => setForm({
    email: '', password: '', delegate_id: '', territory_id: '', team_lead_id: '',
    nom: '', prenom: '', telephone: ''
  })

  const handleSave = async () => {
    if (!creatableRole) { alert('Vous n\'avez pas les droits pour créer de compte ici.'); return }
    if (!form.email || !form.password) { alert('Email et mot de passe obligatoires'); return }
    if (creatableRole === 'manager' && (!form.nom || !form.prenom)) { alert('Nom et prénom obligatoires'); return }
    setSaving(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email, password: form.password
    })
    if (authError) { alert('Erreur : ' + authError.message); setSaving(false); return }
    if (!authData.user) { alert('Erreur : compte non créé'); setSaving(false); return }

    if (creatableRole === 'delegue') {
      const { error } = await supabase.from('profiles').insert({
        id: authData.user.id, role: 'delegue', agence_id: profile.agence_id,
        delegate_id: form.delegate_id || null, actif: true
      })
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }

      if (form.delegate_id) {
        // Rattachement automatique à MOI — jamais un choix libre
        const { error: errUpdate } = await supabase.from('delegates').update({
          territory_id: form.territory_id || null,
          manager_id: form.team_lead_id || null,
          real_manager_id: myManagerId
        }).eq('id', form.delegate_id)
        if (errUpdate) { alert('Compte créé, mais erreur de rattachement : ' + errUpdate.message) }
      }
    } else if (creatableRole === 'manager') {
      const { data: newManager, error: errManager } = await supabase.from('managers').insert({
        agence_id: profile.agence_id, nom: form.nom, prenom: form.prenom,
        telephone: form.telephone || null, email: form.email, statut: 'actif',
        country_manager_id: myManagerId // rattachement automatique à MOI
      }).select().single()
      if (errManager) { alert('Erreur création fiche manager : ' + errManager.message); setSaving(false); return }

      const { error: errProfile } = await supabase.from('profiles').insert({
        id: authData.user.id, role: 'manager', agence_id: profile.agence_id,
        manager_id: newManager.id, actif: true
      })
      if (errProfile) { alert('Erreur : ' + errProfile.message); setSaving(false); return }
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Compte créé !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const toggleActif = async (c) => {
    const { error } = await supabase.from('profiles').update({ actif: !c.actif }).eq('id', c.id)
    if (error) { alert('Erreur : ' + error.message); return }
    fetchAll()
  }

  // Rattacher un compte orphelin (legacy, créé avant cette mise à jour) à MOI — un clic, aucun choix
  const attachToMe = async (c) => {
    if (creatableRole === 'delegue') {
      const { error } = await supabase.from('delegates').update({ real_manager_id: myManagerId }).eq('id', c.delegate_id)
      if (error) { alert('Erreur : ' + error.message); return }
    } else if (creatableRole === 'manager') {
      const { error } = await supabase.from('managers').update({ country_manager_id: myManagerId }).eq('id', c.managers.id)
      if (error) { alert('Erreur : ' + error.message); return }
    }
    setSuccessMsg('Compte rattaché !')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const updateTerritoire = async (delegateId, territoryId) => {
    const { error } = await supabase.from('delegates').update({ territory_id: territoryId || null }).eq('id', delegateId)
    if (error) { alert('Erreur : ' + error.message); return }
    fetchAll()
  }

  const updateTeamLead = async (delegateId, teamLeadId) => {
    const { error } = await supabase.from('delegates').update({ manager_id: teamLeadId || null }).eq('id', delegateId)
    if (error) { alert('Erreur : ' + error.message); return }
    fetchAll()
  }

  const filtered = comptes.filter(c => {
    const nom = creatableRole === 'delegue'
      ? `${c.delegates?.prenom || ''} ${c.delegates?.nom || ''}`
      : `${c.managers?.prenom || ''} ${c.managers?.nom || ''}`
    return nom.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  })

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  if (!creatableRole) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 max-w-sm text-center border border-[#DDE4EA]">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-[#172B4D] font-semibold mb-2">Pas d'accès à la gestion des comptes</p>
          <p className="text-sm text-[#667085]">Votre rôle ne permet pas de créer ou gérer de comptes depuis cet écran.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">
              Mes {creatableRole === 'delegue' ? 'délégués' : 'managers'}
            </h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {comptes.length} compte{comptes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Créer un {ROLE_LABELS[creatableRole].toLowerCase()}
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

      {/* ===== Comptes orphelins — créés avant cette mise à jour, jamais rattachés ===== */}
      {orphanComptes.length > 0 && (
        <div className="mx-5 mt-4 bg-[#FEF3E2] border border-[#F59E0B]/30 rounded-xl p-4">
          <p className="text-sm font-semibold text-[#B45309] mb-2">
            ⚠️ {orphanComptes.length} compte{orphanComptes.length > 1 ? 's' : ''} {creatableRole === 'delegue' ? 'délégué' : 'manager'}{orphanComptes.length > 1 ? 's' : ''} non rattaché{orphanComptes.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-col gap-2">
            {orphanComptes.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-2.5">
                <p className="text-xs text-[#172B4D] font-medium">
                  {creatableRole === 'delegue' ? `${c.delegates?.prenom} ${c.delegates?.nom}` : `${c.managers?.prenom} ${c.managers?.nom}`}
                </p>
                <button onClick={() => attachToMe(c)}
                  className="text-xs bg-[#F59E0B] text-white font-semibold px-2.5 py-1.5 rounded-lg">
                  Rattacher à moi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Formulaire de création ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-1">
              Nouveau {ROLE_LABELS[creatableRole].toLowerCase()}
            </h2>
            <p className="text-xs text-[#98A2B3] mb-4">
              Automatiquement rattaché à vous.
            </p>
            <div className="flex flex-col gap-4">
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

              {creatableRole === 'delegue' && (
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
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Chef d'équipe (référent terrain)</label>
                    <select value={form.team_lead_id} onChange={e => set('team_lead_id', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                      <option value="">Aucun</option>
                      {teamLeadDelegates.filter(t => t.id !== form.delegate_id).map(t => (
                        <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {creatableRole === 'manager' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Prénom *</label>
                      <input value={form.prenom} onChange={e => set('prenom', e.target.value)}
                        className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom *</label>
                      <input value={form.nom} onChange={e => set('nom', e.target.value)}
                        className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Téléphone</label>
                    <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
                      className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                      placeholder="00223XXXXXXXX" />
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

      {/* ===== Liste ===== */}
      <div className="p-5 flex flex-col gap-3 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">{creatableRole === 'delegue' ? '👤' : '🧑‍💼'}</p>
            <p className="text-[#667085] text-sm font-medium">Aucun compte pour l'instant</p>
          </div>
        ) : (
          filtered.map(c => {
            const delegate = creatableRole === 'delegue' ? delegates.find(d => d.id === c.delegate_id) : null

            return (
              <div key={c.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${c.actif ? '#087F5B' : '#DDE4EA'}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-[#172B4D] text-sm">
                        {creatableRole === 'delegue' ? `${c.delegates?.prenom || ''} ${c.delegates?.nom || ''}` : `${c.managers?.prenom || ''} ${c.managers?.nom || ''}`}
                      </p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.actif ? 'bg-[#E9F9EE] text-[#16A34A]' : 'bg-[#EEF1F4] text-[#98A2B3]'
                      }`}>
                        {c.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>

                    {creatableRole === 'manager' && c.managers?.telephone && (
                      <p className="text-xs text-[#667085]">📞 {c.managers.telephone}</p>
                    )}

                    {creatableRole === 'delegue' && delegate && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div>
                          <label className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide">Territoire</label>
                          <select value={delegate.territory_id || ''} onChange={e => updateTerritoire(delegate.id, e.target.value)}
                            className="w-full mt-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
                            <option value="">Aucun territoire</option>
                            {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#98A2B3] uppercase tracking-wide">Chef d'équipe (référent terrain)</label>
                          <select value={delegate.manager_id || ''} onChange={e => updateTeamLead(delegate.id, e.target.value)}
                            className="w-full mt-1 p-2 rounded-lg border border-[#DDE4EA] bg-white text-xs text-[#172B4D]">
                            <option value="">Aucun</option>
                            {teamLeadDelegates.filter(t => t.id !== delegate.id).map(t => (
                              <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
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
          })
        )}
      </div>
    </div>
  )
}
