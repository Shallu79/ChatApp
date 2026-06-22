function colorFor(value = '') {
  let hash = 0;
  for (const char of value) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 65% 52%)`;
}

export default function Avatar({ user, size = 'md', online = false, className = '' }) {
  const label = user?.displayName || user?.username || '?';
  return (
    <span className={`avatar avatar--${size} ${className}`} style={{ '--avatar-color': colorFor(label) }} aria-label={label}>
      {user?.avatar ? <img src={user.avatar} alt="" /> : <span>{label.slice(0, 2).toUpperCase()}</span>}
      {online && <i className="avatar__online" title="Online" />}
    </span>
  );
}
