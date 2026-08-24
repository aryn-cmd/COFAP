import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

function formatDateTime(iso) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function NotificationBell({ notifications, readIds, unreadCount, teams, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) onOpen();
  }

  function labelFor(n) {
    return n.scope === 'broadcast' ? 'Announcement' : (teams.find((t) => t.group_id === n.group_id)?.name || 'Team');
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button type="button" className="icon-button" onClick={toggle} aria-label="Notifications">
        <Bell size={17} />
        {unreadCount > 0 && <span className="notif-dot" />}
      </button>
      {open && (
        <div className="notif-panel">
          <p className="kicker">Notifications</p>
          {notifications.length ? notifications.slice(0, 8).map((n) => (
            <div key={n.id} className={`notif-item${!readIds.has(n.id) ? ' unread' : ''}`}>
              <b>{n.title}</b>
              <p>{n.message}</p>
              <small>{labelFor(n)} · {formatDateTime(n.created_at)}</small>
            </div>
          )) : <p className="muted small">Nothing yet.</p>}
        </div>
      )}
    </div>
  );
}
