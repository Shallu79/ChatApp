import { ArrowUpRight, MessageCircleHeart, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Avatar from './Avatar.jsx';

export default function WelcomePanel({ currentUser, people, onlineSet, conversationCount, onStartChat, onDiscover }) {
  return (
    <main className="welcome-panel">
      <div className="welcome-glow" />
      <section className="welcome-hero">
        <span className="eyebrow"><Sparkles size={15} /> Your conversations, beautifully organized</span>
        <h2>Good to see you, <em>{currentUser.displayName.split(' ')[0]}.</em></h2>
        <p>Pick up where you left off, or turn a new hello into something meaningful.</p>
        <button onClick={onDiscover}>Start a conversation <ArrowUpRight /></button>
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card stat-card"><span className="stat-icon coral"><MessageCircleHeart /></span><div><b>{conversationCount}</b><small>Active conversations</small></div><i>All caught up</i></article>
        <article className="dashboard-card stat-card"><span className="stat-icon violet"><Users /></span><div><b>{onlineSet.size}</b><small>People online now</small></div><i>Ready to connect</i></article>
        <article className="dashboard-card privacy-card"><span><ShieldCheck /></span><div><b>Private by default</b><p>Your identity is protected by secure sessions. Only conversation members can read messages.</p></div></article>
        <article className="dashboard-card suggestions-card">
          <header><div><span className="section-kicker">Suggested</span><h3>People you may know</h3></div><button onClick={onDiscover}>View all</button></header>
          <div className="suggestion-list">
            {people.slice(0, 3).map((person) => <button key={person.id} onClick={() => onStartChat(person.id)}><Avatar user={person} online={onlineSet.has(person.id)} /><span><b>{person.displayName}</b><small>@{person.username}</small></span><ArrowUpRight /></button>)}
            {!people.length && <p className="quiet-note">New people will appear here when they join.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
