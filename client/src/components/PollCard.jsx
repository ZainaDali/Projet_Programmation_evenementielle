import './PollCard.css';

const PollCard = ({ poll, onVote, onClose, canClose }) => {
  const total = poll.totalVotes || 0;
  const isClosed = poll.status === 'closed';
  const userVoted = poll.userVote !== null && poll.userVote !== undefined;

  return (
    <div className={`poll-card ${isClosed ? 'closed' : ''}`}>
      <div className="poll-question">{poll.question}</div>
      <div className="poll-meta">
        Par {poll.creatorUsername} - {new Date(poll.createdAt).toLocaleDateString('fr-FR')}
        {isClosed && <strong> - FERMÉ</strong>}
      </div>
      
      <div className="poll-options-list">
        {poll.options.map(option => {
          const votes = option.votes || 0;
          const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
          const isUserChoice = poll.userVote === option.id;
          
          return (
            <div
              key={option.id}
              className={`poll-option ${isUserChoice ? 'voted' : ''}`}
              onClick={() => {
                if (!isClosed && !userVoted) {
                  onVote(poll.id, option.id);
                }
              }}
              style={{ cursor: !isClosed && !userVoted ? 'pointer' : 'default' }}
            >
              <div className="poll-option-text">{option.text}</div>
              <div className="poll-option-stats">
                <div className="poll-option-bar">
                  <div 
                    className="poll-option-bar-fill" 
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="poll-option-percent">{percent}% ({votes})</div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="poll-total">
        Total: {total} vote{total > 1 ? 's' : ''}
        {userVoted && ' - Vous avez voté'}
      </div>
      
      {canClose && (
        <div className="poll-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => onClose(poll.id)}
          >
            Fermer le sondage
          </button>
        </div>
      )}
    </div>
  );
};

export default PollCard;
