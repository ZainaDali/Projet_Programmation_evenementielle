import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import './Modal.css';

const CreatePollModal = ({ roomId, onClose, onCreated }) => {
  const { socket } = useSocket();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validOptions = options.filter(opt => opt.trim().length > 0);
    
    if (!question.trim()) {
      alert('Veuillez entrer une question');
      return;
    }
    
    if (validOptions.length < 2) {
      alert('Veuillez entrer au moins 2 options');
      return;
    }
    
    if (validOptions.length > 6) {
      alert('Maximum 6 options autorisées');
      return;
    }

    socket.emit('poll:create', {
      roomId,
      question: question.trim(),
      options: validOptions
    }, (response) => {
      if (response.success) {
        onCreated();
      } else {
        alert(response.error.message || 'Erreur lors de la création du sondage');
      }
    });
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Créer un sondage</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Question du sondage</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Quelle est votre question ?"
              maxLength="200"
              required
            />
          </div>

          <div className="form-group">
            <label>Options de réponse</label>
            <div className="poll-options-container">
              {options.map((option, index) => (
                <div key={index} className="poll-option-input-group">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength="100"
                    className="poll-option-input"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="btn-remove-option"
                      onClick={() => handleRemoveOption(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {options.length < 6 && (
              <button
                type="button"
                className="btn-add-option"
                onClick={handleAddOption}
              >
                + Ajouter une option
              </button>
            )}
            
            <p className="form-hint">Minimum 2 options, maximum 6</p>
          </div>

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              Créer le sondage
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePollModal;
