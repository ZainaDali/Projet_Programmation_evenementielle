import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { BarChart3, Plus, X, Check, Edit3, Trash2, UserMinus, Users, Globe, Lock, UserCheck, Eye, MessageSquare } from 'lucide-react';
import ChatView from './ChatView';

const ACCESS_LABELS = { public: 'Public', private: 'Privé', selected: 'Personnalisé' };
const ACCESS_ICONS = { public: Globe, private: Lock, selected: UserCheck };
const ACCESS_COLORS = { public: 'bg-green-100 text-green-700', private: 'bg-red-100 text-red-700', selected: 'bg-blue-100 text-blue-700' };

const PollsView = ({ addActivity }) => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  // Create modal state
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAccessType, setPollAccessType] = useState('public');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Edit modal state
  const [editingPoll, setEditingPoll] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccessType, setEditAccessType] = useState('public');
  const [editAllowedUserIds, setEditAllowedUserIds] = useState([]);

  // Participants panel
  const [showParticipants, setShowParticipants] = useState(null);

  const [openChatPollId, setOpenChatPollId] = useState(null);

  // ========== LOAD ==========
  const loadPolls = () => {
    if (!socket || !socket.connected) return;
    setLoading(true);
    socket.emit('poll:getState', {}, (response) => {
      setLoading(false);
      if (response?.success && response.data?.polls) {
        setPolls(response.data.polls);
      } else {
        setPolls([]);
      }
    });
  };

  const loadUsers = () => {
    if (!socket || !socket.connected) return;
    socket.emit('presence:getAllUsers');
  };

  // ========== SOCKET LISTENERS ==========
  useEffect(() => {
    if (!socket) return;

    socket.on('poll:created', () => loadPolls());
    socket.on('poll:results', (data) => { if (data?.poll) updatePoll(data.poll); });
    socket.on('poll:closed', (data) => { if (data?.poll) updatePoll(data.poll); });
    socket.on('poll:updated', (data) => { if (data?.poll) updatePoll(data.poll); loadPolls(); });
    socket.on('poll:deleted', (data) => {
      if (data?.pollId) {
        setPolls(prev => prev.filter(p => p.id !== data.pollId));
        addActivity(`Sondage supprimé: "${data.question}"`, 'system');
      }
    });
    socket.on('poll:kicked', (data) => {
      if (data?.pollId) {
        setPolls(prev => prev.filter(p => p.id !== data.pollId));
        addActivity(`Vous avez été retiré du sondage "${data.question}" par ${data.kickedBy}`, 'offline');
      }
    });
    socket.on('poll:participantJoined', (data) => {
      if (data?.pollId) {
        setPolls(prev => prev.map(p => p.id === data.pollId ? { ...p, participants: data.participants } : p));
      }
    });
    socket.on('poll:participantLeft', (data) => {
      if (data?.pollId) {
        setPolls(prev => prev.map(p => p.id === data.pollId ? { ...p, participants: data.participants } : p));
      }
    });
    socket.on('presence:allUsersResponse', (response) => {
      if (response?.success && response.data) setAllUsers(response.data);
    });

    return () => {
      socket.off('poll:created');
      socket.off('poll:results');
      socket.off('poll:closed');
      socket.off('poll:updated');
      socket.off('poll:deleted');
      socket.off('poll:kicked');
      socket.off('poll:participantJoined');
      socket.off('poll:participantLeft');
      socket.off('presence:allUsersResponse');
    };
  }, [socket]);

  useEffect(() => {
    if (socket && connected) { loadPolls(); loadUsers(); }
    else if (!connected) setLoading(true);
  }, [socket, connected]);

  // ========== HELPERS ==========
  const updatePoll = (updatedPoll) => {
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? { ...updatedPoll, userVote: p.userVote } : p));
  };

  const updatePollWithUserVote = (updatedPoll, newUserVote) => {
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? { ...updatedPoll, userVote: newUserVote } : p));
  };

  const resetCreateForm = () => {
    setPollQuestion(''); setPollDescription(''); setPollOptions(['', '']);
    setPollAccessType('public'); setSelectedUserIds([]);
  };

  // ========== ACTIONS ==========
  const handleCreatePoll = () => {
    const question = pollQuestion.trim();
    const description = pollDescription.trim();
    const options = pollOptions.map(o => o.trim()).filter(o => o.length > 0);
    if (!question) { alert('Entrez une question'); return; }
    if (options.length < 2) { alert('Au moins 2 options'); return; }
    if (options.length > 6) { alert('Maximum 6 options'); return; }
    if (pollAccessType === 'selected' && selectedUserIds.length === 0) { alert('Sélectionnez au moins un utilisateur'); return; }
    if (!socket) { alert('Socket non connecté'); return; }

    socket.emit('poll:create', {
      question, description, options,
      accessType: pollAccessType,
      allowedUserIds: pollAccessType === 'selected' ? selectedUserIds : [],
    }, (response) => {
      if (response?.success) {
        setShowCreatePoll(false);
        resetCreateForm();
        addActivity(`Sondage créé: "${question}"`, 'system');
      } else {
        alert(response?.error?.message || 'Erreur');
      }
    });
  };

  const handleVote = (pollId, optionId) => {
    if (!socket) return;
    socket.emit('poll:vote', { pollId, optionId }, (response) => {
      if (response?.success && response.data) {
        const { action, userVote, ...pollData } = response.data;
        updatePollWithUserVote(pollData, userVote);
      } else if (response && !response.success) {
        alert(response.error?.message || 'Erreur lors du vote');
      }
    });
  };

  const handleClosePoll = (pollId) => {
    if (!confirm('Fermer ce sondage ?')) return;
    if (!socket) return;
    socket.emit('poll:close', { pollId }, (response) => {
      if (response && !response.success) alert(response.error?.message || 'Erreur');
    });
  };

  const handleDeletePoll = (pollId) => {
    if (!confirm('Supprimer définitivement ce sondage et tous ses votes ?')) return;
    if (!socket) return;
    socket.emit('poll:delete', { pollId }, (response) => {
      if (response && !response.success) alert(response.error?.message || 'Erreur');
    });
  };

  const openEditModal = (poll) => {
    setEditingPoll(poll);
    setEditQuestion(poll.question);
    setEditDescription(poll.description || '');
    setEditAccessType(poll.accessType || 'public');
    setEditAllowedUserIds(poll.allowedUserIds || []);
    loadUsers();
  };

  const handleEditPoll = () => {
    if (!editingPoll || !socket) return;
    const updates = {
      question: editQuestion.trim(),
      description: editDescription.trim(),
      accessType: editAccessType,
      allowedUserIds: editAccessType === 'selected' ? editAllowedUserIds : [],
    };
    if (!updates.question) { alert('Entrez une question'); return; }
    if (editAccessType === 'selected' && editAllowedUserIds.length === 0) { alert('Sélectionnez au moins un utilisateur'); return; }

    socket.emit('poll:edit', { pollId: editingPoll.id, updates }, (response) => {
      if (response?.success) {
        setEditingPoll(null);
        addActivity(`Sondage modifié: "${updates.question}"`, 'system');
      } else {
        alert(response?.error?.message || 'Erreur');
      }
    });
  };

  const handleKickUser = (pollId, targetUserId, targetUsername) => {
    if (!confirm(`Retirer ${targetUsername} de ce sondage ?`)) return;
    if (!socket) return;
    socket.emit('poll:kickUser', { pollId, targetUserId }, (response) => {
      if (response?.success) {
        addActivity(`${targetUsername} retiré du sondage`, 'system');
      } else {
        alert(response?.error?.message || 'Erreur');
      }
    });
  };

  const handleJoinPoll = (pollId) => {
    if (!socket) return;
    socket.emit('poll:join', { pollId });
  };

  const addOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, '']);
  };

  const toggleUserSelection = (uid, list, setList) => {
    if (list.includes(uid)) setList(list.filter(id => id !== uid));
    else setList([...list, uid]);
  };

  const otherUsers = allUsers.filter(u => u.userId !== user?.id);

  // ========== USER PICKER COMPONENT ==========
  const UserPicker = ({ selected, onChange }) => (
    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
      {otherUsers.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">Aucun autre utilisateur</p>
      ) : otherUsers.map(u => (
        <label key={u.userId} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(u.userId)}
            onChange={() => toggleUserSelection(u.userId, selected, onChange)}
            className="rounded border-slate-300"
          />
          <span className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {u.username.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm text-slate-700">{u.username}</span>
          <span className={`ml-auto w-2 h-2 rounded-full ${u.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
        </label>
      ))}
    </div>
  );

  // ========== ACCESS TYPE SELECTOR ==========
  const AccessTypeSelector = ({ value, onChange }) => (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(ACCESS_LABELS).map(([key, label]) => {
        const Icon = ACCESS_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm ${
              value === key ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );

  // ========== RENDER ==========
  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-slate-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Sondages</h2>
            <p className="text-sm text-slate-500">Créez un sondage et consultez les résultats en temps réel</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => { setShowCreatePoll(true); loadUsers(); }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau sondage
          </button>
        )}
      </div>

      {/* Polls List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-slate-700 mb-3" />
            <p className="text-slate-500">Chargement des sondages…</p>
          </div>
        ) : polls.length === 0 ? (
          <p className="text-slate-500 text-center py-10">Aucun sondage. Un admin peut en créer un.</p>
        ) : (
          <div className="space-y-4">
            {polls.map(poll => {
              const total = poll.totalVotes || 0;
              const userVoted = poll.userVote !== null && poll.userVote !== undefined;
              const isClosed = poll.status === 'closed';
              const isOwner = poll.creatorId === user?.id;
              const isAdminUser = user?.role === 'admin';
              const canManage = isOwner || isAdminUser;
              const canClose = canManage && !isClosed;
              const accessType = poll.accessType || 'public';
              const AccessIcon = ACCESS_ICONS[accessType] || Globe;
              const participants = poll.participants || [];

              return (
                <div key={poll.id} className={`bg-slate-50 border border-slate-200 rounded-xl p-5 ${isClosed ? 'opacity-75' : ''}`}>
                  {/* Poll header */}
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800 text-lg">{poll.question}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ACCESS_COLORS[accessType]}`}>
                          <AccessIcon className="w-3 h-3" />
                          {ACCESS_LABELS[accessType]}
                        </span>
                      </div>
                      {poll.description && (
                        <p className="text-sm text-slate-600 mb-2">{poll.description}</p>
                      )}
                      <div className="text-sm text-slate-500">
                        Par {poll.creatorUsername} — {new Date(poll.createdAt).toLocaleDateString('fr-FR')}
                        {isClosed && <span className="ml-2 font-medium text-slate-600">• Fermé</span>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1 ml-4">
                        {!isClosed && (
                          <button onClick={() => openEditModal(poll)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors" title="Modifier">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDeletePoll(poll.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Participants bar */}
                  {participants.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 mb-4">
                    <button
                      onClick={() => { handleJoinPoll(poll.id); setShowParticipants(showParticipants === poll.id ? null : poll.id); }}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{participants.length} participant{participants.length > 1 ? 's' : ''}</span>
                    </button>
                    {/* Participant avatars */}
                    <div className="flex -space-x-2">
                      {participants.slice(0, 5).map(p => (
                        <span key={p.userId} className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium border-2 border-white" title={p.username}>
                          {p.username.charAt(0).toUpperCase()}
                        </span>
                      ))}
                      {participants.length > 5 && (
                        <span className="w-6 h-6 bg-slate-400 rounded-full flex items-center justify-center text-white text-[10px] font-medium border-2 border-white">
                          +{participants.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Expanded participants list */}
                  {showParticipants === poll.id && participants.length > 0 && (
                    <div className="mb-4 bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Participants en temps réel</span>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {participants.map(p => (
                          <div key={p.userId} className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                                {p.username.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-sm text-slate-700">{p.username}</span>
                              {p.userId === user?.id && <span className="text-xs text-slate-400">(vous)</span>}
                            </div>
                            {canManage && p.userId !== user?.id && p.userId !== poll.creatorId && (
                              <button
                                onClick={() => handleKickUser(poll.id, p.userId, p.username)}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                title={`Retirer ${p.username}`}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                Retirer
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Options */}
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

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      Total: {total} vote{total > 1 ? 's' : ''}
                      {userVoted && !isClosed && ' — Vous avez voté (modifiable)'}
                      {userVoted && isClosed && ' — Vous avez voté'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setOpenChatPollId(openChatPollId === poll.id ? null : poll.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          openChatPollId === poll.id
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Chat
                      </button>
                      {canClose && (
                        <button
                          onClick={() => handleClosePoll(poll.id)}
                          className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Fermer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chat panel */}
                  {openChatPollId === poll.id && (
                    <div className="mt-4 border-t border-slate-200 pt-4" style={{ height: '400px' }}>
                      <ChatView
                        key={poll.id}
                        pollId={poll.id}
                        pollQuestion={poll.question}
                        addActivity={addActivity}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== CREATE MODAL ========== */}
      {showCreatePoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreatePoll(false)}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-800 mb-6">Créer un sondage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Question</label>
                <input
                  type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Quelle est votre question ?" maxLength="200"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description <span className="text-slate-400">(optionnel)</span></label>
                <textarea
                  value={pollDescription} onChange={(e) => setPollDescription(e.target.value)}
                  placeholder="Décrivez votre sondage..." maxLength="500" rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type d'accès</label>
                <AccessTypeSelector value={pollAccessType} onChange={setPollAccessType} />
                {pollAccessType === 'private' && (
                  <p className="text-xs text-slate-500 mt-2">Seul vous pourrez voir ce sondage</p>
                )}
              </div>
              {pollAccessType === 'selected' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Utilisateurs autorisés ({selectedUserIds.length} sélectionné{selectedUserIds.length > 1 ? 's' : ''})
                  </label>
                  <UserPicker selected={selectedUserIds} onChange={setSelectedUserIds} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Options de réponse</label>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text" value={option}
                        onChange={(e) => {
                          const next = [...pollOptions]; next[index] = e.target.value; setPollOptions(next);
                        }}
                        placeholder={`Option ${index + 1}`} maxLength="100"
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                      {pollOptions.length > 2 && (
                        <button type="button" onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                          className="px-2 text-slate-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 6 && (
                  <button type="button" onClick={addOption}
                    className="mt-2 w-full border-2 border-dashed border-slate-300 hover:border-slate-500 text-slate-600 py-2 rounded-lg text-sm transition-colors">
                    Ajouter une option
                  </button>
                )}
                <p className="text-xs text-slate-500 mt-2">2 à 6 options</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCreatePoll}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium transition-colors">
                  Créer
                </button>
                <button type="button" onClick={() => { setShowCreatePoll(false); resetCreateForm(); }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-medium transition-colors">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== EDIT MODAL ========== */}
      {editingPoll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingPoll(null)}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-800 mb-6">Modifier le sondage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Question</label>
                <input
                  type="text" value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)}
                  maxLength="200"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  maxLength="500" rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type d'accès</label>
                <AccessTypeSelector value={editAccessType} onChange={setEditAccessType} />
              </div>
              {editAccessType === 'selected' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Utilisateurs autorisés ({editAllowedUserIds.length} sélectionné{editAllowedUserIds.length > 1 ? 's' : ''})
                  </label>
                  <UserPicker selected={editAllowedUserIds} onChange={setEditAllowedUserIds} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleEditPoll}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium transition-colors">
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditingPoll(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-medium transition-colors">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollsView;
