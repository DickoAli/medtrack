import { useState } from 'react'
import { supabase } from '../supabase'

export default function Onboarding({ profile, agence, onComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [laboForm, setLaboForm] = useState({ nom: '', pays: 'Mali', email: '', telephone: '' })
  const [produitForm, setProduitForm] = useState({ nom: '', dci: '', dosage: '', forme: '', laboratoire_id: '' })
  const [delegueForm, setDelegueForm] = useState({ nom: '', prenom: '', email: '', telephone: '' })
  const [territoireForm, setTerritoireForm] = useState({ nom: '', code: '', geography_id: '' })
  const [geographies, setGeographies] = useState([])
  const [labos, setLabos] = useState([])
  const [created, setCreated] = useState({ labos: [], produits: [], delegues: [], territoires: [] })

  const STEPS = [
    { id: 1, icon: '🧪', label: 'Laboratoire' },
    { id: 2, icon: '💊', label: 'Produits' },
    { id: 3, icon: '🗺️', label: 'Territoire' },
    { id: 4, icon: '👥', label: 'Délégués' },
    { id: 5, icon: '✅', label: 'Terminé' },
  ]

  const setL = (k, v) => setLaboForm(f => ({ ...f, [k]: v }))
  const setP = (k, v) => setProduitForm(f => ({ ...f, [k]: v }))
  const setD = (k, v) => setDelegueForm(f => ({ ...f, [k]: v }))
  const setT = (k, v) => setTerritoireForm(f => ({ ...f, [k]: v }))

  const fetchGeographies = async () => {
    const { data } = await supabase.from('geographies').select('*').order('type').order('nom')
    setGeographies(data || [])
  }

  const fetchLabos = async () => {
    const { data } = await supabase.from('laboratoires').select('*').eq('agence_id', profile.agence_id)
    setLabos(data || [])
    if (data?.length > 0) setProduitForm(f => ({ ...f, laboratoire_id: data[0].id }))
  }

  const handleCreateLabo = async () => {
    if (!laboForm.nom) { alert('Le nom est obligatoire'); return }
    setLoading(true)
    const { data } = await supabase.from('laboratoires').insert({
      ...laboForm, agence_id: profile.agence_id
    }).select().single()
    if (data) {
      setCreated(c => ({ ...c, labos: [...c.labos, data] }))
      setLaboForm({ nom: '', pays: 'Mali', email: '', telephone: '' })
      setSuccessMsg(`Laboratoire "${data.nom}" créé !`)
      setTimeout(() => setSuccessMsg(''), 2000)
      await fetchLabos()
    }
    setLoading(false)
  }

  const handleCreateProduit = async () => {
    if (!produitForm.nom || !produitForm.laboratoire_id) { alert('Nom et laboratoire obligatoires'); return }
    setLoading(true)
    const { data } = await supabase.from('produits').insert({
      nom: produitForm.nom,
      dci: produitForm.dci || null,
      dosage: produitForm.dosage || null,
      forme: produitForm.forme || null,
      laboratoire_id: produitForm.laboratoire_id,
      statut_produit: 'Normal',
      agence_id: profile.agence_id
    }).select().single()
    if (data) {
      setCreated(c => ({ ...c, produits: [...c.produits, data] }))
      setProduitForm(f => ({ ...f, nom: '', dci: '', dosage: '', forme: '' }))
      setSuccessMsg(`Produit "${data.nom}" créé !`)
      setTimeout(() => setSuccessMsg(''), 2000)
    }
    setLoading(false)
  }

  const handleCreateTerritoire = async () => {
    if (!territoireForm.nom || !territoireForm.geography_id) { alert('Nom et zone obligatoires'); return }
    setLoading(true)
    const { data } = await supabase.from('territories').insert({
      nom: territoireForm.nom,
      code: territoireForm.code || null,
      geography_id: territoireForm.geography_id,
      agence_id: profile.agence_id
    }).select().single()
    if (data) {
      setCreated(c => ({ ...c, territoires: [...c.territoires, data] }))
      setTerritoireForm({ nom: '', code: '', geography_id: '' })
      setSuccessMsg(`Territoire "${data.nom}" créé !`)
      setTimeout(() => setSuccessMsg(''), 2000)
    }
    setLoading(false)
  }

  const handleCreateDelegue = async () => {
    if (!delegueForm.nom || !delegueForm.prenom) { alert('Nom et prénom obligatoires'); return }
    setLoading(true)
    const { data } = await supabase.from('delegates').insert({
      nom: delegueForm.nom,
      prenom: delegueForm.prenom,
      email: delegueForm.email || `${delegueForm.prenom.toLowerCase()}.${delegueForm.nom.toLowerCase()}@${agence?.nom?.toLowerCase().replace(/\s/g, '') || 'agence'}.ml`,
      telephone: delegueForm.telephone || null,
      agence_id: profile.agence_id
    }).select().single()
    if (data) {
      setCreated(c => ({ ...c, delegues: [...c.delegues, data] }))
      setDelegueForm({ nom: '', prenom: '', email: '', telephone: '' })
      setSuccessMsg(`Délégué "${data.prenom} ${data.nom}" créé !`)
      setTimeout(() => setSuccessMsg(''), 2000)
    }
    setLoading(false)
  }

  const goToStep = async (nextStep) => {
    if (nextStep === 2) await fetchLabos()
    if (nextStep === 3) await fetchGeographies()
    setStep(nextStep)
  }

  const geoGrouped = geographies.reduce((acc, g) => {
    if (!acc[g.type]) acc[g.type] = []
    acc[g.type].push(g)
    return acc
  }, {})

  const getTypeLabel = (type) => ({
    region: 'Région', cercle: 'Cercle', commune: 'Commune',
    district: 'District', zone: 'Zone'
  })[type] || type

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-blue-950 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚕</span>
          <div>
            <h1 className="text-white font-black text-lg">MedTrack</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              Configuration de {agence?.nom}
            </p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex flex-col items-center flex-1 ${i < STEPS.length - 1 ? '' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-colors ${
                  step > s.id ? 'bg-teal-400 text-blue-950' :
                  step === s.id ? 'bg-white text-blue-950' :
                  'bg-blue-900 text-slate-400'
                }`}>
                  {step > s.id ? '✓' : s.icon}
                </div>
                <p className={`text-xs mt-1 font-bold ${step === s.id ? 'text-white' : 'text-slate-500'}`}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-4 mx-1 ${step > s.id ? 'bg-teal-400' : 'bg-blue-900'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
          <p className="text-teal-600 font-black text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-6 flex flex-col gap-4 pb-10">

        {/* STEP 1 — Laboratoires */}
        {step === 1 && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <p className="font-black text-blue-950 mb-1">🧪 Ajoutez vos laboratoires clients</p>
              <p className="text-xs text-slate-400">Les laboratoires dont vous assurez la promotion médicale.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <input value={laboForm.nom} onChange={e => setL('nom', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Nom du laboratoire *" />
              <div className="grid grid-cols-2 gap-3">
                <input value={laboForm.telephone} onChange={e => setL('telephone', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Téléphone" />
                <input value={laboForm.email} onChange={e => setL('email', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Email" />
              </div>
              <button onClick={handleCreateLabo} disabled={loading}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                {loading ? '...' : '+ Ajouter ce laboratoire'}
              </button>
            </div>

            {created.labos.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {created.labos.length} laboratoire{created.labos.length > 1 ? 's' : ''} créé{created.labos.length > 1 ? 's' : ''}
                </p>
                {created.labos.map(l => (
                  <div key={l.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center gap-3">
                    <span className="text-teal-400 font-black">✓</span>
                    <p className="font-bold text-blue-950 text-sm">{l.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => goToStep(2)}
              disabled={created.labos.length === 0}
              className={`w-full font-black py-4 rounded-2xl text-sm ${
                created.labos.length > 0 ? 'bg-blue-950 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
              Continuer → Produits
            </button>
            {created.labos.length === 0 && (
              <button onClick={() => goToStep(2)} className="w-full text-slate-400 text-xs font-bold py-2">
                Passer cette étape →
              </button>
            )}
          </>
        )}

        {/* STEP 2 — Produits */}
        {step === 2 && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <p className="font-black text-blue-950 mb-1">💊 Ajoutez vos produits</p>
              <p className="text-xs text-slate-400">Les médicaments que vos délégués vont promouvoir.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <select value={produitForm.laboratoire_id} onChange={e => setP('laboratoire_id', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                <option value="">Laboratoire *</option>
                {labos.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
              <input value={produitForm.nom} onChange={e => setP('nom', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Nom commercial * (ex: Doliprane)" />
              <div className="grid grid-cols-2 gap-3">
                <input value={produitForm.dci} onChange={e => setP('dci', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="DCI (ex: Paracétamol)" />
                <input value={produitForm.dosage} onChange={e => setP('dosage', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Dosage (ex: 500mg)" />
              </div>
              <button onClick={handleCreateProduit} disabled={loading}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                {loading ? '...' : '+ Ajouter ce produit'}
              </button>
            </div>

            {created.produits.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {created.produits.length} produit{created.produits.length > 1 ? 's' : ''} créé{created.produits.length > 1 ? 's' : ''}
                </p>
                {created.produits.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center gap-3">
                    <span className="text-teal-400 font-black">✓</span>
                    <p className="font-bold text-blue-950 text-sm">{p.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-sm">
                ← Retour
              </button>
              <button onClick={() => goToStep(3)} className="flex-1 bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — Territoires */}
        {step === 3 && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <p className="font-black text-blue-950 mb-1">🗺️ Définissez vos territoires</p>
              <p className="text-xs text-slate-400">Les zones géographiques de votre équipe terrain.</p>
            </div>

            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <input value={territoireForm.nom} onChange={e => setT('nom', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Nom du territoire * (ex: Bamako Nord)" />
              <input value={territoireForm.code} onChange={e => setT('code', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Code (optionnel, ex: BKO-N)" />
              <select value={territoireForm.geography_id} onChange={e => setT('geography_id', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                <option value="">Zone géographique correspondante *</option>
                {Object.entries(geoGrouped).map(([type, geos]) => (
                  <optgroup key={type} label={getTypeLabel(type)}>
                    {geos.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                  </optgroup>
                ))}
              </select>
              <button onClick={handleCreateTerritoire} disabled={loading}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                {loading ? '...' : '+ Ajouter ce territoire'}
              </button>
            </div>

            {created.territoires.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {created.territoires.length} territoire{created.territoires.length > 1 ? 's' : ''} créé{created.territoires.length > 1 ? 's' : ''}
                </p>
                {created.territoires.map(t => (
                  <div key={t.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center gap-3">
                    <span className="text-teal-400 font-black">✓</span>
                    <p className="font-bold text-blue-950 text-sm">{t.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-sm">
                ← Retour
              </button>
              <button onClick={() => goToStep(4)} className="flex-1 bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* STEP 4 — Délégués */}
        {step === 4 && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <p className="font-black text-blue-950 mb-1">👥 Ajoutez vos délégués</p>
              <p className="text-xs text-slate-400">Les membres de votre équipe terrain. Vous pourrez créer leurs comptes ensuite depuis "Gestion des comptes".</p>
            </div>

            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={delegueForm.prenom} onChange={e => setD('prenom', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Prénom *" />
                <input value={delegueForm.nom} onChange={e => setD('nom', e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  placeholder="Nom *" />
              </div>
              <input value={delegueForm.telephone} onChange={e => setD('telephone', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Téléphone" />
              <input type="email" value={delegueForm.email} onChange={e => setD('email', e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                placeholder="Email (optionnel)" />
              <button onClick={handleCreateDelegue} disabled={loading}
                className="w-full bg-teal-400 text-blue-950 font-black py-3 rounded-xl text-sm">
                {loading ? '...' : '+ Ajouter ce délégué'}
              </button>
            </div>

            {created.delegues.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {created.delegues.length} délégué{created.delegues.length > 1 ? 's' : ''} créé{created.delegues.length > 1 ? 's' : ''}
                </p>
                {created.delegues.map(d => (
                  <div key={d.id} className="bg-white rounded-2xl p-3 mb-2 flex items-center gap-3">
                    <span className="text-teal-400 font-black">✓</span>
                    <p className="font-bold text-blue-950 text-sm">{d.prenom} {d.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-sm">
                ← Retour
              </button>
              <button onClick={() => setStep(5)} className="flex-1 bg-blue-950 text-white font-black py-4 rounded-2xl text-sm">
                Terminer →
              </button>
            </div>
          </>
        )}

        {/* STEP 5 — Terminé */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div className="bg-blue-950 rounded-2xl p-8 text-center">
              <p className="text-6xl mb-4">🎉</p>
              <p className="text-white font-black text-xl mb-2">Configuration terminée !</p>
              <p className="text-teal-400 text-sm">{agence?.nom} est prête à utiliser MedTrack</p>
            </div>

            <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs font-black text-blue-950 uppercase tracking-wider">Résumé</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-teal-500">{created.labos.length}</p>
                  <p className="text-xs text-slate-500">Laboratoire{created.labos.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-500">{created.produits.length}</p>
                  <p className="text-xs text-slate-500">Produit{created.produits.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-purple-500">{created.territoires.length}</p>
                  <p className="text-xs text-slate-500">Territoire{created.territoires.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-amber-500">{created.delegues.length}</p>
                  <p className="text-xs text-slate-500">Délégué{created.delegues.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-600 mb-2">📋 Prochaines étapes recommandées :</p>
              <div className="flex flex-col gap-1 text-xs text-amber-700">
                <p>1. Créer les comptes de connexion délégués</p>
                <p>2. Ajouter les établissements et professionnels de santé</p>
                <p>3. Créer une campagne et définir les cibles</p>
                <p>4. Affecter le portefeuille aux délégués</p>
                <p>5. Planifier les premières visites</p>
              </div>
            </div>

            <button onClick={onComplete}
              className="w-full bg-teal-400 text-blue-950 font-black py-4 rounded-2xl text-sm">
              🚀 Accéder au tableau de bord
            </button>
          </div>
        )}
      </div>
    </div>
  )
}