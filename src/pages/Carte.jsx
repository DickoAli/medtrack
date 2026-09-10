import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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

// Palette Medtrack
const DELEGATE_COLOR = '#087F5B'
const ESTABLISHMENT_COLORS = {
  hopital: '#DC2626',
  clinique: '#2563EB',
  csref: '#087F5B',
  cscom: '#16A34A',
  cabinet: '#F59E0B',
  pharmacie: '#16A34A',
  autre: '#98A2B3'
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
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Carte</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {stats.deleguesActifs} délégué{stats.deleguesActifs > 1 ? 's' : ''} actif{stats.deleguesActifs > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={fetchAll}
          className="bg-[#087F5B] text-white px-3 py-2 rounded-lg font-semibold text-xs">
          🔄
        </button>
      </div>

      <div className="bg-white flex border-b border-[#DDE4EA] flex-shrink-0">
        {[
          { id: 'carte', label: 'Carte' },
          { id: 'liste', label: 'Liste' },
          { id: 'stats', label: 'Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t.id ? 'text-[#087F5B] border-b-2 border-[#087F5B]' : 'text-[#667085]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'carte' && (
        <div className="flex flex-col flex-1">
          <div className="px-4 py-3 bg-white border-b border-[#DDE4EA] flex flex-col gap-2 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setShowDelegates(!showDelegates)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  showDelegates ? 'bg-[#087F5B] text-white border-[#087F5B]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                🟢 Délégués
              </button>
              <button onClick={() => setShowEtablissements(!showEtablissements)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  showEtablissements ? 'bg-[#172B4D] text-white border-[#172B4D]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                🏥 Établissements
              </button>
              <button onClick={() => setShowGeofence(!showGeofence)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  showGeofence ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                ⭕ Geofence
              </button>
              <button onClick={() => setShowVisites(!showVisites)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                  showVisites ? 'bg-[#F59E0B] text-white border-[#F59E0B]' : 'bg-white text-[#667085] border-[#DDE4EA]'
                }`}>
                📍 Visites GPS
              </button>
            </div>
          </div>

          <div className="flex-1" style={{ minHeight: '400px' }}>
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
              <RecenterMap center={center} />

              {showDelegates && delegates.map(d => (
                d.last_lat && d.last_lng && (
                  <Marker key={d.id} position={[parseFloat(d.last_lat), parseFloat(d.last_lng)]} icon={createColoredIcon(DELEGATE_COLOR)}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold text-[#172B4D]">{d.delegates?.prenom} {d.delegates?.nom}</p>
                        <p className="text-[#667085]">
                          Vu à {d.last_seen ? new Date(d.last_seen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                        <p className="text-[#667085]">{parseFloat(d.last_lat).toFixed(4)}, {parseFloat(d.last_lng).toFixed(4)}</p>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}

              {showEtablissements && etablissements.map(e => (
                e.latitude && e.longitude && (
                  <Marker key={e.id} position={[parseFloat(e.latitude), parseFloat(e.longitude)]} icon={createColoredIcon(ESTABLISHMENT_COLORS[e.type] || '#98A2B3')}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold text-[#172B4D]">{e.nom}</p>
                        <p className="text-[#667085]">{TYPE_LABELS[e.type]}</p>
                        {e.adresse && <p className="text-[#667085]">{e.adresse}</p>}
                        <p className="text-[#667085]">Geofence: {e.geofence_radius}m</p>
                      </div>
                    </Popup>
                    {showGeofence && e.geofence_radius && (
                      <Circle center={[parseFloat(e.latitude), parseFloat(e.longitude)]} radius={e.geofence_radius}
                        pathOptions={{ color: ESTABLISHMENT_COLORS[e.type] || '#98A2B3', fillColor: ESTABLISHMENT_COLORS[e.type] || '#98A2B3', fillOpacity: 0.1, weight: 1 }} />
                    )}
                  </Marker>
                )
              ))}

              {showVisites && filteredVisites.map(v => (
                v.latitude && v.longitude && (
                  <Marker key={v.id} position={[parseFloat(v.latitude), parseFloat(v.longitude)]}
                    icon={createColoredIcon(
                      v.confidence_status === 'validated' ? '#16A34A' :
                      v.confidence_status === 'suspicious' ? '#DC2626' :
                      v.confidence_status === 'to_check' ? '#F59E0B' : '#98A2B3'
                    )}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold text-[#172B4D]">{v.nom_contact || '—'}</p>
                        <p className="text-[#667085]">{v.delegates?.prenom} {v.delegates?.nom}</p>
                        <p className="text-[#667085]">{v.created_at?.slice(0, 10)}</p>
                        {v.confidence_score !== null && v.confidence_score !== undefined && (
                          <p className="font-semibold" style={{ color: v.confidence_status === 'validated' ? '#16A34A' : v.confidence_status === 'suspicious' ? '#DC2626' : '#F59E0B' }}>
                            Score: {v.confidence_score}pts
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>

          <div className="px-4 py-3 bg-white border-t border-[#DDE4EA] flex-shrink-0">
            <div className="flex gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#087F5B]" />
                <span className="text-[#667085]">Délégués</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
                <span className="text-[#667085]">CSRef</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#DC2626]" />
                <span className="text-[#667085]">Hôpital</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#16A34A]" />
                <span className="text-[#667085]">✅ Validée</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#DC2626]" />
                <span className="text-[#667085]">🚨 Suspecte</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'liste' && (
        <div className="p-5 flex flex-col gap-4 pb-10 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">
              Délégués ({delegates.length})
            </p>
            {delegates.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center border border-[#DDE4EA]">
                <p className="text-[#667085] text-sm">Aucun délégué localisé</p>
              </div>
            ) : (
              delegates.map(d => {
                const isRecent = d.last_seen && new Date() - new Date(d.last_seen) < 30 * 60 * 1000
                return (
                  <div key={d.id} className="bg-white rounded-xl p-4 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isRecent ? 'bg-[#087F5B]' : 'bg-[#DDE4EA]'}`} />
                    <div className="flex-1">
                      <p className="font-semibold text-[#172B4D] text-sm">{d.delegates?.prenom} {d.delegates?.nom}</p>
                      <p className="text-xs text-[#667085]">
                        {d.last_seen ? `Vu à ${new Date(d.last_seen).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Jamais localisé'}
                      </p>
                    </div>
                    <button onClick={() => { setCenter([parseFloat(d.last_lat), parseFloat(d.last_lng)]); setTab('carte') }}
                      className="bg-[#E8F0FE] text-[#2563EB] px-2 py-1.5 rounded-lg text-xs font-semibold">
                      📍
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wide mb-3">
              Établissements géolocalisés ({etablissements.length})
            </p>
            {etablissements.map(e => (
              <div key={e.id} className="bg-white rounded-xl p-4 mb-2 flex items-center gap-3 border border-[#DDE4EA]">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ESTABLISHMENT_COLORS[e.type] || '#98A2B3' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#172B4D] text-sm truncate">{e.nom}</p>
                  <p className="text-xs text-[#667085]">{TYPE_LABELS[e.type]} · ⭕ {e.geofence_radius}m</p>
                </div>
                <button onClick={() => { setCenter([parseFloat(e.latitude), parseFloat(e.longitude)]); setTab('carte') }}
                  className="bg-[#E8F0FE] text-[#2563EB] px-2 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0">
                  📍
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="p-5 flex flex-col gap-4 pb-10 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #087F5B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.deleguesActifs}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Délégués actifs</p>
              <p className="text-xs text-[#98A2B3]">(30 dernières min)</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #2563EB' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.etablissementsGeoloc}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Établissements</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]" style={{ borderLeft: '2px solid #F59E0B' }}>
              <p className="text-xl font-semibold text-[#172B4D]">{stats.visitesAujourdhui}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Visites aujourd'hui</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
              <p className="text-xl font-semibold text-[#172B4D]">{stats.visitesGeoloc}</p>
              <p className="text-xs text-[#667085] font-medium uppercase tracking-wide mt-1">Visites géolocalisées</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#DDE4EA]">
            <p className="text-xs font-semibold text-[#172B4D] uppercase tracking-wide mb-3">
              Répartition établissements
            </p>
            {Object.entries(
              etablissements.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc }, {})
            ).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ESTABLISHMENT_COLORS[type] || '#98A2B3' }} />
                <p className="text-sm text-[#667085] flex-1">{TYPE_LABELS[type]}</p>
                <p className="font-semibold text-[#172B4D]">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
