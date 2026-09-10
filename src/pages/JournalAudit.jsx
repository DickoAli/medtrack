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
    visit_created: '📍', visit_validated: '✅', visit_suspicious: '🚨',
    delegate_created: '👤', delegate_disabled: '🚫', campaign_created: '🎯',
    campaign_activated: '▶️', login: '🔑', logout: '🚪', password_reset: '🔐',
    import_sales: '📥', content_published: '📢', wholesaler_created: '🏭',
    establishment_created: '🏥', hcp_created: '👨‍⚕️', portfolio_assigned: '👜',
    objective_set: '📊'
  }

  const ACTION_BORDER = {
    visit_created: '#087F5B', visit_validated: '#16A34A', visit_suspicious: '#DC2626',
    delegate_created: '#2563EB', delegate_disabled: '#98A2B3', campaign_created: '#F59E0B',
    login: '#2563EB', logout: '#98A2B3', password_reset: '#F59E0B',
    import_sales: '#2563EB', content_published: '#087F5B', default: '#DDE4EA'
  }

  const ACTION_LABELS = {
    visit_created: 'Visite créée', visit_validated: 'Visite validée', visit_suspicious: 'Visite suspecte',
    delegate_created: 'Délégué créé', delegate_disabled: 'Délégué désactivé', campaign_created: 'Campagne créée',
    campaign_activated: 'Campagne activée', login: 'Connexion', logout: 'Déconnexion',
    password_reset: 'Reset mot de passe', import_sales: 'Import ventes', content_published: 'Support publié',
    wholesaler_created: 'Grossiste créé', establishment_created: 'Établissement créé',
    hcp_created: 'Professionnel créé', portfolio_assigned: 'Portefeuille assigné', objective_set: 'Objectif défini'
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
            <h1 className="text-white font-semibold text-base">Journal d'audit</h1>
            <p className="text-[#9AA9C2] text-xs font-medium uppercase tracking-wide">
              Historique des actions
            </p>
          </div>
        </div>
        <button onClick={() => { setPage(0); fetchAll() }}
          className="bg-[#087F5B] text-white px-3 py-2 rounded-lg font-semibold text-xs">
          🔄
        </button>
      </div>

      <div className="px-5 pt-4 flex flex-col gap-3">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }}
          className="w-full p-3 rounded-lg border border-[#DDE4EA] bg-white text-sm text-[#172B4D]">
          <option value="tous">Tous les utilisateurs</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.delegates?.prenom} {u.delegates?.nom}</option>
          ))}
        </select>
      </div>

      <div className="p-5 flex flex-col gap-3 pb-10">
        {logs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-[#DDE4EA]">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-[#667085] text-sm font-medium">Aucune entrée dans le journal</p>
            <p className="text-[#98A2B3] text-xs mt-1">
              Les actions importantes seront tracées ici automatiquement
            </p>
          </div>
        ) : (
          <>
            {logs.map(log => (
              <div key={log.id} className="bg-white rounded-xl p-4 border border-[#DDE4EA]"
                style={{ borderLeft: `2px solid ${ACTION_BORDER[log.action] || ACTION_BORDER.default}` }}>
                <div className="flex items-start gap-3">
                  <span className="text-lg w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#EEF1F4]">
                    {ACTION_ICONS[log.action] || '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-[#172B4D] text-sm">
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF1F4] text-[#667085]">
                        {log.table_name || '—'}
                      </span>
                    </div>
                    <p className="text-xs text-[#667085]">
                      👤 {log.profiles?.delegates?.prenom} {log.profiles?.delegates?.nom}
                    </p>
                    {log.new_values && (
                      <div className="mt-2 bg-[#F4F7F9] rounded-lg p-2">
                        <p className="text-xs text-[#98A2B3] font-semibold mb-1">Données :</p>
                        <p className="text-xs text-[#667085] font-mono break-all">
                          {JSON.stringify(log.new_values).slice(0, 150)}
                          {JSON.stringify(log.new_values).length > 150 ? '...' : ''}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-[#98A2B3] mt-1">
                      {new Date(log.created_at).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${
                  page === 0 ? 'bg-[#EEF1F4] text-[#98A2B3]' : 'bg-white text-[#172B4D] border border-[#DDE4EA]'
                }`}>
                ← Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < PAGE_SIZE}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${
                  logs.length < PAGE_SIZE ? 'bg-[#EEF1F4] text-[#98A2B3]' : 'bg-[#172B4D] text-white'
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
