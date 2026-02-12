import { getCollection } from '../../config/database.js';
import { COLLECTIONS, POLL_STATUS, POLL_ACCESS_TYPES } from '../../config/constants.js';
import { generatePollId, generateVoteId } from '../../utils/ids.js';
import { Errors, createError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { Poll } from '../entities/Poll.js';


export const pollsService = {
  // ========== CREATE ==========
  // ========== CREATE ==========
async createPoll(
  { question, description = '', options, accessType = 'public', allowedUserIds = [] },
  creatorId,
  creatorUsername
) {
  const pollsCollection = getCollection(COLLECTIONS.POLLS);

  // On délègue la validation principale à l'entité
  const poll = new Poll(
    { question, description, options, accessType, allowedUserIds },
    creatorId,
    creatorUsername
  );

  await pollsCollection.insertOne(poll);

  logger.success(
    `Poll created: ${poll.id} by ${creatorUsername} (${poll.accessType})`
  );

  return this.formatPoll(poll);
},

  // ========== READ ==========
  async getPolls() {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const polls = await pollsCollection.find({}).sort({ createdAt: -1 }).toArray();
    return polls.map(p => this.formatPoll(p));
  },

  async getVisiblePolls(userId) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const polls = await pollsCollection.find({
      $and: [
        { kickedUserIds: { $ne: userId } },
        {
          $or: [
            { accessType: POLL_ACCESS_TYPES.PUBLIC },
            { accessType: { $exists: false } },
            { accessType: null },
            { creatorId: userId },
            { accessType: POLL_ACCESS_TYPES.SELECTED, allowedUserIds: userId },
          ],
        },
      ],
    }).sort({ createdAt: -1 }).toArray();
    return polls.map(p => this.formatPoll(p));
  },

  async getPollById(pollId) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await pollsCollection.findOne({ id: pollId });
    if (!poll) throw Errors.POLL_NOT_FOUND;
    return poll;
  },

  canAccessPoll(poll, userId) {
    if (poll.creatorId === userId) return true;
    if (poll.kickedUserIds?.includes(userId)) return false;
    if (!poll.accessType || poll.accessType === POLL_ACCESS_TYPES.PUBLIC) return true;
    if (poll.accessType === POLL_ACCESS_TYPES.PRIVATE) return false;
    if (poll.accessType === POLL_ACCESS_TYPES.SELECTED) {
      return Array.isArray(poll.allowedUserIds) && poll.allowedUserIds.includes(userId);
    }
    return true;
  },

  // ========== PARTICIPANTS (temps réel) ==========
  async joinPoll(pollId, userId, username) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await this.getPollById(pollId);
    if (!this.canAccessPoll(poll, userId)) throw Errors.POLL_ACCESS_DENIED;

    await pollsCollection.updateOne(
      { id: pollId, 'participants.userId': { $ne: userId } },
      { $addToSet: { participants: { userId, username, joinedAt: new Date() } } }
    );
    const updatedPoll = await this.getPollById(pollId);
    return this.formatPoll(updatedPoll);
  },

  async leavePoll(pollId, userId) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    await pollsCollection.updateOne(
      { id: pollId },
      { $pull: { participants: { userId } } }
    );
    const updatedPoll = await this.getPollById(pollId);
    return this.formatPoll(updatedPoll);
  },

  // ========== VOTE ==========
  async vote({ pollId, optionId }, userId, username) {
    const votesCollection = getCollection(COLLECTIONS.VOTES);
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await this.getPollById(pollId);

    if (!this.canAccessPoll(poll, userId)) throw Errors.POLL_ACCESS_DENIED;
    if (poll.status !== POLL_STATUS.OPEN) throw Errors.POLL_CLOSED;

    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) throw Errors.INVALID_OPTION;

    const existingVote = await votesCollection.findOne({ pollId, userId });

    if (existingVote) {
      if (existingVote.optionId === optionId) {
        await votesCollection.deleteOne({ id: existingVote.id });
        await pollsCollection.updateOne(
          { id: pollId, 'options.id': optionId },
          { $inc: { 'options.$.votes': -1, totalVotes: -1 }, $set: { updatedAt: new Date() } }
        );
        const updatedPoll = await this.getPollById(pollId);
        logger.info(`Vote cancelled: ${username} unvoted option ${optionId} in poll ${pollId}`);
        return { action: 'unvoted', poll: this.formatPoll(updatedPoll) };
      } else {
        const oldOptionId = existingVote.optionId;
        await votesCollection.updateOne({ id: existingVote.id }, { $set: { optionId, votedAt: new Date() } });
        await pollsCollection.updateOne({ id: pollId, 'options.id': oldOptionId }, { $inc: { 'options.$.votes': -1 } });
        await pollsCollection.updateOne(
          { id: pollId, 'options.id': optionId },
          { $inc: { 'options.$.votes': 1 }, $set: { updatedAt: new Date() } }
        );
        const updatedPoll = await this.getPollById(pollId);
        logger.info(`Vote changed: ${username} changed from option ${oldOptionId} to ${optionId} in poll ${pollId}`);
        return { action: 'changed', poll: this.formatPoll(updatedPoll) };
      }
    }

    const vote = {
      id: generateVoteId(), pollId, userId, username, optionId, votedAt: new Date(),
    };
    await votesCollection.insertOne(vote);
    await pollsCollection.updateOne(
      { id: pollId, 'options.id': optionId },
      { $inc: { 'options.$.votes': 1, totalVotes: 1 }, $set: { updatedAt: new Date() } }
    );

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`Vote recorded: ${username} voted for option ${optionId} in poll ${pollId}`);
    return { action: 'voted', poll: this.formatPoll(updatedPoll) };
  },

  // ========== EDIT ==========
  async editPoll(pollId, updates, userId, userRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await this.getPollById(pollId);

    if (poll.creatorId !== userId && userRole !== 'admin') throw Errors.NOT_AUTHORIZED;

    const allowedUpdates = {};
    if (updates.question !== undefined) allowedUpdates.question = updates.question.trim();
    if (updates.description !== undefined) allowedUpdates.description = updates.description.trim();
    if (updates.accessType && Object.values(POLL_ACCESS_TYPES).includes(updates.accessType)) {
      allowedUpdates.accessType = updates.accessType;
    }
    if (updates.allowedUserIds) {
      allowedUpdates.allowedUserIds = [...new Set([...updates.allowedUserIds, poll.creatorId])];
    }

    await pollsCollection.updateOne(
      { id: pollId },
      { $set: { ...allowedUpdates, updatedAt: new Date() } }
    );

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`Poll ${pollId} updated by user ${userId}`);
    return this.formatPoll(updatedPoll);
  },

  // ========== DELETE ==========
  async deletePoll(pollId, userId, userRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const votesCollection = getCollection(COLLECTIONS.VOTES);
    const poll = await this.getPollById(pollId);

    if (poll.creatorId !== userId && userRole !== 'admin') throw Errors.NOT_AUTHORIZED;

    await votesCollection.deleteMany({ pollId });
    await pollsCollection.deleteOne({ id: pollId });

    logger.info(`Poll ${pollId} deleted by user ${userId}`);
    return { pollId, question: poll.question };
  },

  // ========== KICK USER ==========
  async kickUser(pollId, targetUserId, requesterId, requesterRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const votesCollection = getCollection(COLLECTIONS.VOTES);
    const poll = await this.getPollById(pollId);

    if (poll.creatorId !== requesterId && requesterRole !== 'admin') throw Errors.NOT_AUTHORIZED;
    if (targetUserId === poll.creatorId) throw createError('Cannot kick the poll creator', 400, 'CANNOT_KICK_CREATOR');

    await pollsCollection.updateOne(
      { id: pollId },
      {
        $addToSet: { kickedUserIds: targetUserId },
        $pull: { participants: { userId: targetUserId }, allowedUserIds: targetUserId },
        $set: { updatedAt: new Date() },
      }
    );

    // Supprimer ses votes
    const existingVote = await votesCollection.findOne({ pollId, userId: targetUserId });
    if (existingVote) {
      await votesCollection.deleteOne({ id: existingVote.id });
      await pollsCollection.updateOne(
        { id: pollId, 'options.id': existingVote.optionId },
        { $inc: { 'options.$.votes': -1, totalVotes: -1 } }
      );
    }

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`User ${targetUserId} kicked from poll ${pollId} by ${requesterId}`);
    return this.formatPoll(updatedPoll);
  },

  // ========== FORMAT ==========
  formatPoll(poll) {
    return {
      id: poll.id,
      question: poll.question,
      description: poll.description || '',
      options: poll.options,
      status: poll.status,
      accessType: poll.accessType || 'public',
      allowedUserIds: poll.allowedUserIds || [],
      participants: poll.participants || [],
      kickedUserIds: poll.kickedUserIds || [],
      creatorId: poll.creatorId,
      creatorUsername: poll.creatorUsername,
      createdAt: poll.createdAt,
      totalVotes: poll.totalVotes,
    };
  },

  // ========== CLOSE ==========
  async closePoll(pollId, userId, userRole) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await this.getPollById(pollId);

    if (poll.creatorId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
      throw Errors.NOT_AUTHORIZED;
    }
    if (poll.status === POLL_STATUS.CLOSED) {
      throw createError('Poll is already closed', 409, 'CONFLICT');
    }

    await pollsCollection.updateOne(
      { id: pollId },
      { $set: { status: POLL_STATUS.CLOSED, closedAt: new Date(), updatedAt: new Date() } }
    );

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`Poll ${pollId} closed by user ${userId}`);
    return { ...this.formatPoll(updatedPoll), closedAt: updatedPoll.closedAt };
  },

  // ========== STATE ==========
  async getPollsState(userId) {
    const polls = await this.getVisiblePolls(userId);
    const votesCollection = getCollection(COLLECTIONS.VOTES);

    const pollsWithUserVotes = await Promise.all(
      polls.map(async (poll) => {
        const userVote = await votesCollection.findOne({ pollId: poll.id, userId });
        return { ...poll, userVote: userVote ? userVote.optionId : null };
      })
    );

    return { polls: pollsWithUserVotes, timestamp: new Date() };
  },
};
