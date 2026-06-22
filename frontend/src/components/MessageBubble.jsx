import { CheckCheck, MoreHorizontal, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const REACTIONS = ['❤️', '👍', '😂', '😮', '🎉'];

export default function MessageBubble({ message, currentUserId, onReact, onEdit, onDelete }) {
  const mine = message.sender.id === currentUserId;
  const [actions, setActions] = useState(false);
  const [reactions, setReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text || '');

  const groupedReactions = (message.reactions || []).reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || draft.trim() === message.text) return setEditing(false);
    if (await onEdit(message.id, draft.trim())) setEditing(false);
  };

  return (
    <div className={`message-row ${mine ? 'mine' : 'theirs'}`}>
      <div className={`message-bubble ${message.deletedAt ? 'deleted' : ''}`}>
        {!message.deletedAt && <div className="message-tools">
          <button onClick={() => setReactions((value) => !value)} aria-label="React"><SmilePlus /></button>
          {mine && <button onClick={() => setActions((value) => !value)} aria-label="Message actions"><MoreHorizontal /></button>}
          {reactions && <div className="reaction-picker">{REACTIONS.map((emoji) => <button key={emoji} onClick={() => { onReact(message.id, emoji); setReactions(false); }}>{emoji}</button>)}</div>}
          {actions && <div className="message-menu"><button onClick={() => { setEditing(true); setActions(false); }}><Pencil /> Edit</button><button className="danger" onClick={() => onDelete(message.id)}><Trash2 /> Delete</button></div>}
        </div>}
        {message.deletedAt ? <p className="deleted-copy">This message was removed</p> : <>
          {message.imageUrl && <img className="message-image" src={message.imageUrl} alt="Shared attachment" loading="lazy" />}
          {editing ? <form className="message-edit" onSubmit={submitEdit}><input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus maxLength={4000} /><span><button type="button" onClick={() => setEditing(false)}>Cancel</button><button type="submit">Save</button></span></form> : message.text && <p>{message.text}</p>}
        </>}
        <span className="message-meta"><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.editedAt && <i>edited</i>}{mine && <CheckCheck className={message.readBy?.length > 1 ? 'read' : ''} />}</span>
        {Object.keys(groupedReactions).length > 0 && <div className="reaction-summary">{Object.entries(groupedReactions).map(([emoji, count]) => <button key={emoji} onClick={() => onReact(message.id, emoji)}>{emoji}{count > 1 && <span>{count}</span>}</button>)}</div>}
      </div>
    </div>
  );
}
