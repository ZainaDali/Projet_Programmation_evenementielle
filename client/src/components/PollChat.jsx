import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare, Trash2 } from 'lucide-react';

const PollChat = ({ pollId }) => {
    const { socket } = useSocket();
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!socket || !pollId) return;

        // Join the poll chat room
        socket.emit('poll:chat:joinRoom', { pollId }, (response) => {
            setLoading(false);
            if (response && response.success) {
                setMessages(response.data);
            }
        });

        // Listen for new messages
        const handleNewMessage = (data) => {
            if (data && data.message && data.message.pollId === pollId) {
                setMessages((prev) => [...prev, data.message]);
            }
        };

        // Listen for deleted messages
        /* 
           Note: The backend emits 'chat:message_deleted' for room chat, 
           but we might not have added a specific event for poll chat deletion yet 
           or we reuse the same if the structure is similar.
           For now, let's assume we might need to add it or it's not fully implemented 
           in the plan, but we can add basic support if the event comes through.
        */
        // socket.on('poll:chat:message_deleted', ...);

        socket.on('poll:chat:new_message', handleNewMessage);

        return () => {
            socket.emit('poll:chat:leaveRoom', { pollId });
            socket.off('poll:chat:new_message', handleNewMessage);
        };
    }, [socket, pollId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        socket.emit('poll:chat:send', { pollId, content: newMessage }, (response) => {
            if (response && response.success) {
                setNewMessage('');
            } else {
                alert('Erreur lors de l\'envoi du message');
            }
        });
    };

    return (
        <div className="flex flex-col h-[400px] border-t border-slate-200 mt-4 pt-4">
            <div className="flex items-center gap-2 mb-3 text-slate-700">
                <MessageSquare className="w-4 h-4" />
                <span className="font-semibold text-sm">Débat en direct</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2 custom-scrollbar">
                {loading ? (
                    <div className="text-center text-slate-400 text-sm py-4">Chargement...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">
                        Soyez le premier à lancer le débat !
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe
                                            ? 'bg-slate-800 text-white rounded-br-none'
                                            : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                        }`}
                                >
                                    <p>{msg.content}</p>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 px-1">
                                    {msg.senderUsername} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Participez au débat..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    maxLength={500}
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
};

export default PollChat;
