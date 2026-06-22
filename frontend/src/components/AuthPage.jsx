import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, ImagePlus, LockKeyhole, MessageCircleMore, ShieldCheck, Sparkles, Users } from 'lucide-react';

const MAX_AVATAR = 350 * 1024;

export default function AuthPage({ onAuthenticate, error, busy }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '', avatar: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [availability, setAvailability] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (mode !== 'register' || !/^[a-z0-9_]{3,24}$/.test(form.username)) {
      setAvailability(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/username-check?username=${encodeURIComponent(form.username)}`);
        const data = await response.json();
        setAvailability(response.ok ? data : null);
      } catch { setAvailability(null); }
    }, 350);
    return () => clearTimeout(timer);
  }, [form.username, mode]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const switchMode = (next) => {
    setMode(next);
    setLocalError('');
    setAvailability(null);
  };

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > MAX_AVATAR) {
      setLocalError('Choose a PNG, JPEG, WebP, or GIF under 350 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update('avatar', reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setLocalError('');
    if (!/^[a-z0-9_]{3,24}$/.test(form.username)) return setLocalError('Username needs 3–24 letters, numbers, or underscores.');
    if (mode === 'register' && form.password.length < 8) return setLocalError('Use at least 8 characters for your password.');
    if (mode === 'register' && form.password !== form.confirm) return setLocalError('Passwords do not match.');
    if (mode === 'register' && availability?.available === false) return setLocalError('That username is already taken.');
    await onAuthenticate({ mode, username: form.username, password: form.password, displayName: form.displayName || form.username, avatar: form.avatar });
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark"><MessageCircleMore /></span><span>Mango</span><b>Connect</b></div>
        <div className="auth-copy">
          <span className="eyebrow"><Sparkles size={15} /> Built for meaningful conversations</span>
          <h1>Where every message feels <em>a little closer.</em></h1>
          <p>A modern, private space for teams, communities, and customers to connect in real time.</p>
          <div className="auth-features">
            <div><ShieldCheck /><span><b>Private by design</b><small>Secure sessions and protected chats</small></span></div>
            <div><Users /><span><b>Presence that feels alive</b><small>Typing, online status, and read receipts</small></span></div>
            <div><Sparkles /><span><b>Beautifully expressive</b><small>Reactions, images, editing, and themes</small></span></div>
          </div>
        </div>
        <div className="auth-proof">
          <div className="proof-avatars"><i>AK</i><i>JM</i><i>RS</i><i>+</i></div>
          <span><b>Designed for people</b><small>Fast, friendly, and delightfully simple</small></span>
        </div>
        <span className="auth-orb auth-orb--one" /><span className="auth-orb auth-orb--two" />
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card__mobile-brand"><span className="brand-mark"><MessageCircleMore /></span>Mango <b>Connect</b></div>
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button>
          </div>
          <header>
            <span className="auth-icon"><LockKeyhole /></span>
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your space'}</h2>
            <p>{mode === 'login' ? 'Your conversations are waiting for you.' : 'Join in less than a minute. No noise, just connection.'}</p>
          </header>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <div className="avatar-upload-row">
                <button type="button" className="avatar-upload-preview" onClick={() => fileRef.current?.click()} aria-label="Choose profile photo">
                  {form.avatar ? <img src={form.avatar} alt="Profile preview" /> : <ImagePlus />}
                </button>
                <div><b>Add a profile photo</b><small>Optional · max 350 KB</small><button type="button" onClick={() => fileRef.current?.click()}>Choose image</button></div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} hidden />
              </div>
            )}
            {mode === 'register' && <label>Display name<input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} maxLength={48} placeholder="How people will know you" autoComplete="name" /></label>}
            <label>
              Username
              <div className="field-with-status">
                <input value={form.username} onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} minLength={3} maxLength={24} placeholder="your_unique_name" autoComplete="username" required />
                {mode === 'register' && availability?.available && <Check className="field-check" />}
              </div>
              {mode === 'register' && availability && <small className={availability.available ? 'availability good' : 'availability bad'}>{availability.available ? 'Username is available' : `Taken — try ${availability.suggestion}`}</small>}
            </label>
            <label>
              Password
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} minLength={mode === 'register' ? 8 : undefined} maxLength={72} placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
            </label>
            {mode === 'register' && <label>Confirm password<input type="password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} minLength={8} maxLength={72} placeholder="Repeat your password" autoComplete="new-password" required /></label>}
            {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? <span className="button-loader" /> : <>{mode === 'login' ? 'Open Mango Connect' : 'Create my account'}<ArrowRight /></>}</button>
          </form>
          <p className="auth-terms">By continuing, you agree to respectful and responsible communication.</p>
        </div>
      </section>
    </main>
  );
}
