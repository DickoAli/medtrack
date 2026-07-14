import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import { supabase } from '../supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const COLORS = ['#00C9B1', '#F59E0B', '#A78BFA', '#F43F5E']

export default function Carte({ onBack }) {
  const [visites, setVisites] = useState([])
  const [delegates, setDelegates] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('realtime')

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchPositions, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    await fetchPositions()
    await fetchVisites()
    setLoading(false)
  }

  const fetchPositions = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, delegates(*)')
      .eq('role', 'delegue')
      .eq('agence_id', profile.agence_id)
      .not('last_lat', 'is', null)
    setPositions(data || [])
  }

  const fetchVisites = async () => {
    const { data } = await supabase
      .from('visites')
      .select('*, delegates(*), medecins(*)')
      .eq('agence_id', profile.agence_id)
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false })
    setVisites(data || [])
  }

  const getTimeSince = (ts) => {
    if (!ts) return 'jamais'
    const diff = Math.floor((new Date() - new Date(ts)) / 60000)
    if (diff < 1) return 'à l\'instant'
    if (diff < 60) return `il y a ${diff} min`
    return `il y a ${Math.floor(diff / 60)}h`
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement de la carte...</p>
    </div>
  )

  const defaultCenter = positions.length > 0
    ? [positions[0].last_lat, positions[0].last_lng]
    : [36.737, 3.086]

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="text-white text-xl">←</button>
        <h1 className="text-white font-black">Carte des délégués</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-teal-400 text-xs font-bold">LIVE</span>
        </div>
      </div>

      {/* Toggle vue */}
      <div className="bg-white flex border-b border-slate-200">
        {[
          { id: 'realtime', label: '📍 Positions live' },
          { id: 'visites', label: '🗺️ Visites' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 py-3 text-xs font-black transition-colors ${view === t.id ? 'text-teal-500 border-b-2 border-teal-500' : 'text-slate-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Positions live */}
      {view === 'realtime' && (
        <>
          {positions.length === 0 ? (
            <div className="p-6 text-center">
              <div className="bg-white rounded-2xl p-8">
                <p className="text-slate-400 text-sm">Aucun délégué localisé</p>
                <p className="text-slate-300 text-xs mt-1">Les délégués doivent être connectés avec le GPS activé</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ height: '50vh' }}>
                <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {positions.map((p, i) => (
                    <Marker key={p.id} position={[p.last_lat, p.last_lng]}>
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <p style={{ fontWeight: 'bold' }}>{p.delegates?.prenom} {p.delegates?.nom}</p>
                          <p style={{ fontSize: 12, color: '#64748b' }}>{p.delegates?.zone}</p>
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            Vu {getTimeSince(p.last_seen)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* Liste délégués */}
              <div className="p-4 flex flex-col gap-3">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  {positions.length} délégué{positions.length > 1 ? 's' : ''} localisé{positions.length > 1 ? 's' : ''}
                </p>
                {positions.map((p, i) => (
                  <div key={p.id} className="bg-white rounded-2xl p-4 flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm"
                      style={{ background: COLORS[i % COLORS.length] }}
                    >
                      {p.delegates?.prenom?.[0]}{p.delegates?.nom?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-blue-950 text-sm">{p.delegates?.prenom} {p.delegates?.nom}</p>
                      <p className="text-slate-400 text-xs">{p.delegates?.zone}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                        <span className="text-xs text-teal-500 font-bold">En ligne</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{getTimeSince(p.last_seen)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Visites */}
      {view === 'visites' && (
        <>
          {visites.length === 0 ? (
            <div className="p-6 text-center">
              <div className="bg-white rounded-2xl p-8">
                <p className="text-slate-400 text-sm">Aucune visite avec position GPS</p>
              </div>
            </div>
          ) : (
            <div style={{ height: 'calc(100vh - 130px)' }}>
              <MapContainer center={[visites[0].latitude, visites[0].longitude]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {visites.map((v) => (
                  <Marker key={v.id} position={[v.latitude, v.longitude]}>
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <p style={{ fontWeight: 'bold' }}>Dr. {v.medecins?.nom}</p>
                        <p style={{ fontSize: 12, color: '#64748b' }}>{v.delegates?.prenom} {v.delegates?.nom}</p>
                        <p style={{ fontSize: 12, color: '#64748b' }}>{v.produit}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{v.created_at?.slice(0, 10)}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}