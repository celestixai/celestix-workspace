import { Server, Socket } from 'socket.io';

export function setupNotificationsHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('notification:read', (data: { notificationId: string }) => {
    // Just acknowledge — actual DB update happens via REST API
    socket.emit('notification:read-ack', { notificationId: data.notificationId });
  });
}

// Utility: send notification to a user via socket
export function sendSocketNotification(io: Server, userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit('notification:new', notification);
}
