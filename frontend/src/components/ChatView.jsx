import { ArrowLeft, ChevronUp, FileImage, Info, Laugh, MoreHorizontal, Paperclip, Search, SendHorizontal, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import MessageBubble from './MessageBubble.jsx';

const MAX_IMAGE = 350 * 1024;
const QUICK_EMOJIS = ['😊', '👋', '✨', '🙌', '🔥', '💛', '🎉', '😂'];

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const presenceCopy = (partner, online) => {
  if (online) return 'Active now';
  if (!partner.lastSeen) return 'Offline';
  return `Last seen ${new Date(partner.lastSeen).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
};

export default function ChatView({ conversation, messages, currentUser, online, typing, hasMore, loading, onBack, onLoadMore, onSend, onTyping, onReact, onEdit, onDelete, notify }) {
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const historyRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);

  const visibleMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages;
    const query = messageSearch.toLowerCase();
    return messages.filter((message) => message.text?.toLowerCase().includes(query));
  }, [messages, messageSearch]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, conversation.id]);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const changeDraft = (value) => {
    setDraft(value);
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 1200);
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > MAX_IMAGE) return notify('Choose a PNG, JPEG, WebP, or GIF under 350 KB.', 'error');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending || (!draft.trim() && !image)) return;
    setSending(true);
    onTyping(false);
    let imageUrl = '';
    if (image) imageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(image);
    }).catch(() => '');
    const sent = await onSend({ text: draft.trim(), imageUrl });
    if (sent) { setDraft(''); clearImage(); setEmojiOpen(false); }
    setSending(false);
  };

  return (
    <main className="chat-view">
      <header className="chat-header">
        <button className="icon-button mobile-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft /></button>
        <Avatar user={conversation.partner} online={online} />
        <div className="chat-header__identity"><b>{conversation.partner.displayName}</b><span className={online ? 'online-copy' : ''}>{typing ? 'typing…' : presenceCopy(conversation.partner, online)}</span></div>
        <div className="chat-header__actions">
          <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={() => setSearchOpen((value) => !value)} aria-label="Search messages"><Search /></button>
          <button className={`icon-button ${infoOpen ? 'active' : ''}`} onClick={() => setInfoOpen((value) => !value)} aria-label="Conversation details"><Info /></button>
          <button className="icon-button" onClick={() => notify('More conversation controls are coming soon.', 'info')} aria-label="More options"><MoreHorizontal /></button>
        </div>
      </header>

      {searchOpen && <div className="message-search"><Search /><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search in this conversation" autoFocus /><span>{visibleMessages.length} found</span><button onClick={() => { setSearchOpen(false); setMessageSearch(''); }}><X /></button></div>}

      <div className={`chat-stage ${infoOpen ? 'with-info' : ''}`}>
        <section className="messages-pane">
          <div className="message-history" ref={historyRef}>
            {hasMore && <button className="load-more" onClick={onLoadMore} disabled={loading}><ChevronUp />{loading ? 'Loading…' : 'Earlier messages'}</button>}
            {!visibleMessages.length && !loading && <div className="conversation-begin"><Avatar user={conversation.partner} size="xl" online={online} /><h2>Say hello to {conversation.partner.displayName}</h2><p>This is the beginning of your private conversation.</p><span><ShieldCheck /> Only you two can see these messages</span></div>}
            {visibleMessages.map((message, index) => {
              const showDate = index === 0 || dayLabel(visibleMessages[index - 1].createdAt) !== dayLabel(message.createdAt);
              return <div key={message.id}>{showDate && <div className="date-divider"><span>{dayLabel(message.createdAt)}</span></div>}<MessageBubble message={message} currentUserId={currentUser.id} onReact={onReact} onEdit={onEdit} onDelete={onDelete} /></div>;
            })}
            {typing && <div className="typing-bubble"><i /><i /><i /></div>}
          </div>

          <div className="composer-wrap">
            {imagePreview && <div className="composer-attachment"><img src={imagePreview} alt="Attachment preview" /><span><b>{image.name}</b><small>{Math.round(image.size / 1024)} KB</small></span><button onClick={clearImage} aria-label="Remove attachment"><X /></button></div>}
            {emojiOpen && <div className="emoji-tray">{QUICK_EMOJIS.map((emoji) => <button key={emoji} onClick={() => changeDraft(draft + emoji)}>{emoji}</button>)}</div>}
            <form className="composer" onSubmit={submit}>
              <button type="button" className="composer-icon" onClick={() => setEmojiOpen((value) => !value)} aria-label="Add emoji"><Laugh /></button>
              <button type="button" className="composer-icon" onClick={() => fileRef.current?.click()} aria-label="Attach image"><Paperclip /></button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseImage} hidden />
              <textarea value={draft} onChange={(event) => changeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} placeholder={`Message ${conversation.partner.displayName}`} maxLength={4000} rows={1} />
              <button className="send-button" type="submit" disabled={sending || (!draft.trim() && !image)} aria-label="Send message">{sending ? <span className="button-loader" /> : <SendHorizontal />}</button>
            </form>
            <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
          </div>
        </section>

        {infoOpen && <aside className="conversation-info">
          <button className="info-close" onClick={() => setInfoOpen(false)}><X /></button>
          <Avatar user={conversation.partner} size="xl" online={online} />
          <h3>{conversation.partner.displayName}</h3><span>@{conversation.partner.username}</span><p>{conversation.partner.bio}</p>
          <div className="info-status"><i className={online ? 'online' : ''} /><span><b>{online ? 'Online now' : 'Currently offline'}</b><small>{presenceCopy(conversation.partner, online)}</small></span></div>
          <div className="info-media"><header><b>Shared media</b><span>{messages.filter((item) => item.imageUrl).length}</span></header><div>{messages.filter((item) => item.imageUrl).slice(-6).map((item) => <img key={item.id} src={item.imageUrl} alt="Shared" />)}{!messages.some((item) => item.imageUrl) && <span className="no-media"><FileImage /> No images shared yet</span>}</div></div>
          <div className="secure-note"><ShieldCheck /><span><b>Private conversation</b><small>Access is limited to participants.</small></span></div>
        </aside>}
      </div>
    </main>
  );
}
