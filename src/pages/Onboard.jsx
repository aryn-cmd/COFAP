import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ORG_OPTIONS = ['DTU', 'IIT Delhi', 'IIIT Delhi', 'Delhi University'];
const PLACEHOLDER_NAMES = ['Jordan Mehta', 'James Whitfield', 'Priya Menon', 'Noah Castillo', 'Ananya Rao', 'Lucas Ferreira'];

function shuffledOrgOptions() {
  const arr = [...ORG_OPTIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [...arr, 'Other'];
}

export default function Onboard({ session, onComplete }) {
  const placeholderName = useMemo(() => PLACEHOLDER_NAMES[Math.floor(Math.random() * PLACEHOLDER_NAMES.length)], []);
  const orgOptions = useMemo(shuffledOrgOptions, []);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [customOrg, setCustomOrg] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    const org = organization === 'Other' ? customOrg.trim() : organization;
    if (!org) { setMessage('Please choose or enter an organization.'); return; }
    const { data, error } = await supabase.from('profiles').insert({
      id: session.user.id,
      full_name: name.trim(),
      organization: org,
      nickname: nickname.trim() || null,
      phone_number: phone.trim() || null,
      bio: bio.trim() || null,
    }).select().single();
    if (error) { setMessage(error.message); return; }
    onComplete(data);
  }

  return (
    <main className="onboard-page">
      <form className="panel onboard-card" onSubmit={submit}>
        <p className="kicker">One last step</p>
        <h2>Set up your profile</h2>
        <p className="muted">Your teammates will see these details on the leaderboard.</p>

        <label>Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${placeholderName}`} required />
        </label>

        <label>Organization
          <select value={organization} onChange={(e) => setOrganization(e.target.value)} required>
            <option value="">Choose one</option>
            {orgOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        {organization === 'Other' && (
          <label>Your organization
            <input value={customOrg} onChange={(e) => setCustomOrg(e.target.value)} placeholder="Type it in" required />
          </label>
        )}

        <label>Nickname <span className="optional">(optional)</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="What should we call you?" />
        </label>

        <label>Phone number <span className="optional">(optional)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
        </label>

        <label>Anything else? <span className="optional">(optional)</span>
          <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Branch, year, role..." />
        </label>

        <button className="button primary">Enter COFAP <ArrowRight size={16} /></button>
        <p className="form-message">{message}</p>
      </form>
    </main>
  );
}
