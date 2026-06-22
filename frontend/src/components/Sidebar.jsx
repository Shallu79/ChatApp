import { LogOut, MessageCircleMore, MessageSquareText, Moon, Search, Settings2, Sun, UserPlus, Users } from 'lucide-react';
import Avatar from './Avatar.jsx';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function Sidebar({ currentUser, conversations, people, selectedId, onlineSet, view, setView, search, setSearch, onSelect, onStartChat, onProfile, onLogout, theme, onTheme }) {
  const normalized = search.trim().toLowerCase();
  const shownConversations = conversations.filter(({ partner }) => !normalized || `${partner.displayName} ${partner.username}`.toLowerCase().includes(normalized));
  const shownPeople = people.filter((person) => !normalized || `${person.displayName} ${person.username}`.toLowerCase().includes(normalized));

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="app-brand"><span className="brand-mark"><MessageCircleMore /></span><span>Mango <b>Connect</b></span></div>
        <button className="icon-button subtle" onClick={onTheme} aria-label="Toggle color theme">{theme === 'dark' ? <Sun /> : <Moon />}</button>
      </div>

      <div className="sidebar__heading">
        <div><span className="section-kicker">Your space</span><h1>{view === 'chats' ? 'Messages' : 'Discover people'}</h1></div>
        <button className="new-chat-button" onClick={() => setView(view === 'chats' ? 'people' : 'chats')} aria-label={view === 'chats' ? 'Find people' : 'View messages'}>{view === 'chats' ? <UserPlus /> : <MessageSquareText />}</button>
      </div>

      <div className="sidebar-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'chats' ? 'Search conversations' : 'Find by name or username'} /></div>

      <div className="sidebar-tabs">
        <button className={view === 'chats' ? 'active' : ''} onClick={() => setView('chats')}><MessageSquareText /> Chats</button>
        <button className={view === 'people' ? 'active' : ''} onClick={() => setView('people')}><Users /> People</button>
      </div>

      <div className="sidebar-list" aria-label={view === 'chats' ? 'Conversations' : 'People'}>
        {view === 'chats' && shownConversations.map((conversation) => (
          <button key={conversation.id} className={`conversation-card ${selectedId === conversation.id ? 'active' : ''}`} onClick={() => onSelect(conversation.id)}>
            <Avatar user={conversation.partner} online={onlineSet.has(conversation.partner.id)} />
            <span className="conversation-card__body">
              <span className="conversation-card__line"><b>{conversation.partner.displayName}</b><time>{formatTime(conversation.lastMessage?.at || conversation.updatedAt)}</time></span>
              <span className="conversation-card__line preview"><span>{String(conversation.lastMessage?.sender) === currentUser.id ? 'You: ' : ''}{conversation.lastMessage?.text || 'Start a new conversation'}</span>{conversation.unreadCount > 0 && <i>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</i>}</span>
            </span>
          </button>
        ))}
        {view === 'people' && shownPeople.map((person) => (
          <button key={person.id} className="person-card" onClick={() => onStartChat(person.id)}>
            <Avatar user={person} online={onlineSet.has(person.id)} />
            <span><b>{person.displayName}</b><small>@{person.username} · {onlineSet.has(person.id) ? 'Online now' : person.bio}</small></span>
            <MessageSquareText />
          </button>
        ))}
        {((view === 'chats' && !shownConversations.length) || (view === 'people' && !shownPeople.length)) && (
          <div className="sidebar-empty"><span>{view === 'chats' ? <MessageSquareText /> : <Users />}</span><b>{search ? 'No matches found' : view === 'chats' ? 'Your inbox is quiet' : 'No people yet'}</b><p>{search ? 'Try a different search.' : view === 'chats' ? 'Discover someone and say hello.' : 'Invite someone to create an account.'}</p>{view === 'chats' && !search && <button onClick={() => setView('people')}>Find people</button>}</div>
        )}
      </div>

      <footer className="sidebar-profile">
        <button className="profile-button" onClick={onProfile}><Avatar user={currentUser} size="sm" online /><span><b>{currentUser.displayName}</b><small>@{currentUser.username}</small></span><Settings2 /></button>
        <button className="icon-button subtle logout-icon" onClick={onLogout} aria-label="Sign out"><LogOut /></button>
      </footer>
    </aside>
  );
}
