/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const refreshListenersRef = useRef(new Set());

  // Register listener for reconnect / tab focus / polling refreshes
  const registerRefreshListener = useCallback((fn) => {
    refreshListenersRef.current.add(fn);
    return () => {
      refreshListenersRef.current.delete(fn);
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    refreshListenersRef.current.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[SocketContext] Refresh listener error:', err);
      }
    });
  }, []);

  // Initialize socket connection when user is logged in
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Connect to same origin / proxy
    const socket = io({
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Trigger refresh on reconnect
      triggerRefresh();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, triggerRefresh]);

  // Tab focus (visibilitychange) trigger
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerRefresh]);

  // Polling fallback every 10 seconds when socket is down
  useEffect(() => {
    if (isConnected || !user) return;

    const interval = setInterval(() => {
      triggerRefresh();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, user, triggerRefresh]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        registerRefreshListener,
        triggerRefresh,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

SocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
