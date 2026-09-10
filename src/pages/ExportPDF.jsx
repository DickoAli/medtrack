import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ExportPDF({ onBack, profile, agence }) {
  const [delegates, setDelegates] = useState([])
  const [visites, setVisites] = useState([])
  const [coaching, setCoaching] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState('tous')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // Palette PDF (RGB) alignée sur Medtrack
  const PDF_DARK = [23, 43, 77]     // #172B4D
  const PDF_PRIMARY = [8, 127, 91]  // #087F5B
  const PDF_GRAY = [102, 112, 133]  // #667085
  const PDF_LIGHT = [244, 247, 249] // #F4F7F9

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d }, { data: v }, { data: co }] = await Promise.all([
      supabase.from('delegates').select('*').eq('agence_id', profile.agence_id).order('nom'),
      supabase.from('visites')
        .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom, specialite), establishments(nom), campaigns(nom)')
        .eq('agence_id', profile.agence_id)
        .order('created_at', { ascending: false }),
      supabase.from('coaching_reports').select('*, delegates(nom, prenom)').eq('evaluator_id', profile.id).order('created_at', { ascending: false })
    ])
    setDelegates(d || [])
    setVisites(v || [])
    setCoaching(co || [])
    setLoading(false)
  }

  const getFilteredVisites = () => visites.filter(v => {
    const matchDelegate = selectedDelegate === 'tous' || v.delegate_id === selectedDelegate
    const matchMonth = new Date(v.created_at).getMonth() + 1 === selectedMonth
    const matchYear = new Date(v.created_at).getFullYear() === selectedYear
    return matchDelegate && matchMonth && matchYear
  })

  const addHeader = (doc, title, subtitle) => {
    doc.setFillColor(...PDF_DARK)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('MedTrack', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(agence?.nom || '', 14, 20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_DARK)
    doc.text(title, 14, 42)
    if (subtitle) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...PDF_GRAY)
      doc.text(subtitle, 14, 50)
    }
    doc.setTextColor(0, 0, 0)
    return subtitle ? 58 : 50
  }

  const addFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`MedTrack · ${agence?.nom || ''} · Généré le ${new Date().toLocaleDateString('fr-FR')} · Page ${i}/${pageCount}`, 14, 290)
    }
  }

  const generateRapportVisites = () => {
    setGenerating(true)
    try {
    const doc = new jsPDF()
    const filtered = getFilteredVisites()
    const delegate = delegates.find(d => d.id === selectedDelegate)
    const title = `Rapport des visites — ${MONTHS[selectedMonth - 1]} ${selectedYear}`
    const subtitle = selectedDelegate !== 'tous' ? `Délégué : ${delegate?.prenom} ${delegate?.nom}` : `Tous les délégués`

    let y = addHeader(doc, title, subtitle)

    const realisees = filtered.filter(v => v.statut === 'Réalisée').length
    const nonAbouties = filtered.filter(v => v.statut === 'Non aboutie').length
    const validated = filtered.filter(v => v.confidence_status === 'validated').length
    const suspicious = filtered.filter(v => v.confidence_status === 'suspicious').length
    const taux = filtered.length > 0 ? Math.round((realisees / filtered.length) * 100) : 0

    doc.setFillColor(...PDF_LIGHT)
    doc.rect(14, y, 182, 28, 'F')
    doc.setFontSize(9)
    doc.setTextColor(...PDF_GRAY)
    doc.text('Total visites', 20, y + 8)
    doc.text('Réalisées', 60, y + 8)
    doc.text('Non abouties', 100, y + 8)
    doc.text('Taux réalisation', 145, y + 8)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_DARK)
    doc.text(String(filtered.length), 20, y + 20)
    doc.text(String(realisees), 60, y + 20)
    doc.text(String(nonAbouties), 100, y + 20)
    doc.text(`${taux}%`, 145, y + 20)
    doc.setFont('helvetica', 'normal')

    y += 35
    doc.setFontSize(9)
    doc.setTextColor(...PDF_GRAY)
    doc.text(`Visites validées (anti-triche) : ${validated}   Visites suspectes : ${suspicious}`, 14, y)
    y += 10

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Délégué', 'Contact', 'Lieu', 'Produits', 'Statut', 'Score']],
      body: filtered.map(v => [
        v.created_at?.slice(0, 10) || '',
        `${v.delegates?.prenom || ''} ${v.delegates?.nom || ''}`.trim(),
        v.healthcare_professionals ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}` : v.nom_contact || '—',
        v.establishments?.nom || v.type_lieu || '—',
        (v.produit || '—').slice(0, 30),
        v.statut || '—',
        v.confidence_score !== null && v.confidence_score !== undefined ? `${v.confidence_score}pts` : '—'
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: PDF_DARK, textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 28 }, 2: { cellWidth: 30 }, 3: { cellWidth: 25 }, 4: { cellWidth: 40 }, 5: { cellWidth: 20 }, 6: { cellWidth: 15 } }
    })

    addFooter(doc)
    doc.save(`rapport_visites_${MONTHS[selectedMonth - 1]}_${selectedYear}.pdf`)
    } catch (err) {
      console.error('Erreur génération PDF:', err)
      alert('Erreur lors de la génération du PDF: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const generateFicheDelegue = (delegate) => {
    setGenerating(true)
    try {
    const doc = new jsPDF()
    const dvs = visites.filter(v => v.delegate_id === delegate.id)
    const thisMonth = dvs.filter(v => new Date(v.created_at).getMonth() + 1 === selectedMonth && new Date(v.created_at).getFullYear() === selectedYear)
    const realisees = thisMonth.filter(v => v.statut === 'Réalisée')
    const coachingDel = coaching.filter(c => c.delegate_id === delegate.id)
    const avgCoaching = coachingDel.length > 0
      ? (coachingDel.reduce((s, c) => s + parseFloat(c.global_score), 0) / coachingDel.length).toFixed(1) : null

    let y = addHeader(doc, `Fiche délégué`, `${delegate.prenom} ${delegate.nom}`)

    doc.setFillColor(...PDF_LIGHT)
    doc.rect(14, y, 182, 35, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_DARK)
    doc.text(`${delegate.prenom} ${delegate.nom}`, 20, y + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...PDF_GRAY)
    if (delegate.email) doc.text(`Email : ${delegate.email}`, 20, y + 18)
    if (delegate.telephone) doc.text(`Tél : ${delegate.telephone}`, 20, y + 25)
    doc.text(`Total visites : ${dvs.length}`, 120, y + 10)
    doc.text(`${MONTHS[selectedMonth - 1]} ${selectedYear} : ${thisMonth.length} visites`, 120, y + 18)
    doc.text(`Réalisées : ${realisees.length}`, 120, y + 25)
    if (avgCoaching) doc.text(`Score coaching : ${avgCoaching}/5`, 120, y + 32)
    y += 42

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_DARK)
    doc.text(`Visites de ${MONTHS[selectedMonth - 1]} ${selectedYear}`, 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Contact', 'Spécialité', 'Lieu', 'Produits', 'Statut', 'Score']],
      body: thisMonth.map(v => [
        v.created_at?.slice(0, 10) || '',
        v.healthcare_professionals ? `${v.healthcare_professionals.prenom} ${v.healthcare_professionals.nom}` : v.nom_contact || '—',
        v.healthcare_professionals?.specialite || v.titre_contact || '—',
        v.establishments?.nom || v.type_lieu || '—',
        (v.produit || '—').slice(0, 25),
        v.statut || '—',
        v.confidence_score !== null && v.confidence_score !== undefined ? `${v.confidence_score}pts` : '—'
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: PDF_DARK, textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    })

    if (coachingDel.length > 0) {
      const lastY = doc.lastAutoTable.finalY + 10
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Historique coaching', 14, lastY)

      autoTable(doc, {
        startY: lastY + 5,
        head: [['Date', 'Score global', 'Points forts', 'À améliorer']],
        body: coachingDel.slice(0, 5).map(c => [
          new Date(c.created_at).toLocaleDateString('fr-FR'),
          `${parseFloat(c.global_score).toFixed(1)}/5`,
          (c.strengths || '—').slice(0, 40),
          (c.improvements || '—').slice(0, 40)
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PDF_DARK, textColor: 255 }
      })
    }

    addFooter(doc)
    doc.save(`fiche_delegue_${delegate.nom}_${MONTHS[selectedMonth - 1]}_${selectedYear}.pdf`)
    } catch (err) {
      console.error('Erreur génération PDF:', err)
      alert('Erreur lors de la génération du PDF: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const generateRapportCoaching = () => {
    setGenerating(true)
    try {
    const doc = new jsPDF()
    let y = addHeader(doc, 'Rapport de coaching', `Généré le ${new Date().toLocaleDateString('fr-FR')}`)

    const byDelegate = delegates.map(d => {
      const raps = coaching.filter(c => c.delegate_id === d.id)
      if (raps.length === 0) return null
      const avg = (raps.reduce((s, c) => s + parseFloat(c.global_score), 0) / raps.length).toFixed(1)
      return { delegate: d, avg: parseFloat(avg), count: raps.length }
    }).filter(Boolean).sort((a, b) => b.avg - a.avg)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_DARK)
    doc.text('Classement coaching', 14, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [['Rang', 'Délégué', 'Score moyen', 'Évaluations', 'Niveau']],
      body: byDelegate.map((d, i) => [
        `#${i + 1}`, `${d.delegate.prenom} ${d.delegate.nom}`, `${d.avg}/5`, d.count,
        d.avg >= 4 ? 'Excellent' : d.avg >= 3 ? 'Satisfaisant' : 'À améliorer'
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: PDF_DARK, textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    })

    const lastY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Détail des évaluations', 14, lastY)

    autoTable(doc, {
      startY: lastY + 5,
      head: [['Date', 'Délégué', 'Score', 'Points forts', 'À améliorer', 'Recommandations']],
      body: coaching.slice(0, 20).map(c => [
        new Date(c.created_at).toLocaleDateString('fr-FR'),
        `${c.delegates?.prenom || ''} ${c.delegates?.nom || ''}`.trim(),
        `${parseFloat(c.global_score).toFixed(1)}/5`,
        (c.strengths || '—').slice(0, 30),
        (c.improvements || '—').slice(0, 30),
        (c.recommendations || '—').slice(0, 30)
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: PDF_DARK, textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    })

    addFooter(doc)
    doc.save(`rapport_coaching_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Erreur génération PDF:', err)
      alert('Erreur lors de la génération du PDF: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  const filtered = getFilteredVisites()

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-semibold text-base">Export PDF</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            Rapports professionnels
          </p>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">

        <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
          <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">Paramètres</p>

          <select value={selectedDelegate} onChange={e => setSelectedDelegate(e.target.value)}
            className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
            <option value="tous">Tous les délégués</option>
            {delegates.map(d => <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]" />
          </div>

          <div className="bg-[#F4F7F9] rounded-lg p-3 text-center">
            <p className="text-xs text-[#98A2B3] font-medium">
              {filtered.length} visite{filtered.length > 1 ? 's' : ''} dans la sélection
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
          <p className="font-semibold text-[#172B4D] mb-1">📊 Rapport mensuel des visites</p>
          <p className="text-xs text-[#667085] mb-3">
            Tableau complet avec statuts, scores anti-triche et produits présentés
          </p>
          <button onClick={generateRapportVisites} disabled={generating || filtered.length === 0}
            className={`w-full font-semibold py-3 rounded-lg text-sm ${
              filtered.length === 0 ? 'bg-[#EEF1F4] text-[#98A2B3]' : 'bg-[#172B4D] text-white'
            }`}>
            {generating ? '⏳ Génération...' : '📄 Générer le rapport mensuel'}
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
          <p className="font-semibold text-[#172B4D] mb-1">👤 Fiches délégués individuelles</p>
          <p className="text-xs text-[#667085] mb-3">
            Fiche complète par délégué avec visites, stats et historique coaching
          </p>
          <div className="flex flex-col gap-2">
            {delegates.map(d => (
              <button key={d.id} onClick={() => generateFicheDelegue(d)} disabled={generating}
                className="w-full bg-[#F4F7F9] text-[#172B4D] font-medium py-3 rounded-lg text-sm flex items-center gap-3 px-4">
                <div className="w-8 h-8 rounded-full bg-[#172B4D] flex items-center justify-center font-semibold text-[#087F5B] text-xs flex-shrink-0">
                  {d.prenom?.[0]}{d.nom?.[0]}
                </div>
                <span className="flex-1 text-left">{d.prenom} {d.nom}</span>
                <span className="text-[#98A2B3] text-xs">
                  {visites.filter(v => v.delegate_id === d.id &&
                    new Date(v.created_at).getMonth() + 1 === selectedMonth &&
                    new Date(v.created_at).getFullYear() === selectedYear
                  ).length} visites
                </span>
                <span className="text-[#172B4D]">📄</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
          <p className="font-semibold text-[#172B4D] mb-1">🏆 Rapport coaching</p>
          <p className="text-xs text-[#667085] mb-3">
            Classement et détail de toutes les évaluations coaching
          </p>
          <button onClick={generateRapportCoaching} disabled={generating || coaching.length === 0}
            className={`w-full font-semibold py-3 rounded-lg text-sm ${
              coaching.length === 0 ? 'bg-[#EEF1F4] text-[#98A2B3]' : 'bg-[#087F5B] text-white'
            }`}>
            {generating ? '⏳ Génération...' : '🏆 Générer le rapport coaching'}
          </button>
          {coaching.length === 0 && (
            <p className="text-xs text-[#98A2B3] text-center mt-2">
              Aucune évaluation coaching disponible
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
