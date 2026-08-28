import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createColoredIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
})

const DELEGATE_COLOR = '#00C9B1'
const ESTABLISHMENT_COLORS = {
  hopital: '#ef4444',
  clinique: '#a855f7',
  csref: '#3b82f6',
  cscom: '#14b8a6',
  cabinet: '#f59e0b',
  pharmacie: '#22c55e',
  autre: '#94a3b8'
}

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, 13) }, [center])
  return null
}

export default function Carte({ onBack, profile }) {
  const [delegates, setDelegates] = useState([])
  const [etablissements, setEtablissements] = useState([])
  const [professionnels, setProfessionnels] = useState([])
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [center, setCenter] = useState([12.6392, -8.0029])
  const [showDelegates, setShowDelegates] = useState(true)
  const [showEtablissements, setShowEtablissements] = useState(true)
  const [showGeofence, setShowGeofence] = useState(true)
  const [showVisites, setShowVisites] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState('tous')
  const [tab, setTab] = useState('carte')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d }, { data: e }, { data: h }, { data: v }] = await Promise.all([
      supabase.from('profiles')
        .select('*, delegates(nom, prenom)')
        .eq('agence_id', profile.agence_id)
        .eq('role', 'delegue')
        .not('last_lat', 'is', null),
      supabase.from('establishments')
        .select('*')
        .eq('agence_id', profile.agence_id)
        .eq('is_active', true)
        .not('latitude', 'is', null),
      supabase.from('healthcare_professionals')
        .select('*, establishments(nom, latitude, longitude)')
        .eq('agence_id', profile.agence_id)
        .eq('statut', 'actif'),
      supabase.from('visites')
        .select('*, delegates(nom, prenom)')
        .eq('agence_id', profile.agence_id)
        .not('latitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)
    ])
    setDelegates(d || [])
    setEtablissements(e || [])
    setProfessionnels(h || [])
    setVisites(v || [])
    setLoading(false)
  }

  const filteredVisites = selectedDelegate === 'tous'
    ? visites
    : visites.filter(v => v.delegates && `${v.delegates.prenom} ${v.delegates.nom}` === selectedDelegate)

  const TYPE_LABELS = {
    hopital: 'Hôpital', clinique: 'Clinique', csref: 'CSRef',
    cscom: 'CSCom', cabinet: 'Cabinet', pharmacie: 'Pharmacie', autre: 'Autre'
  }

  const stats = {
    deleguesActifs: delegates.filter(d => {
      if (!d.last_seen) return false
      return new Date() - new Date(d.last_seen) < 30 * 60 * 1000
    }).length,
    etablissementsGeoloc: etablissements.length,
    visitesAujourdhui: visites.filter(v => v.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    visitesGeoloc: visites.filter(v => v.latitude && v.longitude).length
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Carte</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {stats.deleguesActifs} délégué{stats.deleguesActifs > 1 ? 's' : ''} actif{stats.deleguesActifs > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={fetchAll}
          className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl font-bold text-xs">
          🔄
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white flex border-b border-slate-200 flex-shrink-0">
        {[
          { id: 'carte', label: '🗺️ Carte' },
          { id: 'liste', label: '📋 Liste' },
          { id: 'stats', label: '📊 Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${
              tab === t.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CARTE */}
      {tab === 'carte' && (
        <div className="flex flex-col flex-1">
          {/* Contrôles */}
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col gap-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setShowDelegates(!showDelegates)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                  showDelegates ? 'bg-teal-400 text-blue-950 border-teal-400' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                🟢 Délégués
              </button>
              <button onClick={() => setShowEtablissements(!showEtablissements)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                  showEtablissements ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                🏥 Établissements
              </button>
              <button onClick={() => setShowGeofence(!showGeofence)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                  showGeofence ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                ⭕ Geofence
              </button>
              <button onClick={() => setShowVisites(!showVisites)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                  showVisites ? 'bg-amber-400 text-blue-950 border-amber-400' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                📍 Visites GPS
              </button>
            </div>
          </div>

          {/* Carte Leaflet */}
          <div className="flex-1" style={{ minHeight: '400px' }}>
            <MapContainer
              center={center}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© OpenStreetMap'
              />
              <RecenterMap center={center} />

              {/* Délégués */}
              {showDelegates && delegates.map(d => (
                d.last_lat && d.last_lng && (
                  <Marker key={d.id}
                    position={[parseFloat(d.last_lat), parseFloat(d.last_lng)]}
                    icon={createColoredIcon(DELEGATE_COLOR)}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-black text-blue-950">
                          {d.delegates?.prenom} {d.delegates?.nom}
                        </p>
                        <p className="text-slate-400">
                          Vu à {d.last_seen ? new Date(d.last_seen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                        <p className="text-slate-400">
                          {parseFloat(d.last_lat).toFixed(4)}, {parseFloat(d.last_lng).toFixed(4)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}

              {/* Établissements */}
              {showEtablissements && etablissements.map(e => (
                e.latitude && e.longitude && (
                  <Marker key={e.id}
                    position={[parseFloat(e.latitude), parseFloat(e.longitude)]}
                    icon={createColoredIcon(ESTABLISHMENT_COLORS[e.type] || '#94a3b8')}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-black text-blue-950">{e.nom}</p>
                        <p className="text-slate-400">{TYPE_LABELS[e.type]}</p>
                        {e.adresse && <p className="text-slate-400">{e.adresse}</p>}
                        <p className="text-slate-400">Geofence: {e.geofence_radius}m</p>
                      </div>
                    </Popup>
                    {/* Geofence circle */}
                    {showGeofence && e.geofence_radius && (
                      <Circle
                        center={[parseFloat(e.latitude), parseFloat(e.longitude)]}
                        radius={e.geofence_radius}
                        pathOptions={{
                          color: ESTABLISHMENT_COLORS[e.type] || '#94a3b8',
                          fillColor: ESTABLISHMENT_COLORS[e.type] || '#94a3b8',
                          fillOpacity: 0.1,
                          weight: 1
                        }}
                      />
                    )}
                  </Marker>
                )
              ))}

              {/* Visites GPS */}
              {showVisites && filteredVisites.map(v => (
                v.latitude && v.longitude && (
                  <Marker key={v.id}
                    position={[parseFloat(v.latitude), parseFloat(v.longitude)]}
                    icon={createColoredIcon(
                      v.confidence_status === 'validated' ? '#22c55e' :
                      v.confidence_status === 'suspicious' ? '#ef4444' :
                      v.confidence_status === 'to_check' ? '#f59e0b' : '#94a3b8'
                    )}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-black text-blue-950">{v.nom_contact || '—'}</p>
                        <p className="text-slate-400">{v.delegates?.prenom} {v.delegates?.nom}</p>
                        <p className="text-slate-400">{v.created_at?.slice(0, 10)}</p>
                        {v.confidence_score !== null && v.confidence_score !== undefined && (
                          <p className={`font-bold ${
                            v.confidence_status === 'validated' ? 'text-green-600' :
                            v.confidence_status === 'suspicious' ? 'text-red-600' : 'text-amber-600'
                          }`}>Score: {v.confidence_score}pts</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>

          {/* Légende */}
          <div className="px-4 py-3 bg-white border-t border-slate-100 flex-shrink-0">
            <div className="flex gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-teal-400" />
                <span className="text-slate-500">Délégués</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-500">CSRef</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-slate-500">Hôpital</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-500">✅ Validée</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-slate-500">🚨 Suspecte</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTE */}
      {tab === 'liste' && (
        <div className="p-6 flex flex-col gap-4 pb-10 overflow-y-auto">
          {/* Délégués */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Délégués ({delegates.length})
            </p>
            {delegates.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center">
                <p className="text-slate-400 text-sm">Aucun délégué localisé</p>
              </div>
            ) : (
              delegates.map(d => {
                const isRecent = d.last_seen && new Date() - new Date(d.last_seen) < 30 * 60 * 1000
                return (
                  <div key={d.id} className="bg-white rounded-2xl p-4 mb-2 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isRecent ? 'bg-teal-400' : 'bg-slate-300'}`} />
                    <div className="flex-1">
                      <p className="font-black text-blue-950 text-sm">
                        {d.delegates?.prenom} {d.delegates?.nom}
                      </p>
                      <p className="text-xs text-slate-400">
                        {d.last_seen
                          ? `Vu à ${new Date(d.last_seen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Jamais localisé'}
                      </p>
                    </div>
                    <button onClick={() => {
                      setCenter([parseFloat(d.last_lat), parseFloat(d.last_lng)])
                      setTab('carte')
                    }} className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg text-xs font-bold">
                      📍
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Établissements */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Établissements géolocalisés ({etablissements.length})
            </p>
            {etablissements.map(e => (
              <div key={e.id} className="bg-white rounded-2xl p-4 mb-2 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ESTABLISHMENT_COLORS[e.type] || '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-blue-950 text-sm truncate">{e.nom}</p>
                  <p className="text-xs text-slate-400">{TYPE_LABELS[e.type]} · ⭕ {e.geofence_radius}m</p>
                </div>
                <button onClick={() => {
                  setCenter([parseFloat(e.latitude), parseFloat(e.longitude)])
                  setTab('carte')
                }} className="bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg text-xs font-bold flex-shrink-0">
                  📍
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div className="p-6 flex flex-col gap-4 pb-10 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border-l-4 border-teal-400">
              <p className="text-2xl font-black text-blue-950">{stats.deleguesActifs}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Délégués actifs</p>
              <p className="text-xs text-slate-400">(30 dernières min)</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-blue-400">
              <p className="text-2xl font-black text-blue-950">{stats.etablissementsGeoloc}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Établissements</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-amber-400">
              <p className="text-2xl font-black text-blue-950">{stats.visitesAujourdhui}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites aujourd'hui</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-l-4 border-purple-400">
              <p className="text-2xl font-black text-blue-950">{stats.visitesGeoloc}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Visites géolocalisées</p>
            </div>
          </div>

          {/* Répartition établissements */}
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3">
              Répartition établissements
            </p>
            {Object.entries(
              etablissements.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1
                return acc
              }, {})
            ).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ESTABLISHMENT_COLORS[type] || '#94a3b8' }} />
                <p className="text-sm text-slate-600 flex-1">{TYPE_LABELS[type]}</p>
                <p className="font-black text-blue-950">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}