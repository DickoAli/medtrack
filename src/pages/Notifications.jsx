import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Notifications({ onBack, profile }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchNotifications() }, [])

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

    // 1. Visites suspectes non lues
    const { data: suspectes } = await supabase
      .from('visites')
      .select('*, delegates(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .eq('confidence_status', 'suspicious')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    for (const v of suspectes || []) {
      await supabase.from('notifications').upsert({
        agence_id: profile.agence_id,
        user_id: profile.id,
        type: 'suspicious_visit',
        title: '🚨 Visite suspecte détectée',
        body: `${v.delegates?.prenom} ${v.delegates?.nom} — Score: ${v.confidence_score}pts`,
        data: { visit_id: v.id },
        is_read: false
      }, { onConflict: 'agence_id,user_id,type,title' })
    }

    // 2. Visites planifiées manquées
    const { data: manquees } = await supabase
      .from('visit_plans')
      .select('*, delegates(nom, prenom), healthcare_professionals(nom, prenom)')
      .eq('agence_id', profile.agence_id)
      .eq('statut', 'pending')
      .lt('planned_date', today)

    for (const v of manquees || []) {
      await supabase.from('notifications').upsert({
        agence_id: profile.agence_id,
        user_id: profile.id,
        type: 'missed_visit',
        title: '⚠️ Visite manquée',
        body: `${v.delegates?.prenom} ${v.delegates?.nom} devait visiter ${v.healthcare_professionals?.prenom} ${v.healthcare_professionals?.nom}`,
        data: { visit_plan_id: v.id },
        is_read: false
      }, { onConflict: 'agence_id,user_id,type,title' })
    }

    // 3. Objectifs en retard
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
          agence_id: profile.agence_id,
          user_id: profile.id,
          type: 'objective_alert',
          title: '📊 Objectif en retard',
          body: `${o.delegates?.prenom} ${o.delegates?.nom} — ${progress}% de l'objectif · ${daysLeft} jours restants`,
          data: { delegate_id: o.delegate_id },
          is_read: false
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
    suspicious_visit: '🚨',
    missed_visit: '⚠️',
    objective_alert: '📊',
    new_campaign: '🎯',
    sync_complete: '✅'
  }

  const TYPE_COLORS = {
    suspicious_visit: 'border-rose-400',
    missed_visit: 'border-amber-400',
    objective_alert: 'border-purple-400',
    new_campaign: 'border-teal-400',
    sync_complete: 'border-blue-400'
  }

  const unread = notifications.filter(n => !n.is_read).length

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-teal-500 font-bold">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-blue-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white text-xl">←</button>
          <div>
            <h1 className="text-white font-black text-lg">Notifications</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              {unread} non lue{unread > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generateNotifications} disabled={generating}
            className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl font-black text-xs">
            {generating ? '...' : '🔄 Analyser'}
          </button>
          {unread > 0 && (
            <button onClick={markAllAsRead}
              className="bg-slate-600 text-white px-3 py-2 rounded-xl font-black text-xs">
              Tout lire
            </button>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-3 pb-10">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-slate-400 text-sm font-bold">Aucune notification</p>
            <p className="text-slate-300 text-xs mt-1">
              Cliquez sur "🔄 Analyser" pour détecter les alertes
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`bg-white rounded-2xl p-4 border-l-4 ${
              TYPE_COLORS[n.type] || 'border-slate-200'
            } ${!n.is_read ? 'shadow-md' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-teal-400 rounded-full flex-shrink-0" />
                    )}
                    <p className="font-black text-blue-950 text-sm">{n.title}</p>
                  </div>
                  <p className="text-xs text-slate-500">{n.body}</p>
                  <p className="text-xs text-slate-300 mt-1">
                    {new Date(n.created_at).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!n.is_read && (
                    <button onClick={() => markAsRead(n.id)}
                      className="bg-teal-50 text-teal-600 px-2 py-1.5 rounded-lg text-xs font-bold">
                      ✓
                    </button>
                  )}
                  <button onClick={() => deleteNotification(n.id)}
                    className="bg-rose-50 text-rose-500 px-2 py-1.5 rounded-lg text-xs font-bold">
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