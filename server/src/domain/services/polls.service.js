import { getCollection } from '../../config/database.js';
import { COLLECTIONS, POLL_STATUS } from '../../config/constants.js';
import { generatePollId, generateVoteId } from '../../utils/ids.js';
import { Errors, createError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const pollsService = {
  async createPoll({ question, options }, creatorId, creatorUsername) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);

    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw Errors.INVALID_POLL_OPTIONS;
    }

    const pollOptions = options.map((text, index) => ({
      id: index,
      text: text.trim(),
      votes: 0,
    }));

    const poll = {
      id: generatePollId(),
      question: question.trim(),
      options: pollOptions,
      status: POLL_STATUS.OPEN,
      creatorId,
      creatorUsername,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalVotes: 0,
    };

    await pollsCollection.insertOne(poll);
    logger.success(`Poll created: ${poll.id} by ${creatorUsername}`);

    return this.formatPoll(poll);
  },

  async getPolls() {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const polls = await pollsCollection.find({}).sort({ createdAt: -1 }).toArray();
    return polls.map(p => this.formatPoll(p));
  },

  async getPollById(pollId) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const poll = await pollsCollection.findOne({ id: pollId });

    if (!poll) {
      throw Errors.POLL_NOT_FOUND;
    }

    return poll;
  },

  async vote({ pollId, optionId }, userId, username) {
    const votesCollection = getCollection(COLLECTIONS.VOTES);
    const pollsCollection = getCollection(COLLECTIONS.POLLS);

    const poll = await this.getPollById(pollId);

    if (poll.status !== POLL_STATUS.OPEN) {
      throw Errors.POLL_CLOSED;
    }

    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      throw Errors.INVALID_OPTION;
    }

    const existingVote = await votesCollection.findOne({ pollId, userId });

    if (existingVote) {
      if (existingVote.optionId === optionId) {
        await votesCollection.deleteOne({ id: existingVote.id });
        await pollsCollection.updateOne(
          { id: pollId, 'options.id': optionId },
          {
            $inc: { 'options.$.votes': -1, totalVotes: -1 },
            $set: { updatedAt: new Date() }
          }
        );
        const updatedPoll = await this.getPollById(pollId);
        logger.info(`Vote cancelled: ${username} unvoted option ${optionId} in poll ${pollId}`);
        return { action: 'unvoted', poll: this.formatPoll(updatedPoll) };
      } else {
        const oldOptionId = existingVote.optionId;
        await votesCollection.updateOne(
          { id: existingVote.id },
          { $set: { optionId, votedAt: new Date() } }
        );
        await pollsCollection.updateOne(
          { id: pollId, 'options.id': oldOptionId },
          { $inc: { 'options.$.votes': -1 } }
        );
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
      id: generateVoteId(),
      pollId,
      userId,
      username,
      optionId,
      votedAt: new Date(),
    };

    await votesCollection.insertOne(vote);

    await pollsCollection.updateOne(
      { id: pollId, 'options.id': optionId },
      {
        $inc: { 'options.$.votes': 1, totalVotes: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`Vote recorded: ${username} voted for option ${optionId} in poll ${pollId}`);
    return { action: 'voted', poll: this.formatPoll(updatedPoll) };
  },

  formatPoll(poll) {
    return {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      status: poll.status,
      creatorId: poll.creatorId,
      creatorUsername: poll.creatorUsername,
      createdAt: poll.createdAt,
      totalVotes: poll.totalVotes,
    };
  },

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
      {
        $set: {
          status: POLL_STATUS.CLOSED,
          closedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    const updatedPoll = await this.getPollById(pollId);
    logger.info(`Poll ${pollId} closed by user ${userId}`);

    return {
      ...this.formatPoll(updatedPoll),
      closedAt: updatedPoll.closedAt,
    };
  },

  async getPollsState(userId) {
    const polls = await this.getPolls();
    const votesCollection = getCollection(COLLECTIONS.VOTES);

    const pollsWithUserVotes = await Promise.all(
      polls.map(async (poll) => {
        const userVote = await votesCollection.findOne({ pollId: poll.id, userId });
        return {
          ...poll,
          userVote: userVote ? userVote.optionId : null,
        };
      })
    );

    return {
      polls: pollsWithUserVotes,
      timestamp: new Date(),
    };
  },
};
