import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { MessageSquare, Send, Trash2, AlertCircle, X } from 'lucide-react';

const MAX_LENGTH = 500;

const ChatView = ({ roomId, roomName, addActivity }) => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!socket || !connected || !roomId) return;

    setLoading(true);
    setMessages([]);
    setError(null);

    socket.emit('chat:joinRoom', { roomId }, (response) => {
      setLoading(false);
      if (response && response.success) {
        setMessages(response.data || []);
      } else {
        const code = response?.error?.code || 'INTERNAL_ERROR';
        const msg = response?.error?.message || 'Impossible de charger le chat';
        setError({ code, message: msg });
      }
    });

    return () => {
      socket.emit('chat:leaveRoom', { roomId });
    };
  }, [socket, connected, roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      if (data?.message?.roomId !== roomId) return;
      setMessages(prev => [...prev, data.message]);
    };

    const handleMessageDeleted = (data) => {
      if (data?.roomId !== roomId) return;
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, deleted: true, content: '[Message supprimé]' }
            : m
        )
      );
    };

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:message_deleted', handleMessageDeleted);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:message_deleted', handleMessageDeleted);
    };
  }, [socket, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content || !socket || !connected || sending) return;

    if (content.length > MAX_LENGTH) {
      setError({ code: 'MESSAGE_TOO_LARGE', message: `Le message dépasse ${MAX_LENGTH} caractères` });
      return;
    }

    setSending(true);
    setError(null);

    socket.emit('chat:send', { roomId, content }, (response) => {
      setSending(false);
      if (response && response.success) {
        setInputValue('');
        inputRef.current?.focus();
        if (addActivity) addActivity(`Message dans "${roomName}"`, 'system');
      } else {
        const code = response?.error?.code || 'INTERNAL_ERROR';
        const msg = response?.error?.message || "Erreur lors de l'envoi";
        setError({ code, message: msg });
      }
    });
  };

  const handleDelete = (messageId) => {
    if (!socket || !window.confirm('Supprimer ce message ?')) return;

    socket.emit('chat:delete', { messageId }, (response) => {
      if (response && !response.success) {
        setError({
          code: response?.error?.code || 'INTERNAL_ERROR',
          message: response?.error?.message || 'Erreur lors de la suppression',
        });
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const canDelete = (msg) =>
    !msg.deleted &&
    (msg.senderId === user?.id || user?.role === 'admin' || user?.role === 'moderator');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
        <MessageSquare className="w-5 h-5 text-slate-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {roomName || 'Chat'}
          </h2>
          <p className="text-xs text-slate-500">Chat du salon</p>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">{error.code}</span> — {error.message}
          </span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Chargement des messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Aucun message. Soyez le premier !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                    isOwn ? 'bg-slate-700' : 'bg-slate-400'
                  }`}
                >
                  {msg.senderUsername.charAt(0).toUpperCase()}
                </div>

                <div className={`max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isOwn && (
                    <span className="text-xs text-slate-500 mb-1 ml-1">
                      {msg.senderUsername}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm relative ${
                      msg.deleted
                        ? 'bg-slate-100 text-slate-400 italic border border-slate-200'
                        : isOwn
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {msg.content}

                    {canDelete(msg) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className={`absolute -top-2 ${isOwn ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-full p-1 shadow-sm hover:bg-red-50 hover:border-red-200`}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>
                  <span className={`text-xs text-slate-400 mt-1 ${isOwn ? 'text-right' : 'text-left'} ml-1`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-slate-200">
        {!connected && (
          <p className="text-xs text-amber-600 text-center mb-2">
            Déconnecté — reconnexion en cours…
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrire un message… (Entrée pour envoyer, Shift+Entrée pour saut de ligne)"
              maxLength={MAX_LENGTH}
              rows={1}
              disabled={!connected || loading}
              className="w-full px-4 py-2.5 pr-14 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent text-sm disabled:bg-slate-50 disabled:text-slate-400"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <span
              className={`absolute bottom-2.5 right-3 text-xs ${
                inputValue.length > MAX_LENGTH * 0.9 ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {inputValue.length}/{MAX_LENGTH}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={!connected || !inputValue.trim() || sending || loading}
            className="w-11 h-11 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white rounded-xl transition-colors flex-shrink-0"
            title="Envoyer"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;