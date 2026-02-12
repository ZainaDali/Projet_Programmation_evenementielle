import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  const context = useContext(SocketContext);
  return context || { socket: null, connected: false };
};

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Cleanup previous socket if any
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }

    if (!token) {
      return;
    }

    console.log('[SocketProvider] Creating socket with token...');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      forceNew: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[SocketProvider] Socket connected!', newSocket.id);
      if (socketRef.current === newSocket) {
        setConnected(true);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[SocketProvider] Socket disconnected:', reason);
      if (socketRef.current === newSocket) {
        setConnected(false);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('[SocketProvider] Socket connect error:', err.message);
      if (socketRef.current === newSocket) {
        setConnected(false);
      }
    });

    return () => {
      console.log('[SocketProvider] Cleanup: closing socket', newSocket.id);
      newSocket.removeAllListeners();
      newSocket.close();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
