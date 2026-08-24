import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, KeyRound, Plus, UsersRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function TeamsPage() {
  const { teams, reloadTeams } = useOutletContext();
  const [name, setName] = useState('');
  const [size, setSize] = useState(12);
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');

  async function create(e) {
    e.preventDefault();
    const { error } = await supabase.rpc('create_cofap_team', { team_name: name, team_size: Number(size) });
    setMessage(error?.message || 'Team created.');
    setName('');
    await reloadTeams();
  }

  async function join(e) {
    e.preventDefault();
    const { error } = await supabase.rpc('join_cofap_team', { invite_code_input: key });
    setMessage(error?.message || 'Joined team.');
    setKey('');
    await reloadTeams();
  }

  return (
    <>
      <div className="page-heading"><div><p className="kicker">Your COFAP spaces</p><h2>Teams</h2></div></div>
      <div className="team-list">
        {teams.map((team) => (
          <Link to={`/teams/${team.group_id}`} className="team-card" key={team.group_id}>
            <span className="team-icon"><UsersRound size={19} /></span>
            <span>
              <b>{team.name}</b>
              <small>{team.active_member_count}/{team.max_members} members · {team.role === 'owner' ? 'Owner' : 'Member'}{team.leave_requested_at ? ' · leaving soon' : ''}</small>
            </span>
            <ArrowRight size={17} />
          </Link>
        ))}
        {!teams.length && <div className="empty-panel compact"><UsersRound size={22} /><p>No teams yet. Create one or join a friend's space.</p></div>}
      </div>
      <div className="split-forms">
        <form className="panel form-card" onSubmit={create}>
          <p className="kicker">Start a space</p>
          <h3>Create a team</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" required />
          <label className="inline-label">Max size
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value={10}>10</option><option value={11}>11</option><option value={12}>12</option>
            </select>
          </label>
          <button className="button primary">Create team <Plus size={16} /></button>
        </form>
        <form className="panel form-card" onSubmit={join}>
          <p className="kicker">Have an invite?</p>
          <h3>Join a team</h3>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste team passkey" required />
          <button className="button secondary">Join team <KeyRound size={16} /></button>
        </form>
      </div>
      <p className="form-message">{message}</p>
    </>
  );
}
