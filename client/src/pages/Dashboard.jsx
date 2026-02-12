import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PollsView from '../components/PollsView';
import ActivityLog from '../components/ActivityLog';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [activities, setActivities] = useState([]);

  const addActivity = (message, type = 'system') => {
    setActivities(prev => [{ id: Date.now(), message, type, time: new Date().toLocaleTimeString('fr-FR') }, ...prev].slice(0, 50));
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

  return (
    <div className="min-h-screen bg-slate-100">
      <Header connected={connected} user={user} />
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-6">
          <Sidebar />
          <main className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <PollsView addActivity={addActivity} />
          </main>
          <ActivityLog activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
