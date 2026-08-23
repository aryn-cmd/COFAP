import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { KeyRound, UsersRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase();
}
const PALETTE = ['#ff765f', '#8ed8db', '#d8f06a', '#c7b7ff', '#f1bb71', '#e5a8c4', '#b9c6a8', '#9fd1ff'];
function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
function formatDate(d) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${d}T12:00:00`)); }

const CATEGORY_LABEL = { academic: 'Academic', fitness: 'Fitness', misc: 'Miscellaneous' };

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const { session, teams, activeTeam, setActiveTeam, reloadTeams, showToast } = useOutletContext();
  const team = teams.find((t) => t.group_id === teamId);
  const [members, setMembers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: lb }, { data: activity }] = await Promise.all([
        supabase.rpc('get_team_leaderboard', { target_group: teamId }),
        supabase.rpc('get_team_activity_feed', { target_group: teamId, limit_count: 40 }),
      ]);
      if (cancelled) return;
      setMembers(lb || []);
      setFeed(activity || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  if (!team) return <div className="empty-panel"><UsersRound size={24} /><p>You're not on this team, or it doesn't exist.</p></div>;

  function copyKey() {
    navigator.clipboard?.writeText(team.invite_code).then(() => showToast('Passkey copied')).catch(() => showToast(`Key: ${team.invite_code}`));
  }

  async function requestLeave() {
    if (!window.confirm(`Leave ${team.name}? You'll get a 30-day notice period and can cancel any time before then.`)) return;
    const { error } = await supabase.rpc('request_leave_team', { target_group: teamId });
    if (error) { showToast(error.message); return; }
    showToast('Leave requested — 30-day notice started.');
    await reloadTeams();
  }

  async function cancelLeave() {
    const { error } = await supabase.rpc('cancel_leave_team', { target_group: teamId });
    if (error) { showToast(error.message); return; }
    showToast('Leave request cancelled.');
    await reloadTeams();
  }

  const daysLeft = team.leave_requested_at
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(team.leave_requested_at)) / 86400000))
    : null;

  return (
    <>
      <div className="page-heading">
        <div><p className="kicker">Private team space</p><h2>{team.name}</h2></div>
        {activeTeam?.group_id !== teamId && <button className="chip-button" onClick={() => setActiveTeam(team)}>Set as active</button>}
      </div>

      <div className="team-detail-grid">
        <div className="panel team-detail-info">
          <div className="detail-row"><span className="kicker">Members</span><b>{members.length} / {team.max_members}</b></div>
          <div className="detail-row"><span className="kicker">Passkey</span><button className="chip-button" onClick={copyKey}><KeyRound size={13} /> {team.invite_code}</button></div>
          <div className="detail-row">
            {team.leave_requested_at ? (
              <>
                <span className="kicker">Leaving in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>
                <button className="chip-button" onClick={cancelLeave}>Cancel leave request</button>
              </>
            ) : (
              <button className="chip-button leave" onClick={requestLeave}>Leave team (30-day notice)</button>
            )}
          </div>
        </div>
        <div className="panel team-detail-roster">
          <p className="kicker">Roster</p>
          {members.map((m) => (
            <div className="roster-row" key={m.user_id}>
              <span className="avatar" style={{ background: colorFor(m.user_id) }}>{initials(m.full_name)}</span>
              <span><b>{m.full_name}{m.user_id === session.user.id ? ' (you)' : ''}</b><small>{m.organization}</small></span>
              <span className="points">{m.points} pts</span>
            </div>
          ))}
        </div>
      </div>

      <section className="section-block">
        <div className="section-heading"><div><p className="kicker">What the team's up to</p><h2>Activity feed</h2></div></div>
        <div className="panel activity-feed">
          {loading ? <p className="muted small pad">Loading...</p> : !feed.length ? <p className="muted small pad">No activity logged yet.</p> : feed.map((a) => (
            <div className="feed-row" key={a.id}>
              <span className="avatar" style={{ background: colorFor(a.user_id) }}>{initials(a.full_name)}</span>
              <span>
                <b>{a.full_name} · {a.title}</b>
                <small>{CATEGORY_LABEL[a.category]} · {formatDate(a.activity_date)}{a.hours ? ` · ${a.hours}h` : ''}</small>
                {a.description ? <p className="feed-description">{a.description}</p> : (a.has_description && a.user_id !== session.user.id ? <p className="feed-description muted"><em>Description kept private</em></p> : null)}
              </span>
              <span className="entry-points">+{a.points} pts</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
