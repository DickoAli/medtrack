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
        .select('*, establishments(nom), commercial_targets(priority)')
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
      professionnels: hcp || [], delegates: del || [], visites: vis || [],
      etablissements: etab || [], produits: prod || []
    })
    setLoading(false)
  }

  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0)

  const POTENTIAL_COLORS = {
    A: 'bg-[#FDE8E8] text-[#DC2626]',
    B: 'bg-[#FEF3E2] text-[#B45309]',
    C: 'bg-[#EEF1F4] text-[#667085]'
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white font-semibold text-base">Recherche</h1>
          <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
            Recherche globale
          </p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="relative">
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (e.target.value.length >= 2) search(e.target.value)
              else setSearched(false)
            }}
            className="w-full p-4 pl-12 rounded-xl border border-[#DDE4EA] bg-white text-sm text-[#172B4D] shadow-sm"
            placeholder="Rechercher un professionnel, délégué, visite, produit..."
            autoFocus
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3] text-lg">🔍</span>
          {query.length > 0 && (
            <button
              onClick={() => { setQuery(''); setSearched(false) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#98A2B3] font-semibold">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 pb-10">
        {!searched && (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-[#667085] text-sm font-medium">Tapez au moins 2 caractères</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Recherche dans : professionnels, délégués, visites, établissements, produits
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-[#087F5B] font-medium">Recherche en cours...</p>
          </div>
        )}

        {searched && !loading && totalResults === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">😕</p>
            <p className="text-[#667085] text-sm font-medium">Aucun résultat pour "{query}"</p>
          </div>
        )}

        {results.professionnels.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
              Professionnels de santé ({results.professionnels.length})
            </p>
            {results.professionnels.map(p => {
              const target = p.commercial_targets?.[0]
              return (
                <div key={p.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${target ? POTENTIAL_COLORS[target.priority] : 'bg-[#EEF1F4] text-[#98A2B3]'}`}>
                      {target ? target.priority : '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#172B4D] text-sm">{p.prenom} {p.nom}</p>
                      {p.specialite && <p className="text-xs text-[#667085]">{p.specialite}</p>}
                      {p.establishments && <p className="text-xs text-[#667085]">🏥 {p.establishments.nom}</p>}
                    </div>
                    {target && (
                      <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">
                        {target.visit_frequency_default}x/mois
                      </span>
                    )}
                  </div>
              </div>
              )
            })}
          </div>
        )}

        {results.delegates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
              Délégués ({results.delegates.length})
            </p>
            {results.delegates.map(d => (
              <div key={d.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#087F5B] flex items-center justify-center font-semibold text-white flex-shrink-0">
                    {d.prenom?.[0]}{d.nom?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                    <p className="text-xs text-[#667085]">{d.email}</p>
                    {d.telephone && <p className="text-xs text-[#667085]">📞 {d.telephone}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.visites.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
              Visites ({results.visites.length})
            </p>
            {results.visites.map(v => (
              <div key={v.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-[#172B4D] text-sm">{v.nom_contact || '—'}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    v.statut === 'Réalisée' ? 'bg-[#E7F5EF] text-[#087F5B]' : 'bg-[#FDE8E8] text-[#DC2626]'
                  }`}>{v.statut}</span>
                </div>
                <p className="text-xs text-[#667085]">
                  👤 {v.delegates?.prenom} {v.delegates?.nom} · {v.created_at?.slice(0, 10)}
                </p>
                {v.produit && <p className="text-xs text-[#667085]">💊 {v.produit}</p>}
                {v.confidence_score !== null && v.confidence_score !== undefined && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    v.confidence_status === 'validated' ? 'bg-[#E9F9EE] text-[#16A34A]' :
                    v.confidence_status === 'to_check' ? 'bg-[#FEF3E2] text-[#B45309]' :
                    'bg-[#FDE8E8] text-[#DC2626]'
                  }`}>{v.confidence_score}pts</span>
                )}
              </div>
            ))}
          </div>
        )}

        {results.etablissements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
              Établissements ({results.etablissements.length})
            </p>
            {results.etablissements.map(e => (
              <div key={e.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                <p className="font-semibold text-[#172B4D] text-sm">{e.nom}</p>
                <p className="text-xs text-[#667085]">{e.type}</p>
                {e.adresse && <p className="text-xs text-[#667085]">📍 {e.adresse}</p>}
                {e.territories && <p className="text-xs text-[#667085]">🗺️ {e.territories.nom}</p>}
                {e.latitude && <p className="text-xs bg-[#E7F5EF] text-[#087F5B] font-semibold px-2 py-0.5 rounded-full inline-block mt-1">📡 GPS</p>}
              </div>
            ))}
          </div>
        )}

        {results.produits.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
              Produits ({results.produits.length})
            </p>
            {results.produits.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 mb-2 border border-[#DDE4EA]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#172B4D] text-sm">{p.nom}</p>
                    {p.dci && <p className="text-xs text-[#667085]">DCI: {p.dci}</p>}
                    <p className="text-xs text-[#667085]">🧪 {p.laboratoires?.nom}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {p.dosage && <span className="text-xs bg-[#E8F0FE] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full">{p.dosage}</span>}
                    {p.forme && <span className="text-xs bg-[#EEF1F4] text-[#667085] font-semibold px-2 py-0.5 rounded-full">{p.forme}</span>}
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
