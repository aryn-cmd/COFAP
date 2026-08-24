import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

function tierFor(points) {
  if (points >= 60) return 'Platinum';
  if (points >= 50) return 'Gold';
  if (points >= 40) return 'Silver';
  if (points >= 30) return 'Bronze';
  return 'Unranked';
}
function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase();
}
const PALETTE = ['#ff765f', '#8ed8db', '#d8f06a', '#c7b7ff', '#f1bb71', '#e5a8c4', '#b9c6a8', '#9fd1ff'];
function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }

export default function LeaderboardPage() {
  const { session, teams, activeTeam, setActiveTeam } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeTeam) { setRows([]); setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase.rpc('get_team_leaderboard', { target_group: activeTeam.group_id });
      if (cancelled) return;
      setRows((data || []).sort((a, b) => b.points - a.points));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [activeTeam]);

  return (
    <>
      <div className="page-heading">
        <div><p className="kicker">The weekly race</p><h2>Leaderboard</h2></div>
        {teams.length > 1 && (
          <select className="leaderboard-select" value={activeTeam?.group_id || ''} onChange={(e) => setActiveTeam(teams.find((t) => t.group_id === e.target.value) || null)}>
            {teams.map((t) => <option key={t.group_id} value={t.group_id}>{t.name}</option>)}
          </select>
        )}
      </div>
      {!activeTeam ? (
        <div className="empty-panel"><Trophy size={24} /><h3>Join your first team</h3><p>Leaderboard rankings are scoped to each team.</p></div>
      ) : (
        <div className="panel leaderboard">
          <div className="leaderboard-head"><span>Rank</span><span>Member</span><span>Points</span><span>Status</span></div>
          {loading ? <p className="muted small pad">Loading...</p> : !rows.length ? <p className="muted small pad">No one's logged points yet.</p> : rows.map((m, i) => {
            const tier = tierFor(Number(m.points));
            const isYou = m.user_id === session.user.id;
            return (
              <div className={`leaderboard-row${isYou ? ' you' : ''}`} key={m.user_id}>
                <span className="rank">0{i + 1}</span>
                <span className="member"><span className="avatar" style={{ background: colorFor(m.user_id) }}>{initials(m.full_name)}</span><span><b>{m.full_name}{isYou ? ' (you)' : ''}</b><small>{m.organization}</small></span></span>
                <span className="points">{m.points} <small>pts</small></span>
                <span className={`status ${tier.toLowerCase()}`}>{tier.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
