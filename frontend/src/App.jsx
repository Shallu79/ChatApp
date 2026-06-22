import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { api, jsonBody } from './api.js';
import AuthPage from './components/AuthPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import WelcomePanel from './components/WelcomePanel.jsx';
import ChatView from './components/ChatView.jsx';
import ProfileModal from './components/ProfileModal.jsx';

const socket = io({ autoConnect: false, withCredentials: true });

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineSet, setOnlineSet] = useState(new Set());
  const [typingConversation, setTypingConversation] = useState('');
  const [view, setView] = useState('chats');
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('mango-theme') || 'light');
  const selectedRef = useRef('');
  const toastTimer = useRef(null);

  selectedRef.current = selectedId;
  const selectedConversation = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);

  const notify = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mango-theme', theme);
  }, [theme]);

  const loadConversations = useCallback(async () => {
    try { setConversations(await api('/api/conversations')); }
    catch (error) { notify(error.message, 'error'); }
  }, [notify]);

  const loadPeople = useCallback(async () => {
    try { setPeople(await api('/api/users')); }
    catch (error) { notify(error.message, 'error'); }
  }, [notify]);

  useEffect(() => {
    let active = true;
    api('/api/auth/me').then((user) => active && setCurrentUser(user)).catch(() => {}).finally(() => active && setSessionLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    loadConversations(); loadPeople();

    const onPresence = ({ onlineUserIds }) => setOnlineSet(new Set(onlineUserIds));
    const onNewMessage = (message) => {
      if (selectedRef.current === message.conversationId) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        if (message.sender.id !== currentUser.id) api(`/api/conversations/${message.conversationId}/read`, { method: 'POST' }).catch(() => {});
      }
      loadConversations();
    };
    const onUpdatedMessage = (message) => setMessages((current) => current.map((item) => item.id === message.id ? message : item));
    const onRead = ({ conversationId, userId }) => {
      if (conversationId === selectedRef.current) setMessages((current) => current.map((message) => message.readBy.includes(userId) ? message : { ...message, readBy: [...message.readBy, userId] }));
    };
    const onTyping = ({ conversationId, isTyping }) => setTypingConversation(isTyping ? conversationId : '');
    const onSocketError = () => notify('Realtime connection is reconnecting…', 'info');

    socket.on('presence:update', onPresence);
    socket.on('message:new', onNewMessage);
    socket.on('message:updated', onUpdatedMessage);
    socket.on('conversation:read', onRead);
    socket.on('typing:update', onTyping);
    socket.on('connect_error', onSocketError);
    socket.connect();

    return () => {
      socket.off('presence:update', onPresence);
      socket.off('message:new', onNewMessage);
      socket.off('message:updated', onUpdatedMessage);
      socket.off('conversation:read', onRead);
      socket.off('typing:update', onTyping);
      socket.off('connect_error', onSocketError);
      socket.disconnect();
    };
  }, [currentUser, loadConversations, loadPeople, notify]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); setHasMore(false); return undefined; }
    const controller = new AbortController();
    setMessagesLoading(true);
    api(`/api/conversations/${selectedId}/messages`, { signal: controller.signal })
      .then(({ messages: data, hasMore: more }) => { setMessages(data); setHasMore(more); socket.emit('conversation:join', { conversationId: selectedId }); return api(`/api/conversations/${selectedId}/read`, { method: 'POST' }); })
      .then(loadConversations)
      .catch((error) => error.name !== 'AbortError' && notify(error.message, 'error'))
      .finally(() => setMessagesLoading(false));
    return () => controller.abort();
  }, [selectedId, loadConversations, notify]);

  const authenticate = async (credentials) => {
    setAuthBusy(true); setAuthError('');
    try {
      const route = credentials.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const user = await api(route, { method: 'POST', body: jsonBody(credentials) });
      setCurrentUser(user);
      return true;
    } catch (error) { setAuthError(error.message); return false; }
    finally { setAuthBusy(false); }
  };

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    socket.disconnect();
    setCurrentUser(null); setConversations([]); setPeople([]); setSelectedId(''); setMessages([]); setOnlineSet(new Set());
  };

  const startChat = async (personId) => {
    try {
      const conversation = await api('/api/conversations', { method: 'POST', body: jsonBody({ userId: personId }) });
      setConversations((current) => current.some((item) => item.id === conversation.id) ? current : [conversation, ...current]);
      setSelectedId(conversation.id); setView('chats'); setSearch('');
    } catch (error) { notify(error.message, 'error'); }
  };

  const sendMessage = async (content) => {
    try {
      const message = await api(`/api/conversations/${selectedId}/messages`, { method: 'POST', body: jsonBody(content) });
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  };

  const reactToMessage = async (messageId, emoji) => {
    try { await api(`/api/conversations/${selectedId}/messages/${messageId}/reaction`, { method: 'POST', body: jsonBody({ emoji }) }); }
    catch (error) { notify(error.message, 'error'); }
  };

  const editMessage = async (messageId, text) => {
    try { await api(`/api/conversations/${selectedId}/messages/${messageId}`, { method: 'PATCH', body: jsonBody({ text }) }); return true; }
    catch (error) { notify(error.message, 'error'); return false; }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Remove this message for everyone?')) return;
    try { await api(`/api/conversations/${selectedId}/messages/${messageId}`, { method: 'DELETE' }); }
    catch (error) { notify(error.message, 'error'); }
  };

  const loadEarlier = async () => {
    if (!messages[0] || messagesLoading) return;
    setMessagesLoading(true);
    try {
      const result = await api(`/api/conversations/${selectedId}/messages?before=${encodeURIComponent(messages[0].createdAt)}`);
      setMessages((current) => [...result.messages, ...current]); setHasMore(result.hasMore);
    } catch (error) { notify(error.message, 'error'); }
    finally { setMessagesLoading(false); }
  };

  const saveProfile = async (profile) => {
    try {
      const user = await api('/api/users/me', { method: 'PATCH', body: jsonBody(profile) });
      setCurrentUser(user); notify('Profile updated.'); return true;
    } catch (error) { notify(error.message, 'error'); return false; }
  };

  if (sessionLoading) return <div className="app-loader"><span className="brand-mark"><span className="loader-pulse" /></span><b>Mango Connect</b><small>Opening your conversations…</small></div>;
  if (!currentUser) return <AuthPage onAuthenticate={authenticate} error={authError} busy={authBusy} />;

  return <div className={`app-shell ${selectedId ? 'has-selection' : ''}`}>
    <Sidebar currentUser={currentUser} conversations={conversations} people={people} selectedId={selectedId} onlineSet={onlineSet} view={view} setView={setView} search={search} setSearch={setSearch} onSelect={setSelectedId} onStartChat={startChat} onProfile={() => setProfileOpen(true)} onLogout={logout} theme={theme} onTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />
    {selectedConversation ? <ChatView conversation={selectedConversation} messages={messages} currentUser={currentUser} online={onlineSet.has(selectedConversation.partner.id)} typing={typingConversation === selectedId} hasMore={hasMore} loading={messagesLoading} onBack={() => setSelectedId('')} onLoadMore={loadEarlier} onSend={sendMessage} onTyping={(isTyping) => socket.emit('typing:set', { conversationId: selectedId, isTyping })} onReact={reactToMessage} onEdit={editMessage} onDelete={deleteMessage} notify={notify} /> : <WelcomePanel currentUser={currentUser} people={people} onlineSet={onlineSet} conversationCount={conversations.length} onStartChat={startChat} onDiscover={() => setView('people')} />}
    {profileOpen && <ProfileModal user={currentUser} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
    {toast && <div className={`toast toast--${toast.type}`}>{toast.type === 'error' ? <XCircle /> : toast.type === 'info' ? <Info /> : <CheckCircle2 />}<span>{toast.message}</span><button onClick={() => setToast(null)}>×</button></div>}
  </div>;
}
