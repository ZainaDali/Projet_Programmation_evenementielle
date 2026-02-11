import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Users, Circle } from 'lucide-react';

const Sidebar = () => {
  const { socket } = useSocket();
  const [users, setUsers] = useState([]);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const loadUsers = () => {
    if (!socket || !socket.connected) return;
    socket.emit('presence:getAllUsers');
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('presence:allUsersResponse', (response) => {
      if (response && response.success && response.data) {
        setUsers(response.data);
      }
    });
    socket.on('user:online', loadUsers);
    socket.on('user:offline', loadUsers);
    loadUsers();
    return () => {
      socket.off('presence:allUsersResponse');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket]);

  const onlineUsers = users.filter(u => u.status === 'online');
  const offlineUsers = users.filter(u => u.status === 'offline');

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return 'jamais';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <aside className="w-72 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center gap-2">
        <Users className="w-5 h-5 text-slate-600" />
        <span className="font-semibold text-slate-800">Utilisateurs</span>
      </div>

      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase">En ligne</span>
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
              {onlineUsers.length}
            </span>
          </div>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucun</p>
          ) : (
            <div className="space-y-1.5">
              {onlineUsers.map(user => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50"
                >
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {user.username}
                      {user.userId === currentUser.id && (
                        <span className="text-slate-500 ml-1">(vous)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">En ligne</p>
                  </div>
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase">Hors ligne</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {offlineUsers.length}
            </span>
          </div>
          {offlineUsers.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Aucun</p>
          ) : (
            <div className="space-y-1.5">
              {offlineUsers.map(user => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-2 rounded-lg"
                >
                  <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{user.username}</p>
                    <p className="text-xs text-slate-500">Vu {formatLastSeen(user.lastSeenAt)}</p>
                  </div>
                  <Circle className="w-2 h-2 fill-slate-300 text-slate-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
