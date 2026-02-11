import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PollsView from '../components/PollsView';
import ChatView from '../components/ChatView';
import ActivityLog from '../components/ActivityLog';
import { BarChart3, MessageSquare, ChevronDown } from 'lucide-react';
import { API_URL } from '../config';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [activities, setActivities] = useState([]);

  // Navigation par onglets : 'polls' | 'chat'
  const [activeTab, setActiveTab] = useState('polls');

  // Salons disponibles pour le chat
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const addActivity = (message, type = 'system') => {
    setActivities(prev => [{ id: Date.now(), message, type, time: new Date().toLocaleTimeString('fr-FR') }, ...prev].slice(0, 50));
  };

  // Charger la liste des salons via HTTP
  const loadRooms = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setRoomsLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRooms(data.data);
        // Sélectionner le premier salon par défaut si aucun n'est sélectionné
        if (!selectedRoom && data.data.length > 0) {
          setSelectedRoom(data.data[0]);
        }
      }
    } catch {
      // Silencieux — les salons seront rechargés lors du prochain changement d'onglet
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('user:online', (data) => {
      if (data && data.username) addActivity(`${data.username} est en ligne`, 'online');
    });
    socket.on('user:offline', (data) => {
      if (data && data.username) addActivity(`${data.username} est hors ligne`, 'offline');
    });
    socket.on('poll:created', (data) => {
      if (data && data.poll && data.poll.question) addActivity(`Sondage: "${data.poll.question}"`, 'system');
    });
    socket.on('poll:closed', (data) => {
      if (data && data.poll && data.poll.question) addActivity(`Sondage fermé: "${data.poll.question}"`, 'system');
    });
    socket.on('chat:new_message', (data) => {
      if (data?.message?.senderUsername && data?.message?.senderUsername !== user?.username) {
        addActivity(`Message de ${data.message.senderUsername}`, 'system');
      }
    });
    socket.on('poll:updated', (data) => {
      if (data?.poll?.question) addActivity(`Sondage modifié: "${data.poll.question}" par ${data.updatedBy}`, 'system');
    });
    socket.on('poll:deleted', (data) => {
      if (data?.question) addActivity(`Sondage supprimé: "${data.question}" par ${data.deletedBy}`, 'system');
    });
    return () => {
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('poll:created');
      socket.off('poll:closed');
      socket.off('chat:new_message');
      socket.off('poll:updated');
      socket.off('poll:deleted');
    };
  }, [socket, user]);

  useEffect(() => {
    if (connected) addActivity('Connecté au serveur', 'online');
    else addActivity('Déconnecté', 'offline');
  }, [connected]);

  // Charger les salons quand on passe sur l'onglet chat
  useEffect(() => {
    if (activeTab === 'chat' && connected) {
      loadRooms();
    }
  }, [activeTab, connected]);

  return (
    <div className="min-h-screen bg-slate-100">
      <Header connected={connected} user={user} />
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-6">
          <Sidebar />
          <main className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">

            {/* Onglets */}
            <div className="flex border-b border-slate-200 px-4 pt-2 gap-1">
              <button
                onClick={() => setActiveTab('polls')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  activeTab === 'polls'
                    ? 'border-slate-800 text-slate-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Sondages
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  activeTab === 'chat'
                    ? 'border-slate-800 text-slate-800 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'polls' && (
                <PollsView addActivity={addActivity} />
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col h-full">
                  {/* Sélecteur de salon */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    {roomsLoading ? (
                      <p className="text-sm text-slate-400">Chargement des salons…</p>
                    ) : rooms.length === 0 ? (
                      <p className="text-sm text-slate-400">Aucun salon disponible.</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Salon :</span>
                        <div className="relative">
                          <select
                            value={selectedRoom?.id || ''}
                            onChange={(e) => {
                              const room = rooms.find(r => r.id === e.target.value);
                              setSelectedRoom(room || null);
                            }}
                            className="appearance-none pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-700 cursor-pointer"
                          >
                            {rooms.map(room => (
                              <option key={room.id} value={room.id}>
                                {room.name}
                                {room.accessType === 'private' ? ' (privé)' : room.accessType === 'selected' ? ' (sélectif)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vue chat */}
                  <div className="flex-1 overflow-hidden">
                    {selectedRoom ? (
                      <ChatView
                        key={selectedRoom.id}
                        roomId={selectedRoom.id}
                        roomName={selectedRoom.name}
                        addActivity={addActivity}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Sélectionnez un salon pour commencer à chatter
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
          <ActivityLog activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
