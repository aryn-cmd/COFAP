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

    async function initSessionAndProfile() {
      setLoading(true);
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!alive) return;

        setSession(currentSession);
        if (currentSession) {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentSession.user.id).maybeSingle();
          if (alive) setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (alive) setFatalError(err.message || 'Could not reach Supabase.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    initSessionAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        const { data } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle();
        setProfile(data);
      } else {
        setProfile(null);
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (fatalError) {
    return (
      <div className="splash">
        COFAP
        <span>Couldn't connect: {fatalError}</span>
        <span>Check VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are set for this deployment.</span>
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