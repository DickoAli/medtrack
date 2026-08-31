import { useState } from 'react'
import { supabase } from '../supabase'

export default function RechercheGlobale({ onBack, profile }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ professionnels: [], delegates: [], visites: [], etablissements: [], produits: [] })
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async (q) => {
    if (q.length < 2) return
    setLoading(true)
    setSearched(true)

    const [{ data: hcp }, { data: del }, { data: vis }, { data: etab }, { data: prod }] = await Promise.all([
      supabase.from('healthcare_professionals')
        .select('*, establishments(nom)')
        .eq('agence_id', profile.agence_id)
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,specialite.ilike.%${q}%`)
        .limit(5),
      supabase.from('delegates')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(5),
      supabase.from('visites')
        .select('*, delegates(nom, prenom)')
        .eq('agence_id', profile.agence_id)
        .or(`nom_contact.ilike.%${q}%,produit.ilike.%${q}%,note.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('establishments')
        .select('*, territories(nom)')
        .eq('agence_id', profile.agence_id)
        .or(`nom.ilike.%${q}%,adresse.ilike.%${q}%`)
        .limit(5),
      supabase.from('produits')
        .select('*, laboratoires(nom)')
        .eq('agence_id', profile.agence_id)
        .or(`nom.ilike.%${q}%,dci.ilike.%${q}%,categorie.ilike.%${q}%`)
        .limit(5)
    ])

    setResults({
      professionnels: hcp || [],
      delegates: del || [],
      visites: vis || [],
      etablissements: etab || [],
      produits: prod || []
    })
    setLoading(false)
  }

  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0)

  const POTENTIAL_COLORS = {
    A: 'bg-rose-100 text-rose-600',
    B: 'bg-amber-100 text-amber-600',
    C: 'bg-slate-100 text-slate-500'
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-black text-lg">Recherche</h1>
          <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
            Recherche globale
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="px-6 pt-4">
        <div className="relative">
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (e.target.value.length >= 2) search(e.target.value)
              else setSearched(false)
            }}
            className="w-full p-4 pl-12 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm"
            placeholder="Rechercher un professionnel, délégué, visite, produit..."
            autoFocus
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
          {query.length > 0 && (
            <button
              onClick={() => { setQuery(''); setSearched(false) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 pb-10">
        {!searched && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-400 text-sm font-bold">Tapez au moins 2 caractères</p>
            <p className="text-slate-300 text-xs mt-1">
              Recherche dans : professionnels, délégués, visites, établissements, produits
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-teal-500 font-bold">Recherche en cours...</p>
          </div>
        )}

        {searched && !loading && totalResults === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">😕</p>
            <p className="text-slate-400 text-sm font-bold">Aucun résultat pour "{query}"</p>
          </div>
        )}

        {/* Professionnels de santé */}
        {results.professionnels.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              👨‍⚕️ Professionnels de santé ({results.professionnels.length})
            </p>
            {results.professionnels.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black px-2 py-1 rounded-full flex-shrink-0 ${POTENTIAL_COLORS[p.potential]}`}>
                    {p.potential}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-blue-950 text-sm">{p.prenom} {p.nom}</p>
                    {p.specialite && <p className="text-xs text-slate-400">{p.specialite}</p>}
                    {p.establishments && <p className="text-xs text-slate-400">🏥 {p.establishments.nom}</p>}
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                    {p.visit_frequency}x/mois
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Délégués */}
        {results.delegates.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              👤 Délégués ({results.delegates.length})
            </p>
            {results.delegates.map(d => (
              <div key={d.id} className="bg-white rounded-2xl p-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center font-black text-blue-950 flex-shrink-0">
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-slate-400">{d.email}</p>
                    {d.telephone && <p className="text-xs text-slate-400">📞 {d.telephone}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visites */}
        {results.visites.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              📍 Visites ({results.visites.length})
            </p>
            {results.visites.map(v => (
              <div key={v.id} className="bg-white rounded-2xl p-4 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-black text-blue-950 text-sm">{v.nom_contact || '—'}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    v.statut === 'Réalisée' ? 'bg-teal-100 text-teal-600' : 'bg-rose-100 text-rose-500'
                  }`}>{v.statut}</span>
                </div>
                <p className="text-xs text-slate-400">
                  👤 {v.delegates?.prenom} {v.delegates?.nom} · {v.created_at?.slice(0, 10)}
                </p>
                {v.produit && <p className="text-xs text-slate-400">💊 {v.produit}</p>}
                {v.confidence_score !== null && v.confidence_score !== undefined && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    v.confidence_status === 'validated' ? 'bg-green-100 text-green-600' :
                    v.confidence_status === 'to_check' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-500'
                  }`}>{v.confidence_score}pts</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Établissements */}
        {results.etablissements.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              🏥 Établissements ({results.etablissements.length})
            </p>
            {results.etablissements.map(e => (
              <div key={e.id} className="bg-white rounded-2xl p-4 mb-2">
                <p className="font-black text-blue-950 text-sm">{e.nom}</p>
                <p className="text-xs text-slate-400">{e.type}</p>
                {e.adresse && <p className="text-xs text-slate-400">📍 {e.adresse}</p>}
                {e.territories && <p className="text-xs text-slate-400">🗺️ {e.territories.nom}</p>}
                {e.latitude && <p className="text-xs bg-teal-50 text-teal-600 font-bold px-2 py-0.5 rounded-full inline-block mt-1">📡 GPS</p>}
              </div>
            ))}
          </div>
        )}

        {/* Produits */}
        {results.produits.length > 0 && (
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              💊 Produits ({results.produits.length})
            </p>
            {results.produits.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-blue-950 text-sm">{p.nom}</p>
                    {p.dci && <p className="text-xs text-slate-400">DCI: {p.dci}</p>}
                    <p className="text-xs text-slate-400">🧪 {p.laboratoires?.nom}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {p.dosage && <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                    {p.forme && <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">{p.forme}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}