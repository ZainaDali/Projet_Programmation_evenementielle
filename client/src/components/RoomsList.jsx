import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import CreateRoomModal from './CreateRoomModal';
import { Home, Plus, BarChart3, ArrowRight, Lock, Users, Globe } from 'lucide-react';

const RoomsList = ({ onRoomSelect, addActivity, refreshKey = 0 }) => {
  const { user, token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result && result.success && result.data) {
        setRooms(result.data);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [refreshKey]);

  const handleRoomCreated = () => {
    loadRooms();
    setShowCreateModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-slate-800 mx-auto mb-4"></div>
          <p className="text-slate-500">Chargement des salons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Home className="w-6 h-6 text-slate-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Salons</h2>
            <p className="text-sm text-slate-500">Rejoignez un salon pour commencer</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer un salon
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Home className="w-12 h-12 mb-4 text-slate-300" />
            <p className="font-medium">Aucun salon</p>
            <p className="text-sm">Un admin peut en créer un</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {rooms.map(room => (
              <div
                key={room.id}
                onClick={() => onRoomSelect(room)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Home className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{room.name}</h3>
                  <p className="text-sm text-slate-500 truncate">
                    {room.description || `Créé par ${room.creatorUsername}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {room.pollsCount || 0} sondage(s)
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                      room.accessType === 'private'
                        ? 'bg-slate-100 text-slate-600'
                        : room.accessType === 'selected'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {room.accessType === 'private' ? <Lock className="w-3.5 h-3.5" /> : room.accessType === 'selected' ? <Users className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      {room.accessType === 'private' ? 'Privé' : room.accessType === 'selected' ? 'Sélectionné' : 'Public'}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRoomCreated}
        />
      )}
    </div>
  );
};

export default RoomsList;
