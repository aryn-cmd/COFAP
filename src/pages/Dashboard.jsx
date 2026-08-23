import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, Dumbbell, GraduationCap, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const POINTS = { fitness: 3, misc: 2 };
const categories = {
  academic: { label: 'Academic', icon: GraduationCap, hint: 'Hours logged, one point per hour (capped at 8/day)' },
  fitness: { label: 'Fitness', icon: Dumbbell, hint: 'One workout session' },
  misc: { label: 'Miscellaneous', icon: Sparkles, hint: 'A meaningful contribution' },
};

function tierFor(points) {
  if (points >= 60) return 'Platinum';
  if (points >= 50) return 'Gold';
  if (points >= 40) return 'Silver';
  if (points >= 30) return 'Bronze';
  return 'Unranked';
}

export default function Dashboard() {
  const { session, activeTeam } = useOutletContext();
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeTeam) { setPoints(0); setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase.rpc('get_team_leaderboard', { target_group: activeTeam.group_id });
      if (cancelled) return;
      const me = (data || []).find((r) => r.user_id === session.user.id);
      setPoints(Number(me?.points || 0));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [activeTeam, session.user.id]);

  const tier = tierFor(points);
  const atGoal = points >= 60;

  return (
    <>
      <div className="page-heading"><div><p className="kicker">The COFAP dashboard</p><h2>Your week</h2></div></div>
      <section className="hero-grid">
        <div className="score-card">
          <p className="kicker">{activeTeam ? activeTeam.name : 'No team yet'}</p>
          <strong>{loading ? '–' : points}<small> pts</small></strong>
          <p className="muted">{!activeTeam ? 'Create or join a team to begin.' : atGoal ? 'Platinum reached — keep the standard high.' : `${60 - points} more points to reach Platinum.`}</p>
          <div className="score-rule"><span /><b>{atGoal ? 'Platinum tier' : 'Next goal · 60 pts'}</b></div>
        </div>
        <div className="accent-card">
          <p className="kicker">Weekly rank</p>
          <strong>{tier.toUpperCase()}</strong>
          <p>{tier === 'Unranked' ? 'Bronze begins at 30 points.' : 'Scoped to your active team.'}</p>
          <Link className="text-button dark" to="/leaderboard">View leaderboard <ArrowRight size={15} /></Link>
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div><p className="kicker">Start somewhere</p><h2>Three ways to move up</h2></div>
          <Link className="button secondary" to="/activity">Log activity <ArrowRight size={16} /></Link>
        </div>
        <div className="protocol-grid">
          {Object.entries(categories).map(([key, item]) => (
            <article key={key}>
              <item.icon size={20} />
              <b>{item.label}</b>
              <p>{item.hint}</p>
              <strong>{key === 'academic' ? '1 pt / hr' : `+${POINTS[key]} pts`}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
