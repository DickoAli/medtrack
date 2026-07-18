import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Fichiers({ onBack, profile }) {
  const [fichiers, setFichiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterAnnee, setFilterAnnee] = useState('tous')
  const [filterMois, setFilterMois] = useState('tous')
  const [description, setDescription] = useState('')
  const isSuper = profile.role_global === 'superadmin'

  // Pour superadmin qui choisit l'agence cible
  const [agences, setAgences] = useState([])
  const [selectedAgence, setSelectedAgence] = useState(profile.agence_id || '')

  useEffect(() => {
    fetchFichiers()
    if (isSuper) fetchAgences()
  }, [])

  const fetchAgences = async () => {
    const { data } = await supabase.from('agences').select('*').order('nom')
    setAgences(data || [])
  }

  const fetchFichiers = async () => {
    let query = supabase
      .from('fichiers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!isSuper) {
      query = query.eq('agence_id', profile.agence_id)
    } else if (selectedAgence) {
      query = query.eq('agence_id', selectedAgence)
    }

    const { data } = await query
    setFichiers(data || [])
    setLoading(false)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const agenceCible = isSuper ? selectedAgence : profile.agence_id
    if (!agenceCible) { alert('Sélectionnez une agence'); return }

    setUploading(true)

    const now = new Date()
    const annee = now.getFullYear()
    const mois = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    const fileName = `${agenceCible}/${Date.now()}_${file.name}`

    // Upload dans Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('statlabo')
      .upload(fileName, file)

    if (uploadError) {
      alert('Erreur upload: ' + uploadError.message)
      setUploading(false)
      return
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('statlabo')
      .getPublicUrl(fileName)

    // Enregistrer en base
    await supabase.from('fichiers').insert({
      agence_id: agenceCible,
      nom: description || file.name,
      nom_original: file.name,
      url: urlData.publicUrl,
      taille: file.size,
      annee,
      mois,
      description
    })

    setUploading(false)
    setDescription('')
    setSuccessMsg('Fichier déposé avec succès !')
    setTimeout(() => setSuccessMsg(''), 3000)
    e.target.value = ''
    fetchFichiers()
  }

  const handleDelete = async (fichier) => {
    if (!confirm('Supprimer ce fichier ?')) return
    const path = fichier.url.split('/fichiers/')[1]
    await supabase.storage.from('statlabo').remove([path])
    await supabase.from('fichiers').delete().eq('id', fichier.id)
    fetchFichiers()
  }

  const handleDownload = (fichier) => {
    const a = document.createElement('a')
    a.href = fichier.url
    a.download = fichier.nom_original
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatTaille = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  // Années disponibles pour le filtre
  const annees = [...new Set(fichiers.map(f => f.annee))].sort((a, b) => b - a)
  const moisDispo = [...new Set(fichiers.filter(f => filterAnnee === 'tous' || f.annee === Number(filterAnnee)).map(f => f.mois))]

  const fichiersFiltres = fichiers.filter(f => {
    const matchAnnee = filterAnnee === 'tous' || f.annee === Number(filterAnnee)
    const matchMois = filterMois === 'tous' || f.mois === filterMois
    return matchAnnee && matchMois
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
        <h1 className="text-white font-black">Statistiques fichiers</h1>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center">
          <p className="text-teal-600 font-black">✅ {successMsg}</p>
        </div>
      )}

      {/* Zone de dépôt — superadmin seulement */}
      {isSuper && (
        <div className="mx-6 mt-4 bg-white rounded-2xl p-4">
          <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
            📤 Déposer un fichier
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agence cible</label>
              <select
                value={selectedAgence}
                onChange={(e) => { setSelectedAgence(e.target.value); fetchFichiers() }}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
              >
                <option value="">Sélectionner une agence</option>
                {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description du fichier</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Ex: Stats ventes par ville - Janvier 2025"
              />
            </div>

            <label className={`w-full ${uploading ? 'opacity-50' : 'cursor-pointer'}`}>
              <div className="w-full bg-blue-950 text-white font-black py-3 rounded-xl text-sm text-center">
                {uploading ? '⏳ Dépôt en cours...' : '📂 Choisir un fichier Excel'}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="mx-6 mt-4 bg-white rounded-2xl p-4">
        <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">Filtres</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Année</label>
            <select
              value={filterAnnee}
              onChange={(e) => { setFilterAnnee(e.target.value); setFilterMois('tous') }}
              className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            >
              <option value="tous">Toutes</option>
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mois</label>
            <select
              value={filterMois}
              onChange={(e) => setFilterMois(e.target.value)}
              className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
            >
              <option value="tous">Tous</option>
              {moisDispo.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Liste fichiers */}
      <div className="p-6 flex flex-col gap-3">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          {fichiersFiltres.length} fichier{fichiersFiltres.length > 1 ? 's' : ''}
        </p>

        {fichiersFiltres.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-slate-400 text-sm">Aucun fichier disponible</p>
            {!isSuper && (
              <p className="text-slate-300 text-xs mt-1">L'administrateur déposera vos fichiers ici</p>
            )}
          </div>
        ) : (
          fichiersFiltres.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
                  📊
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-blue-950 text-sm">{f.nom}</p>
                  <p className="text-xs text-slate-400 truncate">{f.nom_original}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                      {f.mois}
                    </span>
                    {f.taille && (
                      <span className="text-xs text-slate-400">{formatTaille(f.taille)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Déposé le {new Date(f.created_at).toLocaleDateString('fr-FR')} à {new Date(f.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleDownload(f)}
                  className="flex-1 bg-teal-400 text-blue-950 font-black py-2 rounded-xl text-xs"
                >
                  📥 Télécharger
                </button>
                {isSuper && (
                  <button
                    onClick={() => handleDelete(f)}
                    className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-xs font-black"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}