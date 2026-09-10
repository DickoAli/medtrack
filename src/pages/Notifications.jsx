import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Notifications({ onBack, profile }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchNotifications()
    // Génération automatique en tâche de fond à chaque ouverture de l'écran —
    // le bouton "Analyser" reste disponible pour forcer un nouveau passage.
    generateNotifications()
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('agence_id', profile.agence_id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  const generateNotifications = async () => {
    setGenerating(true)
    const today = new Date().toISOString().slice(0, 10)

    const { data: suspectes } = await supabase
      .from('visites')
      .select('*, delegates(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .eq('confidence_status', 'suspicious')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    for (const v of suspectes || []) {
      await supabase.from('notifications').upsert({
        agence_id: profile.agence_id, user_id: profile.id, type: 'suspicious_visit',
        title: '🚨 Visite suspecte détectée',
        body: `${v.delegates?.prenom} ${v.delegates?.nom} — Score: ${v.confidence_score}pts`,
        data: { visit_id: v.id }, is_read: false
      }, { onConflict: 'agence_id,user_id,type,title' })
    }

    const { data: manquees } = await supabase
      .from('visit_plans')
      .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .eq('statut', 'pending')
      .lt('planned_date', today)

    for (const v of manquees || []) {
      await supabase.from('notifications').upsert({
        agence_id: profile.agence_id, user_id: profile.id, type: 'missed_visit',
        title: '⚠️ Visite manquée',
        body: `${v.delegates?.prenom} ${v.delegates?.nom} devait visiter ${v.healthcare_professionals?.prenom} ${v.healthcare_professionals?.nom}`,
        data: { visit_plan_id: v.id }, is_read: false
      }, { onConflict: 'agence_id,user_id,type,title' })
    }

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const { data: objectifs } = await supabase
      .from('objectifs')
      .select('*, delegates(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .eq('mois', currentMonth)

    for (const o of objectifs || []) {
      const { count } = await supabase
        .from('visites')
        .select('*', { count: 'exact', head: true })
        .eq('delegate_id', o.delegate_id)
        .eq('statut', 'Réalisée')
        .gte('created_at', `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`)

      const progress = o.objectif_visites > 0 ? Math.round((count / o.objectif_visites) * 100) : 100
      const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()

      if (progress < 50 && daysLeft < 10) {
        await supabase.from('notifications').upsert({
          agence_id: profile.agence_id, user_id: profile.id, type: 'objective_alert',
          title: '📊 Objectif en retard',
          body: `${o.delegates?.prenom} ${o.delegates?.nom} — ${progress}% de l'objectif · ${daysLeft} jours restants`,
          data: { delegate_id: o.delegate_id }, is_read: false
        }, { onConflict: 'agence_id,user_id,type,title' })
      }
    }

    // Cibles priorité A actives sans visite réalisée depuis 30+ jours.
    // La priorité utilisée est celle FIGÉE sur le portefeuille (delegate_portfolios.priority)
    // — la valeur réellement décidée au moment de l'affectation, pas un défaut
    // qui aurait pu changer depuis sur la fiche du professionnel.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: prioriteA } = await supabase
      .from('delegate_portfolios')
      .select('*, delegates(nom, prenom), commercial_targets(healthcare_professional_id, healthcare_professionals(nom, prenom))')
      .eq('agence_id', profile.agence_id)
      .eq('is_active', true)
      .eq('priority', 'A')

    for (const p of prioriteA || []) {
      const hpId = p.commercial_targets?.healthcare_professional_id
      const pro = p.commercial_targets?.healthcare_professionals
      if (!hpId) continue

      const { count } = await supabase
        .from('visites')
        .select('*', { count: 'exact', head: true })
        .eq('healthcare_professional_id', hpId)
        .eq('statut', 'Réalisée')
        .gte('created_at', thirtyDaysAgo)

      if (!count) {
        await supabase.from('notifications').upsert({
          agence_id: profile.agence_id, user_id: profile.id, type: 'high_priority_stale',
          title: '🔴 Cible prioritaire sans visite',
          body: `${pro?.prenom || ''} ${pro?.nom || ''} · priorité A · ${p.delegates?.prenom} ${p.delegates?.nom} — aucune visite réalisée depuis 30 jours`,
          data: { portfolio_id: p.id, healthcare_professional_id: hpId }, is_read: false
        }, { onConflict: 'agence_id,user_id,type,title' })
      }
    }

    setGenerating(false)
    fetchNotifications()
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    fetchNotifications()
  }

  const markAllAsRead = async () => {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('agence_id', profile.agence_id)
      .eq('is_read', false)
    fetchNotifications()
  }

  const deleteNotification = async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    fetchNotifications()
  }

  const TYPE_ICONS = {
    suspicious_visit: '🚨', missed_visit: '⚠️', objective_alert: '📊',
    high_priority_stale: '🔴', new_campaign: '🎯', sync_complete: '✅'
  }
  const TYPE_BORDER = {
    suspicious_visit: '#DC2626', missed_visit: '#F59E0B', objective_alert: '#2563EB',
    high_priority_stale: '#DC2626', new_campaign: '#087F5B', sync_complete: '#16A34A'
  }

  const unread = notifications.filter(n => !n.is_read).length

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center">
      <p className="text-[#087F5B] font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F9]">
      <div className="bg-[#172B4D] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-semibold text-base">Notifications</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              {unread} non lue{unread > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generateNotifications} disabled={generating}
            className="bg-[#087F5B] text-white px-3 py-2 rounded-lg font-semibold text-xs">
            {generating ? 'Analyse en cours...' : '🔄 Forcer l\'analyse'}
          </button>
          {unread > 0 && (
            <button onClick={markAllAsRead}
              className="bg-white/10 text-white px-3 py-2 rounded-lg font-semibold text-xs border border-white/20">
              Tout lire
            </button>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-3 pb-10">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-[#667085] text-sm font-medium">Aucune notification</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              L'analyse se lance automatiquement à l'ouverture de cet écran
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`bg-white rounded-xl p-4 border border-[#DDE4EA] ${!n.is_read ? '' : 'opacity-60'}`}
              style={{ borderLeft: `2px solid ${TYPE_BORDER[n.type] || '#DDE4EA'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-[#087F5B] rounded-full flex-shrink-0" />
                    )}
                    <p className="font-semibold text-[#172B4D] text-sm">{n.title}</p>
                  </div>
                  <p className="text-xs text-[#667085]">{n.body}</p>
                  <p className="text-xs text-[#98A2B3] mt-1">
                    {new Date(n.created_at).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!n.is_read && (
                    <button onClick={() => markAsRead(n.id)}
                      className="bg-[#E7F5EF] text-[#087F5B] px-2 py-1.5 rounded-lg text-xs font-semibold">
                      ✓
                    </button>
                  )}
                  <button onClick={() => deleteNotification(n.id)}
                    className="bg-[#FDE8E8] text-[#DC2626] px-2 py-1.5 rounded-lg text-xs font-semibold">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
