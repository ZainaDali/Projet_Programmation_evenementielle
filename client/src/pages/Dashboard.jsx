import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import RoomsList from '../components/RoomsList';
import RoomDetail from '../components/RoomDetail';
import ActivityLog from '../components/ActivityLog';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [currentRoom, setCurrentRoom] = useState(null);
  const [activities, setActivities] = useState([]);
  const [roomsRefreshKey, setRoomsRefreshKey] = useState(0);

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
    socket.on('room:created', (data) => {
      if (data && data.room && data.room.name) {
        addActivity(`Salon "${data.room.name}" créé`, 'system');
        setRoomsRefreshKey(k => k + 1);
      }
    });
    socket.on('room:updated', (data) => {
      if (data && data.room && data.room.name) {
        addActivity(`Salon "${data.room.name}" modifié`, 'system');
        setRoomsRefreshKey(k => k + 1);
        // Mettre à jour la room courante si c'est celle qui a été modifiée
        setCurrentRoom(prev => prev && prev.id === data.room.id ? { ...prev, ...data.room } : prev);
      }
    });
    socket.on('room:deleted', (data) => {
      if (data && data.roomName) {
        addActivity(`Salon "${data.roomName}" supprimé`, 'system');
        if (currentRoom?.id === data.roomId) setCurrentRoom(null);
        setRoomsRefreshKey(k => k + 1);
      }
    });
    socket.on('poll:created', (data) => {
      if (data && data.poll && data.poll.question) addActivity(`Sondage: "${data.poll.question}"`, 'system');
    });
    socket.on('poll:closed', (data) => {
      if (data && data.poll && data.poll.question) addActivity(`Sondage fermé: "${data.poll.question}"`, 'system');
    });
    socket.on('room:userJoined', (data) => {
      if (data && data.username && currentRoom?.id === data.roomId) addActivity(`${data.username} a rejoint`, 'online');
    });
    socket.on('room:userLeft', (data) => {
      if (data && data.username && currentRoom?.id === data.roomId) addActivity(`${data.username} a quitté`, 'offline');
    });
    return () => {
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('room:created');
      socket.off('room:updated');
      socket.off('room:deleted');
      socket.off('poll:created');
      socket.off('poll:closed');
      socket.off('room:userJoined');
      socket.off('room:userLeft');
    };
  }, [socket, currentRoom]);

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
          <main className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {currentRoom ? (
              <RoomDetail
                room={currentRoom}
                onLeave={() => setCurrentRoom(null)}
                onRoomDeleted={() => {
                  setCurrentRoom(null);
                  setRoomsRefreshKey(k => k + 1);
                }}
                onRoomUpdated={(updated) => setCurrentRoom(updated)}
                addActivity={addActivity}
              />
            ) : (
              <RoomsList onRoomSelect={setCurrentRoom} addActivity={addActivity} refreshKey={roomsRefreshKey} />
            )}
          </main>
          <ActivityLog activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
