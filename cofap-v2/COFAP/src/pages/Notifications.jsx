import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

function formatDateTime(iso) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function NotificationsPage() {
  const { session, teams, activeTeam, notifications, reloadNotifications, showToast } = useOutletContext();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  function labelFor(n) {
    return n.scope === 'broadcast' ? 'Announcement' : (teams.find((t) => t.group_id === n.group_id)?.name || 'Team');
  }

  async function submit(e) {
    e.preventDefault();
    if (!activeTeam) { showToast('Select a team first.'); return; }
    const { error } = await supabase.from('notifications').insert({
      scope: 'team', group_id: activeTeam.group_id, sender_id: session.user.id,
      title: title.trim(), message: message.trim(),
    });
    if (error) { showToast(error.message); return; }
    setTitle(''); setMessage(''); setComposing(false);
    showToast('Posted to your team');
    await reloadNotifications();
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="kicker">Stay in the loop</p><h2>Notifications</h2></div>
        {activeTeam && <button type="button" className="chip-button" onClick={() => setComposing((v) => !v)}><Plus size={13} /> New message</button>}
      </div>

      {composing && (
        <form className="panel form-card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <p className="kicker">Post to {activeTeam?.name}</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Title, e.g. Group study Sunday" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={400} required placeholder="Details..." />
          <button className="button primary">Post</button>
          <p className="muted small">Only teammates who've opted in (Profile → notifications) will see this.</p>
        </form>
      )}

      <div className="panel notif-feed">
        {notifications.length ? notifications.map((n) => (
          <div className="notif-feed-item" key={n.id}>
            <b>{n.title}</b>
            <p>{n.message}</p>
            <small>{labelFor(n)} · {formatDateTime(n.created_at)}</small>
          </div>
        )) : <p className="muted small pad">Nothing yet.</p>}
      </div>
    </>
  );
}
