import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Send, Trash2, User } from 'lucide-react';

const ChatView = ({ pollId, pollQuestion, addActivity }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const [error, setError] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = useCallback(async () => {
    try {
      if (!pollId || !token) return;
      const data = await api.getChatHistory(token, pollId);
      // Only update if messages count changed to avoid jumpy UI, or deep compare if needed.
      // For simplicity here we just set it.
      setMessages(data);
    } catch (err) {
      console.error('Error loading chat:', err);
      // setError('Erreur chat'); // Avoid flashing error on every poll fail
    } finally {
      setLoading(false);
    }
  }, [pollId, token]);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 3000); // 3s polling
    return () => clearInterval(interval);
  }, [loadHistory]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages.length, loading]);


  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content) return;

    try {
      setNewMessage(''); // Optimistic clear
      await api.sendMessage(token, pollId, content);
      loadHistory(); // Refresh immediately
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      await api.deleteMessage(token, messageId);
      loadHistory();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Chargement du chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-inner">
      <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-lg flex justify-between items-center">
        <h3 className="font-medium text-slate-700 text-sm">Chat du sondage</h3>
        <span className="text-xs text-slate-400">Actualisation auto (3s)</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm">
            Aucun message. Lancez la discussion !
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.id;
            const isAdmin = user?.role === 'admin';
            const canDelete = isMe || isAdmin;

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'} rounded-lg px-4 py-2 relative group`}>
                  {/* Header info */}
                  <div className={`text-xs mb-1 flex items-center gap-2 ${isMe ? 'text-slate-300' : 'text-slate-500'}`}>
                    {!isMe && (
                      <span className="font-bold flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {msg.username}
                      </span>
                    )}
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className={`absolute -top-2 -right-2 p-1 rounded-full bg-white shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500`}
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-slate-50 rounded-b-lg flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Votre message..."
          className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-800"
          maxLength={500}
        />
        <button
          type="submit"
          className="p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
          disabled={!newMessage.trim()}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatView;