import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function JournalAudit({ onBack, profile }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('tous')
  const [filterUser, setFilterUser] = useState('tous')
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const ACTION_ICONS = {
    visit_created: '📍',
    visit_validated: '✅',
    visit_suspicious: '🚨',
    delegate_created: '👤',
    delegate_disabled: '🚫',
    campaign_created: '🎯',
    campaign_activated: '▶️',
    login: '🔑',
    logout: '🚪',
    password_reset: '🔐',
    import_sales: '📥',
    content_published: '📢',
    wholesaler_created: '🏭',
    establishment_created: '🏥',
    hcp_created: '👨‍⚕️',
    portfolio_assigned: '👜',
    objective_set: '📊'
  }

  const ACTION_COLORS = {
    visit_created: 'bg-teal-100 text-teal-600',
    visit_validated: 'bg-green-100 text-green-600',
    visit_suspicious: 'bg-rose-100 text-rose-500',
    delegate_created: 'bg-blue-100 text-blue-600',
    delegate_disabled: 'bg-slate-100 text-slate-500',
    campaign_created: 'bg-orange-100 text-orange-600',
    login: 'bg-purple-100 text-purple-600',
    logout: 'bg-slate-100 text-slate-500',
    password_reset: 'bg-amber-100 text-amber-600',
    import_sales: 'bg-indigo-100 text-indigo-600',
    content_published: 'bg-pink-100 text-pink-600',
    default: 'bg-slate-100 text-slate-500'
  }

  const ACTION_LABELS = {
    visit_created: 'Visite créée',
    visit_validated: 'Visite validée',
    visit_suspicious: 'Visite suspecte',
    delegate_created: 'Délégué créé',
    delegate_disabled: 'Délégué désactivé',
    campaign_created: 'Campagne créée',
    campaign_activated: 'Campagne activée',
    login: 'Connexion',
    logout: 'Déconnexion',
    password_reset: 'Reset mot de passe',
    import_sales: 'Import ventes',
    content_published: 'Support publié',
    wholesaler_created: 'Grossiste créé',
    establishment_created: 'Établissement créé',
    hcp_created: 'Professionnel créé',
    portfolio_assigned: 'Portefeuille assigné',
    objective_set: 'Objectif défini'
  }

  useEffect(() => { fetchAll() }, [filterAction, filterUser, page])

  const fetchAll = async () => {
    setLoading(true)
    let query = supabase
      .from('audit_logs')
      .select('*, profiles(delegates(nom, prenom))')
      .eq('agence_id', profile.agence_id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterAction !== 'tous') query = query.eq('action', filterAction)
    if (filterUser !== 'tous') query = query.eq('user_id', filterUser)

    const { data } = await query
    setLogs(data || [])

    const { data: u } = await supabase
      .from('profiles')
      .select('id, delegates(nom, prenom)')
      .eq('agence_id', profile.agence_id)
    setUsers(u || [])
    setLoading(false)
  }

  // Fonction pour logger une action
  const logAction = async (action, tableName, recordId, oldValues, newValues) => {
    await supabase.from('audit_logs').insert({
      agence_id: profile.agence_id,
      user_id: profile.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues || null,
      new_values: newValues || null
    })
  }

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
            <h1 className="text-white font-black text-lg">Journal d'audit</h1>
            <p className="text-teal-400 text-xs font-bold uppercase tracking-wider">
              Historique des actions
            </p>
          </div>
        </div>
        <button onClick={() => { setPage(0); fetchAll() }}
          className="bg-teal-400 text-blue-950 px-3 py-2 rounded-xl font-bold text-xs">
          🔄
        </button>
      </div>

      {/* Filtres */}
      <div className="px-6 pt-4 flex flex-col gap-3">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }}
          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="tous">Tous les utilisateurs</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.delegates?.prenom} {u.delegates?.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="p-6 flex flex-col gap-3 pb-10">
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-400 text-sm font-bold">Aucune entrée dans le journal</p>
            <p className="text-slate-300 text-xs mt-1">
              Les actions importantes seront tracées ici automatiquement
            </p>
          </div>
        ) : (
          <>
            {logs.map(log => (
              <div key={log.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-lg w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    ACTION_COLORS[log.action] || ACTION_COLORS.default
                  }`}>
                    {ACTION_ICONS[log.action] || '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-black text-blue-950 text-sm">
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        ACTION_COLORS[log.action] || ACTION_COLORS.default
                      }`}>
                        {log.table_name || '—'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      👤 {log.profiles?.delegates?.prenom} {log.profiles?.delegates?.nom}
                    </p>
                    {log.new_values && (
                      <div className="mt-2 bg-slate-50 rounded-xl p-2">
                        <p className="text-xs text-slate-400 font-bold mb-1">Données :</p>
                        <p className="text-xs text-slate-600 font-mono break-all">
                          {JSON.stringify(log.new_values).slice(0, 150)}
                          {JSON.stringify(log.new_values).length > 150 ? '...' : ''}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-slate-300 mt-1">
                      {new Date(log.created_at).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className={`flex-1 py-3 rounded-2xl font-black text-sm ${
                  page === 0 ? 'bg-slate-100 text-slate-300' : 'bg-white text-blue-950 border border-slate-200'
                }`}>
                ← Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < PAGE_SIZE}
                className={`flex-1 py-3 rounded-2xl font-black text-sm ${
                  logs.length < PAGE_SIZE ? 'bg-slate-100 text-slate-300' : 'bg-blue-950 text-white'
                }`}>
                Suivant →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}