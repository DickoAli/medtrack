import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function Rapports({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDelegate, setSelectedDelegate] = useState('tous')
  const [selectedMois, setSelectedMois] = useState(new Date().toISOString().slice(0, 7))
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: d } = await supabase
      .from('delegates')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .order('nom')
    const { data: v } = await supabase
      .from('visites')
      .select('*, delegates(*), medecins(*)')
      .eq('agence_id', profile.agence_id)
      .order('created_at', { ascending: false })
    setDelegates(d || [])
    setVisites(v || [])
    setLoading(false)
  }

  const getVisitesFiltrees = () => {
    return visites.filter(v => {
      const matchDelegate = selectedDelegate === 'tous' || v.delegate_id === selectedDelegate
      const matchMois = v.created_at?.slice(0, 7) === selectedMois
      return matchDelegate && matchMois
    })
  }

  const exportExcel = () => {
    setGenerating(true)
    const data = getVisitesFiltrees()

    if (data.length === 0) {
      alert('Aucune visite pour cette sélection')
      setGenerating(false)
      return
    }

    const rows = data.map(v => ({
      'Date': v.created_at?.slice(0, 10),
      'Heure': v.created_at?.slice(11, 16),
      'Délégué': `${v.delegates?.prenom || ''} ${v.delegates?.nom || ''}`.trim(),
      'Zone': v.delegates?.zone || '',
      'Type de lieu': v.type_lieu || '',
      'Nom contact': v.nom_contact || '',
      'Titre / Fonction': v.titre_contact || '',
      'Téléphone contact': v.telephone_contact || '',
      'Produits présentés': v.produit || '',
      'Statut': v.statut || '',
      'Note': v.note || '',
      'Latitude': v.latitude || '',
      'Longitude': v.longitude || '',
      'Visite planifiée': v.date_prevue ? new Date(v.date_prevue).toLocaleString('fr-FR') : '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // Style des colonnes
    const colWidths = [
      { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
      { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ]
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Visites')

    // Onglet statistiques
    const delegueNom = selectedDelegate === 'tous'
      ? 'Tous les délégués'
      : delegates.find(d => d.id === selectedDelegate)?.nom || ''

    const statsRows = delegates
      .filter(d => selectedDelegate === 'tous' || d.id === selectedDelegate)
      .map(d => {
        const dvs = data.filter(v => v.delegate_id === d.id)
        const realisees = dvs.filter(v => v.statut === 'Réalisée').length
        return {
          'Délégué': `${d.prenom} ${d.nom}`,
          'Zone': d.zone || '',
          'Total visites': dvs.length,
          'Visites réalisées': realisees,
          'Non abouties': dvs.filter(v => v.statut === 'Non aboutie').length,
          'Taux de réussite': dvs.length > 0 ? `${Math.round((realisees / dvs.length) * 100)}%` : '0%',
          'Médecins/contacts visités': new Set(dvs.map(v => v.nom_contact)).size,
        }
      })

    const wsStats = XLSX.utils.json_to_sheet(statsRows)
    wsStats['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques')

    const moisLabel = new Date(selectedMois + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    const fileName = `MedTrack_${delegueNom}_${moisLabel}.xlsx`.replace(/ /g, '_')

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName)
    setGenerating(false)
  }

  const visitesFiltrees = getVisitesFiltrees()
  const realisees = visitesFiltrees.filter(v => v.statut === 'Réalisée').length
  const taux = visitesFiltrees.length > 0 ? Math.round((realisees / visitesFiltrees.length) * 100) : 0

  const MOIS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-black">Rapports</h1>
      </div>

      <div className="p-6 flex flex-col gap-4">

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider">Filtres</p>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mois</label>
            <select
              value={selectedMois}
              onChange={(e) => setSelectedMois(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            >
              {MOIS.map(m => (
                <option key={m} value={m}>
                  {new Date(m + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Délégué</label>
            <select
              value={selectedDelegate}
              onChange={(e) => setSelectedDelegate(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            >
              <option value="tous">Tous les délégués</option>
              {delegates.map(d => (
                <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats du rapport */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
            <p className="text-2xl font-black text-blue-950">{visitesFiltrees.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
            <p className="text-2xl font-black text-blue-950">{taux}%</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Taux réussite</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
            <p className="text-2xl font-black text-blue-950">{realisees}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Réalisées</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400">
            <p className="text-2xl font-black text-blue-950">{visitesFiltrees.length - realisees}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Non abouties</p>
          </div>
        </div>

        {/* Résumé par délégué */}
        {selectedDelegate === 'tous' && (
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">Résumé par délégué</p>
            {delegates.map(d => {
              const dvs = visitesFiltrees.filter(v => v.delegate_id === d.id)
              const dr = dvs.filter(v => v.statut === 'Réalisée').length
              const pct = dvs.length > 0 ? Math.round((dr / dvs.length) * 100) : 0
              return (
                <div key={d.id} className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-blue-950">{d.prenom} {d.nom}</span>
                    <span className="text-xs text-slate-400">{dvs.length} visites · {pct}%</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2">
                    <div className="bg-teal-400 rounded-full h-2" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Export */}
        <button
          onClick={exportExcel}
          disabled={generating || visitesFiltrees.length === 0}
          className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm disabled:opacity-50"
        >
          {generating ? 'Génération...' : `📥 Exporter Excel (${visitesFiltrees.length} visites)`}
        </button>

        {/* Aperçu des visites */}
        <div className="bg-white rounded-2xl p-4">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
            Aperçu — {visitesFiltrees.length} visite{visitesFiltrees.length > 1 ? 's' : ''}
          </p>
          {visitesFiltrees.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Aucune visite pour cette période</p>
          ) : (
            visitesFiltrees.slice(0, 10).map(v => (
              <div key={v.id} className="py-3 border-b border-slate-100 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-blue-950 text-sm">{v.nom_contact || '—'}</p>
                    <p className="text-xs text-slate-400">{v.delegates?.prenom} {v.delegates?.nom} · {v.type_lieu}</p>
                    {v.produit && <p className="text-xs text-teal-600 font-bold mt-0.5">💊 {v.produit}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'}`}>
                      {v.statut}
                    </span>
                    <p className="text-xs text-slate-300 mt-1">{v.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {visitesFiltrees.length > 10 && (
            <p className="text-xs text-slate-400 text-center mt-3">
              + {visitesFiltrees.length - 10} autres visites dans l'export Excel
            </p>
          )}
        </div>
      </div>
    </div>
  )
}