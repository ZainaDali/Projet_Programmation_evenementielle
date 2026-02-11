import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Home, Globe, Lock, Users, Circle } from 'lucide-react';

const CreateRoomModal = ({ onClose, onCreated }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState('public');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/rooms/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result && result.success && result.data) setAllUsers(result.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      alert('Le nom du salon doit faire au moins 3 caractères');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          accessType,
          allowedUserIds: accessType === 'selected' ? selectedUsers : []
        })
      });
      const result = await response.json();
      if (result && result.success) {
        onCreated();
      } else {
        alert(result && result.error ? result.error.message : 'Erreur lors de la création');
      }
    } catch (error) {
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const otherUsers = allUsers.filter(u => u.id !== currentUser.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-6">
          <Home className="w-6 h-6 text-slate-600" />
          <h3 className="text-xl font-semibold text-slate-800">Créer un salon</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nom du salon</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du salon"
              maxLength="50"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description (optionnel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              maxLength="200"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type d'accès</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="accessType" value="public" checked={accessType === 'public'} onChange={(e) => setAccessType(e.target.value)} className="text-slate-800" />
                <Globe className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">Public</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="accessType" value="private" checked={accessType === 'private'} onChange={(e) => setAccessType(e.target.value)} className="text-slate-800" />
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">Privé</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="accessType" value="selected" checked={accessType === 'selected'} onChange={(e) => setAccessType(e.target.value)} className="text-slate-800" />
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-700">Sélectionné</span>
              </label>
            </div>
          </div>
          {accessType === 'selected' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Utilisateurs autorisés</label>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {otherUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun autre utilisateur</p>
                ) : (
                  <div className="space-y-2">
                    {otherUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          value={u.id}
                          checked={selectedUsers.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                            else setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                          }}
                          className="text-slate-800"
                        />
                        <Circle className={`w-2 h-2 ${u.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-slate-300 text-slate-300'}`} />
                        <span className="text-sm text-slate-700">{u.username}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {loading ? 'Création...' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-medium transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
