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
    delegate_id: '',
    device_name: '',
    device_type: 'tablet',
    device_fingerprint: ''
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

  const resetForm = () => setForm({
    delegate_id: '', device_name: '', device_type: 'tablet', device_fingerprint: ''
  })

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
      agence_id: profile.agence_id,
      delegate_id: form.delegate_id,
      device_name: form.device_name,
      device_type: form.device_type,
      device_fingerprint: form.device_fingerprint || null,
      is_authorized: true,
      registered_by: profile.id,
      registered_at: new Date().toISOString()
    })

    setSaving(false)
    setShowForm(false)
    resetForm()
    setSuccessMsg('Appareil enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const toggleAuthorized = async (appareil) => {
    await supabase.from('devices')
      .update({ is_authorized: !appareil.is_authorized })
      .eq('id', appareil.id)
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
      agence_id: profile.agence_id,
      delegate_id: delegateId,
      device_name: deviceName,
      device_type: 'web',
      device_fingerprint: fp,
      is_authorized: true,
      registered_by: profile.id,
      registered_at: new Date().toISOString()
    })

    setSaving(false)
    setSuccessMsg('Appareil actuel enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const filtered = appareils.filter(a =>
    filterDelegate === 'tous' || a.delegate_id === filterDelegate
  )

  const authorizedCount = appareils.filter(a => a.is_authorized).length
  const revokedCount = appareils.filter(a => !a.is_authorized).length

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
            <h1 className="text-white font-black text-lg">Appareils</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {authorizedCount} autorisé{authorizedCount > 1 ? 's' : ''} · {revokedCount} révoqué{revokedCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowForm(true); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          + Ajouter
        </button>
      </div>

      {/* Info */}
      <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-xs text-blue-700 font-bold mb-1">🔐 Gestion des appareils autorisés</p>
        <p className="text-xs text-blue-600">
          Enregistrez les appareils de vos délégués pour renforcer l'anti-triche. 
          Un appareil non autorisé réduit le score de confiance des visites.
        </p>
      </div>

      {/* Enregistrement rapide */}
      <div className="mx-6 mt-3 bg-white rounded-2xl p-4">
        <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
          ⚡ Enregistrer l'appareil actuel
        </p>
        <div className="flex gap-2">
          <select
            onChange={e => e.target.value && registerCurrentDevice(e.target.value)}
            className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
            <option value="">Sélectionner un délégué...</option>
            {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Enregistre automatiquement cet appareil/navigateur pour le délégué sélectionné
        </p>
      </div>

      {/* Filtre */}
      <div className="px-6 mt-4">
        <select value={filterDelegate} onChange={e => setFilterDelegate(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les délégués</option>
          {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
        </select>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-black text-blue-950 text-lg mb-4">Nouvel appareil</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Délégué *</label>
                <select value={form.delegate_id} onChange={e => set('delegate_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nom de l'appareil *</label>
                <input value={form.device_name} onChange={e => set('device_name', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Tablette Samsung Galaxy Tab" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                <div className="flex gap-2 mt-1">
                  {Object.entries(DEVICE_TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => set('device_type', k)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        form.device_type === k
                          ? 'bg-blue-950 text-white border-blue-950'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empreinte appareil</label>
                <div className="flex gap-2 mt-1">
                  <input value={form.device_fingerprint} onChange={e => set('device_fingerprint', e.target.value)}
                    className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-xs"
                    placeholder="Optionnel" />
                  <button onClick={generateFingerprint}
                    className="bg-blue-950 text-white px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0">
                    Auto
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Clique sur "Auto" pour générer depuis cet appareil</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); resetForm() }}
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

      {/* Liste appareils */}
      <div className="p-6 flex flex-col gap-3 pb-10">
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          {filtered.length} appareil{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📱</p>
            <p className="text-slate-400 text-sm font-bold">Aucun appareil enregistré</p>
            <p className="text-slate-300 text-xs mt-1">
              Enregistrez les appareils de vos délégués pour renforcer la sécurité
            </p>
          </div>
        ) : (
          filtered.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              a.is_authorized ? 'border-teal-400' : 'border-rose-400'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">
                    {DEVICE_TYPES[a.device_type]?.icon || '📱'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-blue-950 text-sm truncate">{a.device_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        a.is_authorized ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'
                      }`}>
                        {a.is_authorized ? '✅ Autorisé' : '🚫 Révoqué'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      👤 {a.delegates?.prenom} {a.delegates?.nom}
                    </p>
                    <p className="text-xs text-slate-400">
                      {DEVICE_TYPES[a.device_type]?.label || a.device_type}
                    </p>
                    {a.device_fingerprint && (
                      <p className="text-xs text-slate-300 font-mono mt-1 truncate">
                        🔑 {a.device_fingerprint}
                      </p>
                    )}
                    {a.last_seen && (
                      <p className="text-xs text-slate-400 mt-1">
                        Vu le {new Date(a.last_seen).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    <p className="text-xs text-slate-300">
                      Enregistré le {new Date(a.registered_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => toggleAuthorized(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      a.is_authorized
                        ? 'bg-rose-50 text-rose-500'
                        : 'bg-teal-50 text-teal-600'
                    }`}>
                    {a.is_authorized ? '🚫 Révoquer' : '✅ Autoriser'}
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    className="bg-slate-50 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold">
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