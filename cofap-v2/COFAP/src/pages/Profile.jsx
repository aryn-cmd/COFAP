import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const { session, profile, setProfile } = useOutletContext();
  const [name, setName] = useState(profile.full_name || '');
  const [org, setOrg] = useState(profile.organization || '');
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [phone, setPhone] = useState(profile.phone_number || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [teamNotifs, setTeamNotifs] = useState(!!profile.team_notifications_enabled);
  const [message, setMessage] = useState('');

  async function save(e) {
    e.preventDefault();
    const { data, error } = await supabase.from('profiles').update({
      full_name: name.trim(),
      organization: org.trim(),
      nickname: nickname.trim() || null,
      phone_number: phone.trim() || null,
      bio: bio.trim() || null,
      team_notifications_enabled: teamNotifs,
    }).eq('id', session.user.id).select().single();
    if (error) { setMessage(error.message); return; }
    setProfile(data);
    setMessage('Saved.');
  }

  return (
    <>
      <div className="page-heading"><div><p className="kicker">Your account</p><h2>Profile</h2></div></div>
      <form className="panel profile-card" onSubmit={save}>
        <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Nickname <span className="optional">(optional)</span><input value={nickname} onChange={(e) => setNickname(e.target.value)} /></label>
        <label>Organization<input value={org} onChange={(e) => setOrg(e.target.value)} required /></label>
        <label>Phone number <span className="optional">(optional)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>About <span className="optional">(optional)</span><input value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        <label>Email address<input value={session.user.email} disabled /></label>
        <label className="check"><input type="checkbox" checked={teamNotifs} onChange={(e) => setTeamNotifs(e.target.checked)} /> Receive notifications posted by my teammates</label>
        <p className="notice-text">Email is locked after signup and was never pre-filled from your name. Your profile details are private unless you share a team.</p>
        <button className="button primary">Save profile <ArrowRight size={16} /></button>
        <p className="form-message">{message}</p>
      </form>
    </>
  );
}
