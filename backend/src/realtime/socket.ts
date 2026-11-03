import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin: any, callback: any) => callback(null, true),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication & Room Management Middleware
  io.use((socket: Socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (rawToken) {
        try {
          const decoded: any = jwt.verify(rawToken, ENV.JWT_SECRET);
          socket.data.user = decoded;
        } catch (jwtErr) {
          console.warn('[Socket.IO] Token verification failed for socket:', socket.id);
        }
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    if (user) {
      const userId = user.id;
      const userType = String(user.type || user.role || '').toUpperCase();

      // Generic user room
      socket.join(`user:${userId}`);

      if (userType === 'CUSTOMER') {
        socket.join(`customer:${userId}`);
      } else if (userType === 'STAFF') {
        socket.join('staff');
        socket.join(`staff:${userId}`);
      } else if (userType === 'ADMIN') {
        socket.join('admin');
        socket.join('staff');
        socket.join(`admin:${userId}`);
        socket.join(`staff:${userId}`);
      }
    }

    // Join specific event room (for live scanner feed or attendee report)
    socket.on('join:event', (eventId: number | string) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on('leave:event', (eventId: number | string) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO chưa được khởi tạo. Hãy gọi initSocketServer trước.');
  }
  return io;
}

// ==========================================
// REALTIME EVENT EMITTERS ACROSS SERVICES
// ==========================================

export const Realtime = {
  // 1. Scan result emitted when QR is checked in
  emitScanRecorded(data: {
    eventId: number;
    eventName: string;
    ticketId: number;
    code: string;
    customerId: number;
    customerName: string;
    customerPhone?: string;
    referrerId: number;
    referrerName?: string;
    staffId: number;
    staffName: string;
    result: string;
    usedAt: string;
  }) {
    if (!io) return;

    // To Event room
    io.to(`event:${data.eventId}`).emit('scan:recorded', data);

    // To Admin room
    io.to('admin').emit('scan:recorded', data);

    // To Customer (updates active QR status instantly to USED)
    if (data.customerId) {
      io.to(`customer:${data.customerId}`).to(`user:${data.customerId}`).emit('ticket:status_changed', {
        ticketId: data.ticketId,
        code: data.code,
        status: 'USED',
        usedAt: data.usedAt,
        eventId: data.eventId,
        eventName: data.eventName,
      });
    }

    // To Referrer (updates attendee status in staff referral dashboard)
    if (data.referrerId) {
      io.to(`staff:${data.referrerId}`).to(`user:${data.referrerId}`).emit('referral:scanned', data);
    }
  },

  // 2. New registration created
  emitRegistrationNew(data: {
    registrationId: number;
    eventId: number;
    eventName: string;
    customerId: number;
    fullName: string;
    phone: string;
    email: string;
    referrerId: number;
    referrerName?: string;
    status: string;
    createdAt: string;
  }) {
    if (!io) return;

    if (data.referrerId) {
      io.to(`staff:${data.referrerId}`).to(`user:${data.referrerId}`).emit('registration:new', data);
    }
    io.to('admin').emit('registration:new', data);
    io.to(`event:${data.eventId}`).emit('registration:new', data);
  },

  // 3. Registration approved & ticket issued
  emitRegistrationApproved(data: {
    registrationId: number;
    eventId: number;
    eventName: string;
    customerId: number;
    referrerId: number;
    status: string;
    ticket?: any;
  }) {
    if (!io) return;

    // Send newly generated ticket to Customer's wallet
    if (data.ticket && data.customerId) {
      io.to(`customer:${data.customerId}`).to(`user:${data.customerId}`).emit('ticket:issued', {
        ...data.ticket,
        event_id: data.eventId,
        event_name: data.eventName,
      });
    }

    if (data.referrerId) {
      io.to(`staff:${data.referrerId}`).to(`user:${data.referrerId}`).emit('registration:updated', data);
    }
    io.to('admin').emit('registration:updated', data);
    io.to(`event:${data.eventId}`).emit('attendee:approved', data);
  },

  // 4. Quota updated for staff
  emitQuotaUpdated(data: {
    eventId: number;
    staffId: number;
    maxInvites: number;
  }) {
    if (!io) return;

    io.to(`staff:${data.staffId}`).emit('quota:updated', data);
    io.to('admin').emit('quota:updated', data);
  },

  // 5. Dispute created or resolved
  emitDisputeUpdated(data: {
    disputeId: number;
    ticketId?: number;
    status: string;
    action: string;
  }) {
    if (!io) return;

    io.to('admin').emit('dispute:updated', data);
    io.to('staff').emit('dispute:updated', data);
  },

  // 6. Global dashboard statistics & events refresh
  emitDashboardRefresh() {
    if (!io) return;
    io.to('admin').emit('dashboard:refresh');
    io.to('staff').emit('dashboard:refresh');
  },
};
