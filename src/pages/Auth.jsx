import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('Working...');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (result.error) setMessage(result.error.message);
    else setMessage(mode === 'signin' ? '' : 'Check your email to confirm your account.');
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="logo-lockup">
          <img src="/cofap-logo.svg" alt="COFAP" />
          <span><b>COFAP</b><small>Centre of excellence</small></span>
        </div>
        <p className="kicker">Fitness · Academics · Placements</p>
        <h1>Make your week<br /><em>count.</em></h1>
        <p className="hero-description">A private accountability space for people who keep showing up.</p>
        <div className="stat-strip">
          <span><b>03</b><small>pillars</small></span>
          <span><b>60</b><small>platinum goal</small></span>
          <span><b>∞</b><small>team spaces</small></span>
        </div>
      </section>
      <section className="auth-panel">
        <p className="kicker">{mode === 'signin' ? 'Welcome back' : 'Start your account'}</p>
        <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <p className="muted">Your progress lives here.</p>
        <form onSubmit={submit}>
          <label>Email address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </label>
          <button className="button primary" type="submit">{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button>
        </form>
        <p className="form-message">{message}</p>
        <button className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
          {mode === 'signin' ? 'New to COFAP? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}
