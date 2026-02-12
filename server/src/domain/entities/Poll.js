import { generatePollId } from '../../utils/ids.js';
import { POLL_STATUS, POLL_ACCESS_TYPES } from '../../config/constants.js';

export class Poll {
  constructor({ question, description = '', options, accessType = 'public', allowedUserIds = [] }, creatorId, creatorUsername) {

    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw new Error('Invalid poll options');
    }

    if (!Object.values(POLL_ACCESS_TYPES).includes(accessType)) {
      throw new Error('Invalid access type');
    }

    this.id = generatePollId();
    this.question = question.trim();
    this.description = description.trim();
    this.options = options.map((text, index) => ({
      id: index,
      text: text.trim(),
      votes: 0,
    }));

    this.status = POLL_STATUS.OPEN;
    this.accessType = accessType;

    this.allowedUserIds =
      accessType === POLL_ACCESS_TYPES.SELECTED
        ? [...new Set([...allowedUserIds, creatorId])]
        : [];

    this.participants = [];
    this.kickedUserIds = [];

    this.creatorId = creatorId;
    this.creatorUsername = creatorUsername;

    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.totalVotes = 0;
  }
}

