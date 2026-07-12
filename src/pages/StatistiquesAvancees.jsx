import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function StatistiquesAvancees({ onBack }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('comparaison')
  const [selectedMois, setSelectedMois] = useState(new Date().toISOString().slice(0, 7))
  const [editingObjectif, setEditingObjectif] = useState(null)
  const [objForm, setObjForm] = useState({ objectif_visites: 0, objectif_medecins: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: d } = await supabase.from('delegates').select('*').order('nom')
    const { data: v } = await supabase
      .from('visites')
      .select('*, delegates(*)')
      .order('created_at', { ascending: false })
    const { data: o } = await supabase.from('objectifs').select('*')
    setDelegates(d || [])
    setVisites(v || [])
    setObjectifs(o || [])
    setLoading(false)
  }

  const getStats = (delegateId, mois) => {
    const dv = visites.filter(v =>
      v.delegate_id === delegateId &&
      v.created_at?.slice(0, 7) === mois
    )
    const realisees = dv.filter(v => v.statut === 'Réalisée').length
    const contacts = new Set(dv.map(v => v.nom_contact).filter(Boolean)).size
    const taux = dv.length > 0 ? Math.round((realisees / dv.length) * 100) : 0
    return { total: dv.length, realisees, contacts, taux }
  }

  const getObjectif = (delegateId, mois) => {
    return objectifs.find(o => o.delegate_id === delegateId && o.mois === mois)
  }

  const handleSaveObjectif = async (delegateId) => {
    setSaving(true)
    const existing = getObjectif(delegateId, selectedMois)
    if (existing) {
      await supabase.from('objectifs').update({
        objectif_visites: Number(objForm.objectif_visites),
        objectif_medecins: Number(objForm.objectif_medecins)
      }).eq('id', existing.id)
    } else {
      await supabase.from('objectifs').insert({
        delegate_id: delegateId,
        mois: selectedMois,
        objectif_visites: Number(objForm.objectif_visites),
        objectif_medecins: Number(objForm.objectif_medecins)
      })
    }
    setSaving(false)
    setEditingObjectif(null)
    fetchData()
  }

  // Classement produits
  const getProduitStats = () => {
    const moisVisites = visites.filter(v => v.created_at?.slice(0, 7) === selectedMois)
    const produitMap = {}
    moisVisites.forEach(v => {
      if (!v.produit) return
      v.produit.split(', ').forEach(p => {
        if (!p.trim()) return
        produitMap[p.trim()] = (produitMap[p.trim()] || 0) + 1
      })
    })
    return Object.entries(produitMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nom, count]) => ({ nom, count }))
  }

  const MOIS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  const moisLabel = (m) => new Date(m + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })

  const produitStats = getProduitStats()
  const maxProduit = produitStats[0]?.count || 1

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-black">Statistiques avancées</h1>
      </div>

      {/* Sélecteur mois */}
      <div className="px-6 pt-4">
        <select
          value={selectedMois}
          onChange={(e) => setSelectedMois(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-blue-950"
        >
          {MOIS.map(m => <option key={m} value={m}>{moisLabel(m)}</option>)}
        </select>
      </div>

      {/* Onglets */}
      <div className="bg-white flex border-b border-slate-200 mt-4">
        {[
          { id: 'comparaison', label: '⚖️ Comparaison' },
          { id: 'objectifs', label: '🎯 Objectifs' },
          { id: 'produits', label: '💊 Produits' },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => setOnglet(n.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${onglet === n.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'}`}
          >
            {n.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex flex-col gap-4">

        {/* COMPARAISON */}
        {onglet === 'comparaison' && (
          <>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Comparaison — {moisLabel(selectedMois)}
            </p>

            {/* Classement */}
            {delegates
              .map(d => ({ ...d, stats: getStats(d.id, selectedMois) }))
              .sort((a, b) => b.stats.total - a.stats.total)
              .map((d, i) => (
                <div key={d.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-slate-300 text-white' :
                      i === 2 ? 'bg-orange-400 text-white' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-blue-950">{d.prenom} {d.nom}</p>
                      <p className="text-xs text-slate-400">{d.zone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-teal-500 text-xl">{d.stats.total}</p>
                      <p className="text-xs text-slate-400">visites</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-teal-50 rounded-xl p-2 text-center">
                      <p className="font-black text-teal-600">{d.stats.realisees}</p>
                      <p className="text-xs text-slate-400">réalisées</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-2 text-center">
                      <p className="font-black text-purple-600">{d.stats.contacts}</p>
                      <p className="text-xs text-slate-400">contacts</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-2 text-center">
                      <p className="font-black text-amber-600">{d.stats.taux}%</p>
                      <p className="text-xs text-slate-400">réussite</p>
                    </div>
                  </div>

                  {/* Barre taux */}
                  <div className="bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-teal-400 rounded-full h-2 transition-all"
                      style={{ width: `${d.stats.taux}%` }}
                    />
                  </div>
                </div>
              ))}
          </>
        )}

        {/* OBJECTIFS */}
        {onglet === 'objectifs' && (
          <>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Objectifs — {moisLabel(selectedMois)}
            </p>

            {delegates.map(d => {
              const stats = getStats(d.id, selectedMois)
              const obj = getObjectif(d.id, selectedMois)
              const pctVisites = obj?.objectif_visites > 0
                ? Math.min(Math.round((stats.total / obj.objectif_visites) * 100), 100)
                : 0
              const pctMedecins = obj?.objectif_medecins > 0
                ? Math.min(Math.round((stats.contacts / obj.objectif_medecins) * 100), 100)
                : 0
              const isEditing = editingObjectif === d.id

              return (
                <div key={d.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-black text-blue-950">{d.prenom} {d.nom}</p>
                      <p className="text-xs text-slate-400">{d.zone}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingObjectif(isEditing ? null : d.id)
                        setObjForm({
                          objectif_visites: obj?.objectif_visites || 0,
                          objectif_medecins: obj?.objectif_medecins || 0
                        })
                      }}
                      className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                    >
                      {isEditing ? 'Annuler' : '🎯 Définir'}
                    </button>
                  </div>

                  {isEditing && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objectif visites</label>
                        <input
                          type="number"
                          value={objForm.objectif_visites}
                          onChange={(e) => setObjForm(f => ({ ...f, objectif_visites: e.target.value }))}
                          className="w-full mt-1 p-2 rounded-lg border border-slate-200 bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objectif contacts</label>
                        <input
                          type="number"
                          value={objForm.objectif_medecins}
                          onChange={(e) => setObjForm(f => ({ ...f, objectif_medecins: e.target.value }))}
                          className="w-full mt-1 p-2 rounded-lg border border-slate-200 bg-white text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveObjectif(d.id)}
                        disabled={saving}
                        className="w-full bg-teal-400 text-blue-950 font-black py-2 rounded-lg text-sm"
                      >
                        {saving ? '...' : 'Enregistrer'}
                      </button>
                    </div>
                  )}

                  {obj ? (
                    <>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Visites</span>
                          <span className="font-bold text-blue-950">{stats.total} / {obj.objectif_visites}</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all ${pctVisites >= 100 ? 'bg-teal-400' : pctVisites >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${pctVisites}%` }}
                          />
                        </div>
                        <p className="text-xs text-right mt-0.5 font-bold" style={{ color: pctVisites >= 100 ? '#00C9B1' : pctVisites >= 70 ? '#F59E0B' : '#F43F5E' }}>
                          {pctVisites}%
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Contacts</span>
                          <span className="font-bold text-blue-950">{stats.contacts} / {obj.objectif_medecins}</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all ${pctMedecins >= 100 ? 'bg-teal-400' : pctMedecins >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${pctMedecins}%` }}
                          />
                        </div>
                        <p className="text-xs text-right mt-0.5 font-bold" style={{ color: pctMedecins >= 100 ? '#00C9B1' : pctMedecins >= 70 ? '#F59E0B' : '#F43F5E' }}>
                          {pctMedecins}%
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">Aucun objectif défini pour ce mois</p>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* PRODUITS */}
        {onglet === 'produits' && (
          <>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Produits les plus présentés — {moisLabel(selectedMois)}
            </p>

            {produitStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">Aucune visite ce mois-ci</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
                {produitStats.map((p, i) => (
                  <div key={p.nom}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? 'bg-amber-400 text-white' :
                          i === 1 ? 'bg-slate-300 text-white' :
                          i === 2 ? 'bg-orange-400 text-white' :
                          'bg-slate-100 text-slate-500'
                        }`}>{i + 1}</span>
                        <span className="font-bold text-blue-950 text-sm">{p.nom}</span>
                      </div>
                      <span className="font-black text-teal-500">{p.count} fois</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-teal-400 rounded-full h-2 transition-all"
                        style={{ width: `${Math.round((p.count / maxProduit) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}