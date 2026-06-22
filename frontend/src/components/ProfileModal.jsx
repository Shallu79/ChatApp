import { Camera, Save, X } from 'lucide-react';
import { useRef, useState } from 'react';
import Avatar from './Avatar.jsx';

export default function ProfileModal({ user, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const upload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 350 * 1024) return setError('Use a supported image under 350 KB.');
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    const saved = await onSave({ displayName, bio, avatar });
    setBusy(false);
    if (saved) onClose(); else setError('Could not save your profile.');
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <header><div><span className="section-kicker">Personalize</span><h2 id="profile-title">Your profile</h2></div><button onClick={onClose}><X /></button></header>
      <form onSubmit={submit}>
        <div className="profile-avatar-editor"><Avatar user={{ ...user, avatar, displayName }} size="xl" /><button type="button" onClick={() => fileRef.current?.click()}><Camera /></button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} hidden /></div>
        <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={48} required /></label>
        <label>About you<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={120} rows={3} placeholder="A short status or introduction" /><small>{bio.length}/120</small></label>
        <label>Username<input value={`@${user.username}`} disabled /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="profile-save" disabled={busy}>{busy ? <span className="button-loader" /> : <><Save /> Save changes</>}</button>
      </form>
    </section>
  </div>;
}
