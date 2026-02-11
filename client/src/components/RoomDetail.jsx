import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { API_URL } from '../config';
import { ArrowLeft, BarChart3, Plus, X, Check, Pencil, Trash2, Home, Globe, Lock, Users } from 'lucide-react';

const RoomDetail = ({ room, onLeave, onRoomDeleted, onRoomUpdated, addActivity }) => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [polls, setPolls] = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccessType, setEditAccessType] = useState('public');
  const [editAllowedUserIds, setEditAllowedUserIds] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [roomMembers, setRoomMembers] = useState([]);

  // Charger les membres autorisés pour les salons "selected"
  const loadRoomMembers = async () => {
    if (room.accessType !== 'selected') {
      setRoomMembers([]);
      return;
    }
    try {
      const [roomRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/rooms/${room.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/rooms/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const roomData = await roomRes.json();
      const usersData = await usersRes.json();
      if (roomData?.success && roomData.data && usersData?.success && usersData.data) {
        const allowedIds = roomData.data.allowedUserIds || [];
        const members = usersData.data.filter(u => allowedIds.includes(u.id));
        setRoomMembers(members);
      }
    } catch (e) {
      console.error('Erreur chargement membres:', e);
    }
  };

  useEffect(() => {
    loadRoomMembers();
  }, [room.id, room.accessType, room.allowedUserIds]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('room:join', { roomId: room.id }, (response) => {
      if (response && response.success && response.data && response.data.polls) {
        setPolls(response.data.polls);
      }
    });
    socket.on('poll:created', (data) => {
      if (data && data.poll && data.poll.roomId === room.id) loadPolls();
    });
    socket.on('poll:results', (data) => {
      if (data && data.poll && data.poll.roomId === room.id) updatePoll(data.poll);
    });
    socket.on('poll:closed', (data) => {
      if (data && data.poll && data.poll.roomId === room.id) updatePoll(data.poll);
    });
    // Écouter les mises à jour du salon en temps réel
    const handleRoomUpdated = (data) => {
      if (data && data.room && data.room.id === room.id) {
        onRoomUpdated && onRoomUpdated(data.room);
        // Recharger les membres si c'est un salon sélectionné
        if (data.room.accessType === 'selected') {
          loadRoomMembers();
        } else {
          setRoomMembers([]);
        }
      }
    };
    socket.on('room:updated', handleRoomUpdated);
    return () => {
      socket.off('poll:created');
      socket.off('poll:results');
      socket.off('poll:closed');
      socket.off('room:updated', handleRoomUpdated);
    };
  }, [socket, room]);

  const loadPolls = () => {
    if (!socket) return;
    socket.emit('poll:getState', { roomId: room.id }, (response) => {
      if (response && response.success && response.data && response.data.polls) {
        setPolls(response.data.polls);
      }
    });
  };

  const updatePoll = (updatedPoll) => {
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? { ...updatedPoll, userVote: p.userVote } : p));
  };

  const updatePollWithUserVote = (updatedPoll, newUserVote) => {
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? { ...updatedPoll, userVote: newUserVote } : p));
  };

  const handleCreatePoll = () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (!question) { alert('Entrez une question'); return; }
    if (options.length < 2) { alert('Au moins 2 options'); return; }
    if (options.length > 6) { alert('Maximum 6 options'); return; }
    if (!socket) { alert('Socket non connecté'); return; }
    socket.emit('poll:create', { roomId: room.id, question, options }, (response) => {
      if (response && response.success) {
        setShowCreatePoll(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        addActivity(`Sondage créé: "${question}"`, 'system');
      } else {
        alert(response && response.error ? response.error.message : 'Erreur');
      }
    });
  };

  const handleVote = (pollId, optionId) => {
    if (!socket) return;
    socket.emit('poll:vote', { pollId, optionId }, (response) => {
      if (response && response.success && response.data) {
        const { action, userVote, ...pollData } = response.data;
        updatePollWithUserVote(pollData, userVote);
      } else if (response && !response.success) {
        alert(response.error ? response.error.message : 'Erreur lors du vote');
      }
    });
  };

  const handleClosePoll = (pollId) => {
    if (!confirm('Fermer ce sondage ?')) return;
    if (!socket) return;
    socket.emit('poll:close', { pollId }, (response) => {
      if (response && !response.success) alert(response.error ? response.error.message : 'Erreur');
    });
  };

  const handleLeave = () => {
    if (socket) socket.emit('room:leave', { roomId: room.id });
    onLeave();
  };

  const addOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, '']);
  };

  const canManageRoom = room.creatorId === user?.id || user?.role === 'admin';

  const openEditRoom = async () => {
    try {
      const [roomRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/rooms/${room.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/rooms/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const roomData = await roomRes.json();
      const usersData = await usersRes.json();
      if (roomData?.success && roomData.data) {
        const fullRoom = roomData.data;
        setEditName(fullRoom.name);
        setEditDescription(fullRoom.description || '');
        setEditAccessType(fullRoom.accessType || 'public');
        setEditAllowedUserIds(fullRoom.allowedUserIds || []);
      }
      if (usersData?.success && usersData.data) setAllUsers(usersData.data);
    } catch (e) {}
    setShowEditRoom(true);
  };

  const handleUpdateRoom = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          accessType: editAccessType,
          allowedUserIds: editAccessType === 'selected' ? editAllowedUserIds : undefined,
        }),
      });
      const data = await res.json();
      if (data?.success && data.data) {
        onRoomUpdated && onRoomUpdated(data.data);
        addActivity(`Salon "${editName}" modifié`, 'system');
        setShowEditRoom(false);
        // Recharger les membres après modification
        loadRoomMembers();
      } else {
        alert(data?.error?.message || 'Erreur');
      }
    } catch (err) {
      alert('Erreur de connexion');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Supprimer ce salon ? Cette action est irréversible.')) return;
    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.success) {
        addActivity(`Salon "${room.name}" supprimé`, 'system');
        onRoomDeleted && onRoomDeleted();
      } else {
        alert(data?.error?.message || 'Erreur');
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 p-5 flex items-center gap-4">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-slate-800">{room.name}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600">
            {room.accessType === 'private' ? 'Privé' : room.accessType === 'selected' ? 'Sélectionné' : 'Public'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canManageRoom && (
            <>
              <button
                onClick={openEditRoom}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
                title="Modifier le salon"
              >
                <Pencil className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={handleDeleteRoom}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-700 text-sm font-medium transition-colors"
                title="Supprimer le salon"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowCreatePoll(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau sondage
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Affichage des membres autorisés pour les salons "Sélectionné" */}
        {room.accessType === 'selected' && (
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-slate-600" />
              <h4 className="font-semibold text-slate-800">Membres autorisés</h4>
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                {roomMembers.length}
              </span>
            </div>
            {roomMembers.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun membre sélectionné</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roomMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      member.status === 'online' ? 'bg-green-500' : 'bg-slate-300'
                    }`} />
                    <span className="text-slate-700">{member.username}</span>
                    {member.id === room.creatorId && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Créateur</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-slate-600" />
          <h4 className="font-semibold text-slate-800">Sondages</h4>
        </div>
        {polls.length === 0 ? (
          <p className="text-slate-500 text-center py-10">Aucun sondage</p>
        ) : (
          <div className="space-y-4">
            {polls.map(poll => {
              const total = poll.totalVotes || 0;
              const userVoted = poll.userVote !== null && poll.userVote !== undefined;
              const isClosed = poll.status === 'closed';
              const canClose = (poll.creatorId === user?.id || user?.role === 'admin' || user?.role === 'moderator') && !isClosed;

              return (
                <div key={poll.id} className={`bg-slate-50 border border-slate-200 rounded-xl p-5 ${isClosed ? 'opacity-75' : ''}`}>
                  <div className="font-semibold text-slate-800 mb-1">{poll.question}</div>
                  <div className="text-sm text-slate-500 mb-4">
                    Par {poll.creatorUsername} - {new Date(poll.createdAt).toLocaleDateString('fr-FR')}
                    {isClosed && <span className="ml-2 font-medium text-slate-600">Fermé</span>}
                  </div>
                  <div className="space-y-3 mb-3">
                    {poll.options.map(option => {
                      const votes = option.votes || 0;
                      const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
                      const isUserChoice = poll.userVote === option.id;
                      const canClick = !isClosed;
                      return (
                        <div
                          key={option.id}
                          onClick={() => canClick && handleVote(poll.id, option.id)}
                          className={`bg-white border-2 rounded-lg p-4 transition-all ${
                            isUserChoice ? 'border-slate-800 bg-slate-50 cursor-pointer hover:border-red-300 hover:bg-red-50' :
                            canClick ? 'border-slate-200 hover:border-slate-400 cursor-pointer' :
                            'border-slate-200'
                          }`}
                          title={isUserChoice ? 'Cliquez pour annuler votre vote' : canClick ? 'Cliquez pour voter' : ''}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1 flex items-center gap-2">
                              {isUserChoice && <Check className="w-4 h-4 text-slate-700" />}
                              <span>{option.text}</span>
                              {isUserChoice && <span className="text-xs text-slate-400 ml-1">(cliquez pour annuler)</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-700 rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                              </div>
                              <span className="text-sm text-slate-600 w-14 text-right">{percent}% ({votes})</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-sm text-slate-500 text-right mb-3">
                    Total: {total} vote{total > 1 ? 's' : ''}
                    {userVoted && !isClosed && ' - Vous avez voté (modifiable)'}
                    {userVoted && isClosed && ' - Vous avez voté'}
                  </div>
                  {canClose && (
                    <button
                      onClick={() => handleClosePoll(poll.id)}
                      className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Fermer le sondage
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreatePoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreatePoll(false)}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-800 mb-6">Créer un sondage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Question</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Quelle est votre question ?"
                  maxLength="200"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Options</label>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[index] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${index + 1}`}
                      maxLength="100"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  ))}
                </div>
                {pollOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-2 w-full border-2 border-dashed border-slate-300 hover:border-slate-500 text-slate-600 py-2 rounded-lg text-sm transition-colors"
                  >
                    Ajouter une option
                  </button>
                )}
                <p className="text-xs text-slate-500 mt-2">2 à 6 options</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCreatePoll}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreatePoll(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditRoom(false)}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6">
              <Home className="w-5 h-5 text-slate-600" />
              <h3 className="text-xl font-semibold text-slate-800">Modifier le salon</h3>
            </div>
            <form onSubmit={handleUpdateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={50}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type d'accès</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="editAccessType" value="public" checked={editAccessType === 'public'} onChange={(e) => setEditAccessType(e.target.value)} className="text-slate-800" />
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Public</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="editAccessType" value="private" checked={editAccessType === 'private'} onChange={(e) => setEditAccessType(e.target.value)} className="text-slate-800" />
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Privé</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="editAccessType" value="selected" checked={editAccessType === 'selected'} onChange={(e) => setEditAccessType(e.target.value)} className="text-slate-800" />
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Sélectionné</span>
                  </label>
                </div>
              </div>
              {editAccessType === 'selected' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Utilisateurs autorisés</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {allUsers.filter(u => u.id !== user?.id).map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAllowedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setEditAllowedUserIds([...editAllowedUserIds, u.id]);
                            else setEditAllowedUserIds(editAllowedUserIds.filter(id => id !== u.id));
                          }}
                          className="text-slate-800"
                        />
                        <span className="text-sm text-slate-700">{u.username}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editLoading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                  {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button type="button" onClick={() => setShowEditRoom(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-medium transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomDetail;
