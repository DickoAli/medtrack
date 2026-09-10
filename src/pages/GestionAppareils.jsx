import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionAppareils({ onBack, profile }) {
  const [appareils, setAppareils] = useState([])
  const [delegates, setDelegates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterDelegate, setFilterDelegate] = useState('tous')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    delegate_id: '', device_name: '', device_type: 'tablet', device_fingerprint: ''
  })

  const DEVICE_TYPES = {
    tablet: { label: 'Tablette', icon: '📱' },
    phone: { label: 'Téléphone', icon: '📞' },
    web: { label: 'Navigateur web', icon: '💻' }
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from('devices')
        .select('*, delegates(nom, prenom)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setAppareils(a || [])
    setDelegates(d || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const resetForm = () => setForm({ delegate_id: '', device_name: '', device_type: 'tablet', device_fingerprint: '' })

  const generateFingerprint = () => {
    const fp = `${navigator.userAgent}-${screen.width}x${screen.height}-${navigator.language}-${Date.now()}`
    const hash = btoa(fp).slice(0, 32)
    set('device_fingerprint', hash)
  }

  const handleSave = async () => {
    if (!form.delegate_id) { alert('Sélectionnez un délégué'); return }
    if (!form.device_name) { alert('Le nom de l\'appareil est obligatoire'); return }
    setSaving(true)

    await supabase.from('devices').insert({
      agence_id: profile.agence_id, delegate_id: form.delegate_id,
      device_name: form.device_name, device_type: form.device_type,
      device_fingerprint: form.device_fingerprint || null,
      is_authorized: true, registered_by: profile.id, registered_at: new Date().toISOString()
    })

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Appareil enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const toggleAuthorized = async (appareil) => {
    await supabase.from('devices').update({ is_authorized: !appareil.is_authorized }).eq('id', appareil.id)
    setSuccessMsg(appareil.is_authorized ? 'Appareil révoqué' : 'Appareil autorisé')
    setTimeout(() => setSuccessMsg(''), 2000)
    fetchAll()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet appareil ?')) return
    await supabase.from('devices').delete().eq('id', id)
    fetchAll()
  }

  const registerCurrentDevice = async (delegateId) => {
    if (!delegateId) { alert('Sélectionnez un délégué'); return }
    setSaving(true)

    const fp = btoa(`${navigator.userAgent}-${screen.width}x${screen.height}-${navigator.language}`).slice(0, 32)
    const deviceName = `${navigator.platform || 'Appareil'} — ${new Date().toLocaleDateString('fr-FR')}`

    const existing = appareils.find(a => a.device_fingerprint === fp && a.delegate_id === delegateId)
    if (existing) {
      alert('Cet appareil est déjà enregistré pour ce délégué')
      setSaving(false)
      return
    }

    await supabase.from('devices').insert({
      agence_id: profile.agence_id, delegate_id: delegateId, device_name: deviceName,
      device_type: 'web', device_fingerprint: fp, is_authorized: true,
      registered_by: profile.id, registered_at: new Date().toISOString()
    })

    setSaving(false)
    setSuccessMsg('Appareil actuel enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const filtered = appareils.filter(a => filterDelegate === 'tous' || a.delegate_id === filterDelegate)
  const authorizedCount = appareils.filter(a => a.is_authorized).length
  const revokedCount = appareils.filter(a => !a.is_authorized).length

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
            <h1 className="text-white font-semibold text-base">Appareils</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {authorizedCount} autorisé{authorizedCount > 1 ? 's' : ''} · {revokedCount} révoqué{revokedCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-[#087F5B] text-white px-4 py-2 rounded-lg font-semibold text-xs">
          + Ajouter
        </button>
      </div>

      <div className="mx-5 mt-4 bg-[#E8F0FE] border border-[#2563EB]/20 rounded-xl p-4">
        <p className="text-xs text-[#2563EB] font-semibold mb-1">🔐 Gestion des appareils autorisés</p>
        <p className="text-xs text-[#2563EB]">
          Enregistrez les appareils de vos délégués pour renforcer l'anti-triche.
          Un appareil non autorisé réduit le score de confiance des visites.
        </p>
      </div>

      <div className="mx-5 mt-3 bg-white rounded-xl p-4 border border-[#DDE4EA]">
        <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
          ⚡ Enregistrer l'appareil actuel
        </p>
        <select
          onChange={e => e.target.value && registerCurrentDevice(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="">Sélectionner un délégué...</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
        <p className="text-xs text-[#98A2B3] mt-2">
          Enregistre automatiquement cet appareil/navigateur pour le délégué sélectionné
        </p>
      </div>

      <div className="px-5 mt-4">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#172B4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-semibold text-[#172B4D] text-lg mb-4">Nouvel appareil</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Nom de l'appareil *</label>
                <input value={form.device_name} onChange={e => set('device_name', e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Ex: Tablette Samsung Galaxy Tab" />
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Type</label>
                <div className="flex gap-2 mt-1">
                  {Object.entries(DEVICE_TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => set('device_type', k)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        form.device_type === k
                          ? 'bg-[#172B4D] text-white border-[#172B4D]'
                          : 'bg-white text-[#667085] border-[#DDE4EA]'
                      }`}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#667085] uppercase tracking-wide">Empreinte appareil</label>
                <div className="flex gap-2 mt-1">
                  <input value={form.device_fingerprint} onChange={e => set('device_fingerprint', e.target.value)}
                    className="flex-1 p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm font-mono text-xs text-[#172B4D]"
                    placeholder="Optionnel" />
                  <button onClick={generateFingerprint}
                    className="bg-[#172B4D] text-white px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0">
                    Auto
                  </button>
                </div>
                <p className="text-xs text-[#98A2B3] mt-1">Clique sur "Auto" pour générer depuis cet appareil</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
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
        <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide">
          {filtered.length} appareil{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">📱</p>
            <p className="text-[#667085] text-sm font-medium">Aucun appareil enregistré</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Enregistrez les appareils de vos délégués pour renforcer la sécurité
            </p>
          </div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: `2px solid ${a.is_authorized ? '#087F5B' : '#DC2626'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{DEVICE_TYPES[a.device_type]?.icon || '📱'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-[#172B4D] text-sm truncate">{a.device_name}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        a.is_authorized ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
                      }`}>
                        {a.is_authorized ? '✅ Autorisé' : '🚫 Révoqué'}
                      </span>
                    </div>
                    <p className="text-xs text-[#667085]">👤 {a.delegates?.prenom} {a.delegates?.nom}</p>
                    <p className="text-xs text-[#667085]">{DEVICE_TYPES[a.device_type]?.label || a.device_type}</p>
                    {a.device_fingerprint && (
                      <p className="text-xs text-[#98A2B3] font-mono mt-1 truncate">🔑 {a.device_fingerprint}</p>
                    )}
                    {a.last_seen && (
                      <p className="text-xs text-[#98A2B3] mt-1">Vu le {new Date(a.last_seen).toLocaleDateString('fr-FR')}</p>
                    )}
                    <p className="text-xs text-[#98A2B3]">Enregistré le {new Date(a.registered_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => toggleAuthorized(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      a.is_authorized ? 'bg-[#FDE8E8] text-[#DC2626]' : 'bg-[#E7F5EF] text-[#087F5B]'
                    }`}>
                    {a.is_authorized ? '🚫 Révoquer' : '✅ Autoriser'}
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    className="bg-[#EEF1F4] text-[#98A2B3] px-3 py-1.5 rounded-lg text-xs font-semibold">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
