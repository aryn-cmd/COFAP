import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';

function formatDateTime(iso) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function AdminPage() {
  const { session, showToast } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [teamsList, setTeamsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ count: userCount }, { count: teamCount }, { count: activityCount }, { data: t }, { data: u }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('activities').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('name, invite_code, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles').select('full_name, organization, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    setStats({ userCount, teamCount, activityCount });
    setTeamsList(t || []);
    setUsersList(u || []);
  }

  async function sendBroadcast(e) {
    e.preventDefault();
    const { error } = await supabase.from('notifications').insert({ scope: 'broadcast', sender_id: session.user.id, title: title.trim(), message: message.trim() });
    if (error) { showToast(error.message); return; }
    setTitle(''); setMessage('');
    showToast('Announcement sent to everyone');
  }

  return (
    <>
      <div className="page-heading"><div><p className="kicker">Admin</p><h2>Platform console</h2></div></div>
      <div className="admin-stats">
        <div className="panel admin-stat"><b>{stats?.userCount ?? '–'}</b><span>Total users</span></div>
        <div className="panel admin-stat"><b>{stats?.teamCount ?? '–'}</b><span>Total teams</span></div>
        <div className="panel admin-stat"><b>{stats?.activityCount ?? '–'}</b><span>Logged activities</span></div>
      </div>
      <form className="panel form-card" onSubmit={sendBroadcast}>
        <p className="kicker">Send an announcement to everyone</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Title" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} required placeholder="Message" />
        <button className="button primary"><Megaphone size={16} /> Send to all users</button>
      </form>
      <div className="panel admin-table-wrap">
        <p className="kicker">Recent teams</p>
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Key</th><th>Created</th></tr></thead>
          <tbody>{teamsList.map((t) => <tr key={t.invite_code}><td>{t.name}</td><td>{t.invite_code}</td><td>{formatDateTime(t.created_at)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="panel admin-table-wrap">
        <p className="kicker">Recent users</p>
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Organization</th><th>Joined</th></tr></thead>
          <tbody>{usersList.map((u, i) => <tr key={i}><td>{u.full_name}</td><td>{u.organization}</td><td>{formatDateTime(u.created_at)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
