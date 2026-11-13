import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Determine backend origin: explicit VITE_WS_URL, or derived from VITE_API_URL, or fallback to current origin / localhost
    let serverUrl = import.meta.env.VITE_WS_URL;
    if (!serverUrl && import.meta.env.VITE_API_URL) {
      try {
        const u = new URL(import.meta.env.VITE_API_URL);
        serverUrl = u.origin;
      } catch {}
    }
    if (!serverUrl) {
      serverUrl = isHttps || !isLocalhost ? window.location.origin : `http://${window.location.hostname}:5000`;
    }

    socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: (cb) => {
        const token = localStorage.getItem('token');
        cb({ token });
      },
    });

    socketInstance.on('connect', () => {
      console.log('⚡ [Socket.IO Realtime] Đã kết nối thành công:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚡ [Socket.IO Realtime] Ngắt kết nối:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('⚡ [Socket.IO Realtime] Lỗi kết nối:', err.message);
    });
  }

  if (socketInstance && !socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}

export function refreshSocketAuth() {
  if (socketInstance) {
    const token = localStorage.getItem('token');
    socketInstance.auth = { token };
    if (token) {
      if (socketInstance.connected) {
        socketInstance.disconnect().connect();
      } else {
        socketInstance.connect();
      }
    } else if (socketInstance.connected) {
      socketInstance.disconnect();
    }
  }
}

