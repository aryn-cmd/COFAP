import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Onboard from './pages/Onboard';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ActivityPage from './pages/Activity';
import LeaderboardPage from './pages/Leaderboard';
import TeamsPage from './pages/Teams';
import TeamDetailPage from './pages/TeamDetail';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import AdminPage from './pages/Admin';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  useEffect(() => {
    let alive = true;

    function withTimeout(promise, ms, label) {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} took too long to respond.`)), ms)),
      ]);
    }

    // Deliberately the ONLY thing driving session state. onAuthStateChange
    // fires immediately on subscribe with whatever session is already
    // stored (or null), so a separate manual getSession() call alongside it
    // is redundant — and was the source of a real deadlock: when a session
    // already exists, this event fires while Supabase's client is still
    // mid-way through its own internal locking for that event, so making
    // another Supabase call synchronously from inside this callback can
    // contend with that lock and hang indefinitely. Deferring the actual
    // fetch by one tick (setTimeout 0) lets that internal bookkeeping
    // finish first.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setTimeout(async () => {
        if (!alive) return;
        try {
          const { data, error } = await withTimeout(
            supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle(),
            10000,
            'Profile lookup',
          );
          if (error) throw error;
          if (alive) setProfile(data);
        } catch (err) {
          if (alive) setFatalError(err.message || 'Could not reach Supabase.');
        } finally {
          if (alive) setLoading(false);
        }
      }, 0);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function clearSessionAndRetry() {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }

  if (fatalError) {
    return (
      <div className="splash">
        COFAP
        <span>Couldn't connect: {fatalError}</span>
        <span>Usually a stuck login token. Try the button below, or check VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are set for this deployment.</span>
        <button className="button primary" style={{ marginTop: 18 }} onClick={clearSessionAndRetry}>Clear session &amp; retry</button>
      </div>
    );
  }
  if (loading) return <div className="splash">COFAP<span>Loading your week</span></div>;
  if (!session) return <Auth />;
  if (!profile) return <Onboard session={session} onComplete={setProfile} />;

  return (
    <Routes>
      <Route element={<Layout session={session} profile={profile} setProfile={setProfile} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="teams/:teamId" element={<TeamDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={profile?.is_admin ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;