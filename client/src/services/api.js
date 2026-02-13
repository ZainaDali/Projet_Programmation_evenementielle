import { API_URL } from '../config';

const getHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const handleResponse = async (response) => {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Une erreur est survenue');
    }
    return data.data;
};

export const api = {

    getPollsState: async (token) => {
        const response = await fetch(`${API_URL}/api/polls`, {
            method: 'GET',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    createPoll: async (token, payload) => {
        const response = await fetch(`${API_URL}/api/polls`, {
            method: 'POST',
            headers: getHeaders(token),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    getPoll: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}`, {
            method: 'GET',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    vote: async (token, pollId, optionId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}/vote`, {
            method: 'POST',
            headers: getHeaders(token),
            body: JSON.stringify({ optionId }),
        });
        return handleResponse(response);
    },

    closePoll: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}/close`, {
            method: 'POST',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    deletePoll: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}`, {
            method: 'DELETE',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    kickUser: async (token, pollId, targetUserId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}/kick`, {
            method: 'POST',
            headers: getHeaders(token),
            body: JSON.stringify({ targetUserId }),
        });
        return handleResponse(response);
    },

    joinPoll: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}/join`, {
            method: 'POST',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    leavePoll: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/polls/${pollId}/leave`, {
            method: 'POST',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },


    // Chat
    getChatHistory: async (token, pollId) => {
        const response = await fetch(`${API_URL}/api/chat/${pollId}`, {
            method: 'GET',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },

    sendMessage: async (token, pollId, content) => {
        const response = await fetch(`${API_URL}/api/chat/${pollId}`, {
            method: 'POST',
            headers: getHeaders(token),
            body: JSON.stringify({ content }),
        });
        return handleResponse(response);
    },

    deleteMessage: async (token, messageId) => {
        const response = await fetch(`${API_URL}/api/chat/message/${messageId}`, {
            method: 'DELETE',
            headers: getHeaders(token),
        });
        return handleResponse(response);
    },
};
