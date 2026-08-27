import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GestionProfessionnels({ onBack, profile }) {
  const [professionnels, setProfessionnels] = useState([])
  const [etablissements, setEtablissements] = useState([])
  const [territoires, setTerritoires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterPotential, setFilterPotential] = useState('tous')
  const [filterType, setFilterType] = useState('tous')

  const [form, setForm] = useState({
    nom: '', prenom: '', specialite: '', type: '',
    establishment_id: '', territory_id: '', telephone: '',
    email: '', potential: 'B', priority: 'medium',
    visit_frequency: 1, statut: 'actif', notes: ''
  })

  const TYPES = [
    { value: 'medecin_generaliste', label: 'Médecin généraliste' },
    { value: 'specialiste', label: 'Spécialiste' },
    { value: 'pharmacien', label: 'Pharmacien' },
    { value: 'infirmier', label: 'Infirmier' },
    { value: 'directeur', label: 'Directeur' },
    { value: 'autre', label: 'Autre' },
  ]

  const POTENTIAL_COLORS = {
    A: 'bg-rose-100 text-rose-600',
    B: 'bg-amber-100 text-amber-600',
    C: 'bg-slate-100 text-slate-500'
  }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: p } = await supabase
      .from('healthcare_professionals')
      .select('*, establishments(nom, type), territories(nom)')
      .eq('agence_id', profile.agence_id)
      .order('nom')

    const { data: e } = await supabase
      .from('establishments')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .eq('is_active', true)
      .order('nom')

    const { data: t } = await supabase
      .from('territories')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .eq('is_active', true)
      .order('nom')

    setProfessionnels(p || [])
    setEtablissements(e || [])
    setTerritoires(t || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const resetForm = () => setForm({
    nom: '', prenom: '', specialite: '', type: '',
    establishment_id: '', territory_id: '', telephone: '',
    email: '', potential: 'B', priority: 'medium',
    visit_frequency: 1, statut: 'actif', notes: ''
  })

  const handleSave = async () => {
    if (!form.nom || !form.prenom) { alert('Nom et prénom obligatoires'); return }
    if (!form.type) { alert('Sélectionnez un type'); return }
    setSaving(true)

    const data = {
      nom: form.nom, prenom: form.prenom,
      specialite: form.specialite,
      type: form.type,
      establishment_id: form.establishment_id || null,
      territory_id: form.territory_id || null,
      telephone: form.telephone, email: form.email,
      potential: form.potential, priority: form.priority,
      visit_frequency: parseInt(form.visit_frequency) || 1,
      statut: form.statut, notes: form.notes,
      agence_id: profile.agence_id,
      updated_at: new Date().toISOString()
    }

    if (editing) {
      await supabase.from('healthcare_professionals').update(data).eq('id', editing)
    } else {
      await supabase.from('healthcare_professionals').insert(data)
    }

    setSaving(false)
    setShowForm(false)
    setEditing(null)
    resetForm()
    setSuccessMsg('Professionnel enregistré !')
    setTimeout(() => setSuccessMsg(''), 3000)
    fetchAll()
  }

  const handleEdit = (p) => {
    setEditing(p.id)
    setForm({
      nom: p.nom, prenom: p.prenom, specialite: p.specialite || '',
      type: p.type || '', establishment_id: p.establishment_id || '',
      territory_id: p.territory_id || '', telephone: p.telephone || '',
      email: p.email || '', potential: p.potential || 'B',
      priority: p.priority || 'medium',
      visit_frequency: p.visit_frequency || 1,
      statut: p.statut || 'actif', notes: p.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce professionnel ?')) return
    await supabase.from('healthcare_professionals').delete().eq('id', id)
    fetchAll()
  }

  const filtered = professionnels.filter(p => {
    const matchSearch = `${p.nom} ${p.prenom} ${p.specialite || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchPotential = filterPotential === 'tous' || p.potential === filterPotential
    const matchType = filterType === 'tous' || p.type === filterType
    return matchSearch && matchPotential && matchType
  })

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Professionnels de santé</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {professionnels.length} professionnel{professionnels.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); resetForm() }}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs"
        >
          + Ajouter
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="🔍 Rechercher par nom, spécialité..."
        />
        <div className="flex gap-2">
          {['tous', 'A', 'B', 'C'].map(p => (
            <button key={p}
              onClick={() => setFilterPotential(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-black border transition-colors ${
                filterPotential === p
                  ? 'bg-blue-950 text-white border-blue-950'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}>
              {p === 'tous' ? 'Tous' : `Potentiel ${p}`}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-blue-950/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-screen overflow-y-auto">
            <h2 className="font-black text-blue-950 text-lg mb-4">
              {editing ? 'Modifier' : 'Nouveau professionnel'}
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type *</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spécialité</label>
                <input value={form.specialite} onChange={e => set('specialite', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Ex: Cardiologue, Pédiatre..." />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Établissement</label>
                <select value={form.establishment_id} onChange={e => set('establishment_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {etablissements.map(e => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Territoire</label>
                <select value={form.territory_id} onChange={e => set('territory_id', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="">Sélectionner...</option>
                  {territoires.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input value={form.telephone} onChange={e => set('telephone', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="00223XXXXXXXX" />
              </div>

              {/* Potentiel */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Potentiel</label>
                <div className="flex gap-2 mt-1">
                  {['A', 'B', 'C'].map(p => (
                    <button key={p} type="button"
                      onClick={() => set('potential', p)}
                      className={`flex-1 py-2 rounded-xl text-sm font-black border transition-colors ${
                        form.potential === p
                          ? p === 'A' ? 'bg-rose-500 text-white border-rose-500'
                            : p === 'B' ? 'bg-amber-400 text-white border-amber-400'
                            : 'bg-slate-400 text-white border-slate-400'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">A = Élevé · B = Moyen · C = Faible</p>
              </div>

              {/* Fréquence */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Visites / mois recommandées
                </label>
                <input type="number" value={form.visit_frequency}
                  onChange={e => set('visit_frequency', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  min="1" max="12" />
              </div>

              {/* Statut */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select value={form.statut} onChange={e => set('statut', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="ne_pas_visiter">Ne pas visiter</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm h-16 resize-none"
                  placeholder="Observations..." />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-sm">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="p-6 flex flex-col gap-3">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          {filtered.length} professionnel{filtered.length > 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">👨‍⚕️</p>
            <p className="text-slate-400 text-sm font-bold">Aucun professionnel trouvé</p>
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              p.statut === 'ne_pas_visiter' ? 'border-rose-400' :
              p.statut === 'inactif' ? 'border-slate-200' : 'border-teal-400'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${POTENTIAL_COLORS[p.potential]}`}>
                      {p.potential}
                    </span>
                    <p className="font-black text-blue-950">
                      {p.prenom} {p.nom}
                    </p>
                  </div>
                  {p.specialite && (
                    <p className="text-xs text-slate-500 font-bold">{p.specialite}</p>
                  )}
                  {p.establishments && (
                    <p className="text-xs text-slate-400">🏥 {p.establishments.nom}</p>
                  )}
                  {p.territories && (
                    <p className="text-xs text-slate-400">🗺️ {p.territories.nom}</p>
                  )}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {p.telephone && (
                      <span className="text-xs text-slate-400">📞 {p.telephone}</span>
                    )}
                    <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                      {p.visit_frequency}x/mois
                    </span>
                    {p.statut === 'ne_pas_visiter' && (
                      <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                        ⛔ Ne pas visiter
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(p)}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">✏️</button>
                  <button onClick={() => handleDelete(p.id)}
                    className="bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}