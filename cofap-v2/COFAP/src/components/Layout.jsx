import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Bell, Home, LogOut, ShieldCheck, Trophy, UserRound, UsersRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NotificationBell from './NotificationBell';

const routeLinks = [
  ['/dashboard', Home, 'Dashboard'],
  ['/activity', Activity, 'Log activity'],
  ['/leaderboard', Trophy, 'Leaderboard'],
  ['/teams', UsersRound, 'Teams'],
  ['/notifications', Bell, 'Notifications'],
  ['/profile', UserRound, 'Profile'],
];

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export default function Layout({ session, profile, setProfile }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeamState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  function setActiveTeam(team) {
    setActiveTeamState(team);
    if (team) localStorage.setItem('cofap-active-team', team.group_id);
    else localStorage.removeItem('cofap-active-team');
  }

  const loadTeams = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_teams_overview');
    const next = data || [];
    setTeams(next);
    setActiveTeamState((current) => {
      const stillThere = next.find((t) => t.group_id === current?.group_id);
      const stored = localStorage.getItem('cofap-active-team');
      const chosen = stillThere || next.find((t) => t.group_id === stored) || next[0] || null;
      if (chosen) localStorage.setItem('cofap-active-team', chosen.group_id);
      else localStorage.removeItem('cofap-active-team');
      return chosen;
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    const filtered = (data || []).filter((n) => n.scope === 'broadcast' || profile?.team_notifications_enabled);
    setNotifications(filtered);
    const ids = filtered.map((n) => n.id);
    if (ids.length) {
      const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', session.user.id).in('notification_id', ids);
      setReadIds(new Set((reads || []).map((r) => r.notification_id)));
    } else {
      setReadIds(new Set());
    }
  }, [profile?.team_notifications_enabled, session.user.id]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !readIds.has(n.id));
    if (!unread.length) return;
    setReadIds((prev) => new Set([...prev, ...unread.map((n) => n.id)]));
    await supabase.from('notification_reads').upsert(unread.map((n) => ({ notification_id: n.id, user_id: session.user.id })));
  }, [notifications, readIds, session.user.id]);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    const channel = supabase.channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new;
        const relevant = n.scope === 'broadcast' || (teams.some((t) => t.group_id === n.group_id) && profile?.team_notifications_enabled);
        if (!relevant) return;
        setNotifications((prev) => [n, ...prev]);
        const label = n.scope === 'broadcast' ? 'Announcement' : (teams.find((t) => t.group_id === n.group_id)?.name || 'Team');
        showToast(`${label}: ${n.title}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teams, profile?.team_notifications_enabled, showToast]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  const displayName = profile?.nickname || profile?.full_name || 'User';

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link to="/dashboard" className="logo-lockup">
          <img src="/cofap-logo.svg" alt="COFAP" />
          <span><b>COFAP</b><small>Centre of excellence</small></span>
        </Link>
        <nav>
          {routeLinks.map(([path, Icon, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} />{label}
              {path === '/notifications' && unreadCount > 0 && <span className="nav-dot" />}
            </NavLink>
          ))}
          {profile?.is_admin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link admin-link${isActive ? ' active' : ''}`}>
              <ShieldCheck size={17} />Admin console
            </NavLink>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <div className="side-user">
          <span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span>
          <span><b>{displayName}</b><small>{session.user.email}</small></span>
        </div>
        <button className="nav-link signout" onClick={signOut}><LogOut size={17} />Sign out</button>
      </aside>
      <main className="page">
        <header className="topbar">
          <div>
            <p className="kicker">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
            <h1>Good {timeOfDay()}, {displayName.split(' ')[0]}<span className="accent">.</span></h1>
          </div>
          <div className="top-actions">
            <NotificationBell notifications={notifications} readIds={readIds} unreadCount={unreadCount} teams={teams} onOpen={markAllRead} />
            <div className="top-team">
              <span>Active team</span>
              <select value={activeTeam?.group_id || ''} onChange={(e) => setActiveTeam(teams.find((t) => t.group_id === e.target.value) || null)}>
                <option value="">No team selected</option>
                {teams.map((t) => <option key={t.group_id} value={t.group_id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </header>
        <Outlet context={{ session, profile, setProfile, teams, activeTeam, setActiveTeam, reloadTeams: loadTeams, notifications, reloadNotifications: loadNotifications, showToast }} />
      </main>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  );
}