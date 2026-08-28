import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function Rapports({ onBack, profile }) {
  const [visites, setVisites] = useState([])
  const [delegates, setDelegates] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    delegate_id: 'tous',
    campaign_id: 'tous',
    month: 'tous',
    year: new Date().getFullYear(),
    statut: 'tous',
    confidence: 'tous'
  })

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: v }, { data: d }, { data: c }] = await Promise.all([
      supabase.from('visites')
        .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, potential, specialite), establishments(nom, type), campaigns(nom)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('campaigns').select('*').eq('agence_id', profile.agence_id).order('nom')
    ])
    setVisites(v || [])
    setDelegates(d || [])
    setCampagnes(c || [])
    setLoading(false)
  }

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const filtered = visites.filter(v => {
    const matchDelegate = filters.delegate_id === 'tous' || v.delegate_id === filters.delegate_id
    const matchCampaign = filters.campaign_id === 'tous' || v.campaign_id === filters.campaign_id
    const matchMonth = filters.month === 'tous' || new Date(v.created_at).getMonth() + 1 === parseInt(filters.month)
    const matchYear = !filters.year || new Date(v.created_at).getFullYear() === parseInt(filters.year)
    const matchStatut = filters.statut === 'tous' || v.statut === filters.statut
    const matchConfidence = filters.confidence === 'tous' || v.confidence_status === filters.confidence
    return matchDelegate && matchCampaign && matchMonth && matchYear && matchStatut && matchConfidence
  })

  const exportExcel = async () => {
    setExporting(true)

    // Onglet 1 — Visites détaillées
    const visitesData = filtered.map(v => ({
      'Date': v.created_at?.slice(0, 10),
      'Délégué': `${v.delegates?.prenom || ''} ${v.delegates?.nom || ''}`.trim(),
      'Contact': v.healthcare_professionals
        ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}`
        : v.nom_contact || '—',
      'Spécialité': v.healthcare_professionals?.specialite || v.titre_contact || '—',
      'Potentiel': v.healthcare_professionals?.potential || '—',
      'Établissement': v.establishments?.nom || v.type_lieu || '—',
      'Type établissement': v.establishments?.type || '—',
      'Campagne': v.campaigns?.nom || '—',
      'Produits présentés': v.produit || '—',
      'Statut': v.statut || '—',
      'Type visite': v.visit_type || 'immediate',
      'Score confiance': v.confidence_score ?? '—',
      'Statut confiance': v.confidence_status === 'validated' ? '✅ Validée' :
        v.confidence_status === 'to_check' ? '⚠️ À contrôler' :
        v.confidence_status === 'suspicious' ? '🚨 Suspecte' : '—',
      'GPS conforme': v.geofence_compliant === true ? 'Oui' : v.geofence_compliant === false ? 'Non' : '—',
      'Distance établissement (m)': v.distance_to_establishment ?? '—',
      'Durée (min)': v.duration_minutes ?? '—',
      'Note': v.note || '—',
      'Latitude': v.latitude || v.gps_start_lat || '—',
      'Longitude': v.longitude || v.gps_start_lng || '—',
    }))

    // Onglet 2 — Statistiques par délégué
    const statsDelegate = delegates.map(d => {
      const dvs = filtered.filter(v => v.delegate_id === d.id)
      const realisees = dvs.filter(v => v.statut === 'Réalisée')
      const validees = dvs.filter(v => v.confidence_status === 'validated')
      const suspectes = dvs.filter(v => v.confidence_status === 'suspicious')
      const avgScore = dvs.filter(v => v.confidence_score).length > 0
        ? Math.round(dvs.filter(v => v.confidence_score).reduce((s, v) => s + v.confidence_score, 0) / dvs.filter(v => v.confidence_score).length)
        : '—'
      return {
        'Délégué': `${d.prenom} ${d.nom}`,
        'Total visites': dvs.length,
        'Réalisées': realisees.length,
        'Taux réalisation (%)': dvs.length > 0 ? Math.round((realisees.length / dvs.length) * 100) : 0,
        'Validées (anti-triche)': validees.length,
        'Suspectes': suspectes.length,
        'Score confiance moyen': avgScore,
      }
    })

    // Onglet 3 — Statistiques par campagne
    const statsCampaign = campagnes.map(c => {
      const cvs = filtered.filter(v => v.campaign_id === c.id)
      const realisees = cvs.filter(v => v.statut === 'Réalisée')
      return {
        'Campagne': c.nom,
        'Statut': c.statut,
        'Total visites': cvs.length,
        'Réalisées': realisees.length,
        'Taux réalisation (%)': cvs.length > 0 ? Math.round((realisees.length / cvs.length) * 100) : 0,
        'Objectif': c.visits_objective || '—',
        'Progression (%)': c.visits_objective
          ? Math.round((realisees.length / c.visits_objective) * 100)
          : '—',
      }
    })

    // Onglet 4 — Anti-triche
    const antiTriche = filtered.filter(v => v.confidence_status).map(v => ({
      'Date': v.created_at?.slice(0, 10),
      'Délégué': `${v.delegates?.prenom || ''} ${v.delegates?.nom || ''}`.trim(),
      'Contact': v.nom_contact || '—',
      'Score': v.confidence_score ?? '—',
      'Statut': v.confidence_status === 'validated' ? 'Validée' :
        v.confidence_status === 'to_check' ? 'À contrôler' : 'Suspecte',
      'GPS conforme': v.geofence_compliant === true ? 'Oui' : v.geofence_compliant === false ? 'Non' : '—',
      'Distance (m)': v.distance_to_establishment ?? '—',
      'Durée (min)': v.duration_minutes ?? '—',
    }))

    const wb = XLSX.utils.book_new()

    const ws1 = XLSX.utils.json_to_sheet(visitesData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Visites détaillées')

    const ws2 = XLSX.utils.json_to_sheet(statsDelegate)
    XLSX.utils.book_append_sheet(wb, ws2, 'Stats délégués')

    const ws3 = XLSX.utils.json_to_sheet(statsCampaign)
    XLSX.utils.book_append_sheet(wb, ws3, 'Stats campagnes')

    const ws4 = XLSX.utils.json_to_sheet(antiTriche)
    XLSX.utils.book_append_sheet(wb, ws4, 'Anti-triche')

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const fileName = `MedTrack_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName)
    setExporting(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  const realisees = filtered.filter(v => v.statut === 'Réalisée')
  const validees = filtered.filter(v => v.confidence_status === 'validated')
  const suspectes = filtered.filter(v => v.confidence_status === 'suspicious')
  const aControler = filtered.filter(v => v.confidence_status === 'to_check')

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Rapports & Export</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {filtered.length} visite{filtered.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
          className="bg-teal-400 text-blue-950 px-4 py-2 rounded-xl font-black text-xs">
          {exporting ? '...' : '📥 Excel'}
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider">Filtres</p>

          <select value={filters.delegate_id} onChange={e => set('delegate_id', e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
            <option value="tous">Tous les délégués</option>
            {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
          </select>

          <select value={filters.campaign_id} onChange={e => set('campaign_id', e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
            <option value="tous">Toutes les campagnes</option>
            {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select value={filters.month} onChange={e => set('month', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
              <option value="tous">Tous les mois</option>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={filters.year} onChange={e => set('year', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              placeholder="Année" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select value={filters.statut} onChange={e => set('statut', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
              <option value="tous">Tous les statuts</option>
              <option value="Réalisée">Réalisée</option>
              <option value="Non aboutie">Non aboutie</option>
              <option value="Planifiée">Planifiée</option>
            </select>
            <select value={filters.confidence} onChange={e => set('confidence', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
              <option value="tous">Tous scores</option>
              <option value="validated">✅ Validée</option>
              <option value="to_check">⚠️ À contrôler</option>
              <option value="suspicious">🚨 Suspecte</option>
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
            <p className="text-2xl font-black text-blue-950">{filtered.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
            <p className="text-2xl font-black text-blue-950">{realisees.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Réalisées</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-green-400">
            <p className="text-2xl font-black text-blue-950">{validees.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">✅ Validées</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
            <p className="text-2xl font-black text-blue-950">{aControler.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">⚠️ À contrôler</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-rose-400 col-span-2">
            <p className="text-2xl font-black text-blue-950">{suspectes.length}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">🚨 Suspectes</p>
          </div>
        </div>

        {/* Info export */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs text-blue-700 font-black mb-1">📊 L'export Excel contient 4 onglets :</p>
          <p className="text-xs text-blue-600">1. Visites détaillées (avec campagne, cibles, GPS, score)</p>
          <p className="text-xs text-blue-600">2. Statistiques par délégué</p>
          <p className="text-xs text-blue-600">3. Statistiques par campagne</p>
          <p className="text-xs text-blue-600">4. Rapport anti-triche</p>
        </div>

        {/* Liste visites */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          Aperçu — {filtered.length} visite{filtered.length > 1 ? 's' : ''}
        </p>
        {filtered.slice(0, 20).map(v => (
          <div key={v.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
            v.confidence_status === 'suspicious' ? 'border-rose-400' :
            v.confidence_status === 'to_check' ? 'border-amber-400' :
            v.confidence_status === 'validated' ? 'border-green-400' : 'border-slate-200'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-black text-blue-950 text-sm">
                    {v.healthcare_professionals
                      ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}`
                      : v.nom_contact || '—'}
                  </p>
                  {v.healthcare_professionals?.potential && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      v.healthcare_professionals.potential === 'A' ? 'bg-rose-100 text-rose-600' :
                      v.healthcare_professionals.potential === 'B' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>{v.healthcare_professionals.potential}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  👤 {v.delegates?.prenom} {v.delegates?.nom}
                </p>
                {v.campaigns && <p className="text-xs text-slate-400">🎯 {v.campaigns.nom}</p>}
                {v.establishments && <p className="text-xs text-slate-400">🏥 {v.establishments.nom}</p>}
                <p className="text-xs text-slate-300 mt-1">{v.created_at?.slice(0, 10)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' :
                  v.statut === 'Planifiée' ? 'bg-amber-100 text-amber-600' :
                  'bg-rose-100 text-rose-500'
                }`}>{v.statut}</span>
                {v.confidence_score !== null && v.confidence_score !== undefined && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                    v.confidence_status === 'validated' ? 'bg-green-100 text-green-600' :
                    v.confidence_status === 'to_check' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-500'
                  }`}>
                    {v.confidence_score}pts
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length > 20 && (
          <p className="text-xs text-slate-400 text-center">
            +{filtered.length - 20} visites dans l'export Excel
          </p>
        )}
      </div>
    </div>
  )
}