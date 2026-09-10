import { useState } from 'react'
import { supabase } from '../supabase'

export default function Onboarding({ profile, agence, onBack, onComplete }) {
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
    const { data } = await supabase.from('laboratoires').insert({ ...laboForm, agence_id: profile.agence_id }).select().single()
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
      nom: produitForm.nom, dci: produitForm.dci || null, dosage: produitForm.dosage || null,
      forme: produitForm.forme || null, laboratoire_id: produitForm.laboratoire_id,
      statut_produit: 'Normal', agence_id: profile.agence_id
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
      nom: territoireForm.nom, code: territoireForm.code || null,
      geography_id: territoireForm.geography_id, agence_id: profile.agence_id
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
      nom: delegueForm.nom, prenom: delegueForm.prenom,
      email: delegueForm.email || `${delegueForm.prenom.toLowerCase()}.${delegueForm.nom.toLowerCase()}@${agence?.nom?.toLowerCase().replace(/\s/g, '') || 'agence'}.ml`,
      telephone: delegueForm.telephone || null, agence_id: profile.agence_id
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

  const getTypeLabel = (type) => ({ region: 'Région', cercle: 'Cercle', commune: 'Commune', district: 'District', zone: 'Zone' })[type] || type

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          {onBack && <button onClick={onBack} className="text-white text-xl">←</button>}
          <span className="text-xl text-[#087F5B]">⚕</span>
          <div>
            <h1 className="text-white font-semibold text-base">MedTrack</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              Configuration de {agence?.nom}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step > s.id ? 'bg-[#087F5B] text-white' :
                  step === s.id ? 'bg-white text-[#172B4D]' : 'bg-[#233858] text-[#667085]'
                }`}>
                  {step > s.id ? '✓' : s.icon}
                </div>
                <p className={`text-xs mt-1 font-medium ${step === s.id ? 'text-white' : 'text-[#667085]'}`}>{s.label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-4 mx-1 ${step > s.id ? 'bg-[#087F5B]' : 'bg-[#233858]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="mx-5 mt-4 bg-[#E7F5EF] border border-[#087F5B]/20 rounded-xl p-3 text-center">
          <p className="text-[#087F5B] font-semibold text-sm">✅ {successMsg}</p>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 pb-10">

        {step === 1 && (
          <>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="font-semibold text-[#172B4D] mb-1">🧪 Ajoutez vos laboratoires clients</p>
              <p className="text-xs text-[#667085]">Les laboratoires dont vous assurez la promotion médicale.</p>
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
              <input value={laboForm.nom} onChange={e => setL('nom', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Nom du laboratoire *" />
              <div className="grid grid-cols-2 gap-3">
                <input value={laboForm.telephone} onChange={e => setL('telephone', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Téléphone" />
                <input value={laboForm.email} onChange={e => setL('email', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Email" />
              </div>
              <button onClick={handleCreateLabo} disabled={loading}
                className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                {loading ? '...' : '+ Ajouter ce laboratoire'}
              </button>
            </div>

            {created.labos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
                  {created.labos.length} laboratoire{created.labos.length > 1 ? 's' : ''} créé{created.labos.length > 1 ? 's' : ''}
                </p>
                {created.labos.map(l => (
                  <div key={l.id} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                    <span className="text-[#087F5B] font-semibold">✓</span>
                    <p className="font-medium text-[#172B4D] text-sm">{l.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => goToStep(2)} disabled={created.labos.length === 0}
              className={`w-full font-semibold py-4 rounded-xl text-sm ${
                created.labos.length > 0 ? 'bg-[#172B4D] text-white' : 'bg-[#EEF1F4] text-[#98A2B3]'
              }`}>
              Continuer → Produits
            </button>
            {created.labos.length === 0 && (
              <button onClick={() => goToStep(2)} className="w-full text-[#98A2B3] text-xs font-medium py-2">
                Passer cette étape →
              </button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="font-semibold text-[#172B4D] mb-1">💊 Ajoutez vos produits</p>
              <p className="text-xs text-[#667085]">Les médicaments que vos délégués vont promouvoir.</p>
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
              <select value={produitForm.laboratoire_id} onChange={e => setP('laboratoire_id', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="">Laboratoire *</option>
                {labos.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
              <input value={produitForm.nom} onChange={e => setP('nom', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Nom commercial * (ex: Doliprane)" />
              <div className="grid grid-cols-2 gap-3">
                <input value={produitForm.dci} onChange={e => setP('dci', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="DCI (ex: Paracétamol)" />
                <input value={produitForm.dosage} onChange={e => setP('dosage', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Dosage (ex: 500mg)" />
              </div>
              <button onClick={handleCreateProduit} disabled={loading}
                className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                {loading ? '...' : '+ Ajouter ce produit'}
              </button>
            </div>

            {created.produits.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
                  {created.produits.length} produit{created.produits.length > 1 ? 's' : ''} créé{created.produits.length > 1 ? 's' : ''}
                </p>
                {created.produits.map(p => (
                  <div key={p.id} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                    <span className="text-[#087F5B] font-semibold">✓</span>
                    <p className="font-medium text-[#172B4D] text-sm">{p.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-4 rounded-xl text-sm">
                ← Retour
              </button>
              <button onClick={() => goToStep(3)} className="flex-1 bg-[#172B4D] text-white font-semibold py-4 rounded-xl text-sm">
                Continuer →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="font-semibold text-[#172B4D] mb-1">🗺️ Définissez vos territoires</p>
              <p className="text-xs text-[#667085]">Les zones géographiques de votre équipe terrain.</p>
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
              <input value={territoireForm.nom} onChange={e => setT('nom', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Nom du territoire * (ex: Bamako Nord)" />
              <input value={territoireForm.code} onChange={e => setT('code', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Code (optionnel, ex: BKO-N)" />
              <select value={territoireForm.geography_id} onChange={e => setT('geography_id', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
                <option value="">Zone géographique correspondante *</option>
                {Object.entries(geoGrouped).map(([type, geos]) => (
                  <optgroup key={type} label={getTypeLabel(type)}>
                    {geos.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                  </optgroup>
                ))}
              </select>
              <button onClick={handleCreateTerritoire} disabled={loading}
                className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                {loading ? '...' : '+ Ajouter ce territoire'}
              </button>
            </div>

            {created.territoires.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
                  {created.territoires.length} territoire{created.territoires.length > 1 ? 's' : ''} créé{created.territoires.length > 1 ? 's' : ''}
                </p>
                {created.territoires.map(t => (
                  <div key={t.id} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                    <span className="text-[#087F5B] font-semibold">✓</span>
                    <p className="font-medium text-[#172B4D] text-sm">{t.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-4 rounded-xl text-sm">
                ← Retour
              </button>
              <button onClick={() => goToStep(4)} className="flex-1 bg-[#172B4D] text-white font-semibold py-4 rounded-xl text-sm">
                Continuer →
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="font-semibold text-[#172B4D] mb-1">👥 Ajoutez vos délégués</p>
              <p className="text-xs text-[#667085]">Les membres de votre équipe terrain. Vous pourrez créer leurs comptes ensuite depuis "Gestion des comptes".</p>
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
              <div className="grid grid-cols-2 gap-3">
                <input value={delegueForm.prenom} onChange={e => setD('prenom', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Prénom *" />
                <input value={delegueForm.nom} onChange={e => setD('nom', e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                  placeholder="Nom *" />
              </div>
              <input value={delegueForm.telephone} onChange={e => setD('telephone', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Téléphone" />
              <input type="email" value={delegueForm.email} onChange={e => setD('email', e.target.value)}
                className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]"
                placeholder="Email (optionnel)" />
              <button onClick={handleCreateDelegue} disabled={loading}
                className="w-full bg-[#087F5B] text-white font-semibold py-3 rounded-lg text-sm">
                {loading ? '...' : '+ Ajouter ce délégué'}
              </button>
            </div>

            {created.delegues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-2">
                  {created.delegues.length} délégué{created.delegues.length > 1 ? 's' : ''} créé{created.delegues.length > 1 ? 's' : ''}
                </p>
                {created.delegues.map(d => (
                  <div key={d.id} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                    <span className="text-[#087F5B] font-semibold">✓</span>
                    <p className="font-medium text-[#172B4D] text-sm">{d.prenom} {d.nom}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-[#EEF1F4] text-[#667085] font-semibold py-4 rounded-xl text-sm">
                ← Retour
              </button>
              <button onClick={() => setStep(5)} className="flex-1 bg-[#172B4D] text-white font-semibold py-4 rounded-xl text-sm">
                Terminer →
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#172B4D] rounded-xl p-8 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-white font-semibold text-xl mb-1">Configuration terminée !</p>
              <p className="text-[#9AA9C2] text-sm">{agence?.nom} est prête à utiliser MedTrack</p>
            </div>

            <div className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-[#DDE4EA]">
              <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide">Résumé</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#E7F5EF] rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-[#087F5B]">{created.labos.length}</p>
                  <p className="text-xs text-[#667085]">Laboratoire{created.labos.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-[#E8F0FE] rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-[#2563EB]">{created.produits.length}</p>
                  <p className="text-xs text-[#667085]">Produit{created.produits.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-[#EEF1F4] rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-[#172B4D]">{created.territoires.length}</p>
                  <p className="text-xs text-[#667085]">Territoire{created.territoires.length > 1 ? 's' : ''}</p>
                </div>
                <div className="bg-[#FEF3E2] rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-[#B45309]">{created.delegues.length}</p>
                  <p className="text-xs text-[#667085]">Délégué{created.delegues.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#FEF3E2] border border-[#F59E0B]/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-[#B45309] mb-2">📋 Prochaines étapes recommandées :</p>
              <div className="flex flex-col gap-1 text-xs text-[#B45309]">
                <p>1. Créer les comptes de connexion délégués</p>
                <p>2. Ajouter les établissements et professionnels de santé</p>
                <p>3. Créer une campagne et définir les cibles</p>
                <p>4. Affecter le portefeuille aux délégués</p>
                <p>5. Planifier les premières visites</p>
              </div>
            </div>

            <button onClick={onComplete} className="w-full bg-[#087F5B] text-white font-semibold py-4 rounded-xl text-sm">
              🚀 Accéder au tableau de bord
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
