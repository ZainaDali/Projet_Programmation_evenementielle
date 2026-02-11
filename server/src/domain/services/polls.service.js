import { getCollection } from '../../config/database.js';
import { COLLECTIONS, POLL_STATUS } from '../../config/constants.js';
import { generatePollId, generateVoteId } from '../../utils/ids.js';
import { Errors, createError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { roomsService } from './rooms.service.js';

export const pollsService = {
  async createPoll({ roomId, question, options }, creatorId, creatorUsername) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw Errors.INVALID_POLL_OPTIONS;
    }
    
    const room = await roomsService.getRoomById(roomId);
    const canAccess = await roomsService.canAccessRoom(roomId, creatorId);
    if (!canAccess) {
      throw Errors.FORBIDDEN;
    }
    
    const pollOptions = options.map((text, index) => ({
      id: index,
      text: text.trim(),
      votes: 0,
    }));
    
    const poll = {
      id: generatePollId(),
      roomId,
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
    logger.success(`Poll created: ${poll.id} in room ${roomId} by ${creatorUsername}`);
    
    return {
      id: poll.id,
      roomId: poll.roomId,
      question: poll.question,
      options: poll.options,
      status: poll.status,
      creatorId: poll.creatorId,
      creatorUsername: poll.creatorUsername,
      createdAt: poll.createdAt,
      totalVotes: poll.totalVotes,
    };
  },
  
  async getRoomPolls(roomId) {
    const pollsCollection = getCollection(COLLECTIONS.POLLS);
    const polls = await pollsCollection.find({ roomId }).sort({ createdAt: -1 }).toArray();
    
    return polls.map(poll => ({
      id: poll.id,
      roomId: poll.roomId,
      question: poll.question,
      options: poll.options,
      status: poll.status,
      creatorId: poll.creatorId,
      creatorUsername: poll.creatorUsername,
      createdAt: poll.createdAt,
      totalVotes: poll.totalVotes,
    }));
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
    
    const existingVote = await votesCollection.findOne({ pollId, userId });
    if (existingVote) {
      throw Errors.ALREADY_VOTED;
    }
    
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      throw Errors.INVALID_OPTION;
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
    
    return {
      id: updatedPoll.id,
      roomId: updatedPoll.roomId,
      question: updatedPoll.question,
      options: updatedPoll.options,
      status: updatedPoll.status,
      creatorId: updatedPoll.creatorId,
      creatorUsername: updatedPoll.creatorUsername,
      createdAt: updatedPoll.createdAt,
      totalVotes: updatedPoll.totalVotes,
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
      id: updatedPoll.id,
      roomId: updatedPoll.roomId,
      question: updatedPoll.question,
      options: updatedPoll.options,
      status: updatedPoll.status,
      creatorId: updatedPoll.creatorId,
      creatorUsername: updatedPoll.creatorUsername,
      createdAt: updatedPoll.createdAt,
      totalVotes: updatedPoll.totalVotes,
      closedAt: updatedPoll.closedAt,
    };
  },
  
  async getUserVote(pollId, userId) {
    const votesCollection = getCollection(COLLECTIONS.VOTES);
    const vote = await votesCollection.findOne({ pollId, userId });
    return vote ? vote.optionId : null;
  },
  
  async getRoomState(roomId, userId) {
    const polls = await this.getRoomPolls(roomId);
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
      roomId,
      polls: pollsWithUserVotes,
      timestamp: new Date(),
    };
  },
};
