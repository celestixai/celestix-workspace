import { Server, Socket } from 'socket.io';

export function setupMeetingsHandlers(io: Server, socket: Socket, userId: string) {
  socket.on('meeting:join', (data: { meetingCode: string; displayName: string }) => {
    socket.join(`meeting:${data.meetingCode}`);
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:user-joined', {
      userId,
      displayName: data.displayName,
      socketId: socket.id,
    });
  });

  socket.on('meeting:leave', (data: { meetingCode: string }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:user-left', { userId, socketId: socket.id });
    socket.leave(`meeting:${data.meetingCode}`);
  });

  // WebRTC signaling
  socket.on('meeting:offer', (data: { to: string; offer: unknown; meetingCode: string }) => {
    io.to(data.to).emit('meeting:offer', { from: socket.id, offer: data.offer, userId });
  });

  socket.on('meeting:answer', (data: { to: string; answer: unknown; meetingCode: string }) => {
    io.to(data.to).emit('meeting:answer', { from: socket.id, answer: data.answer, userId });
  });

  socket.on('meeting:ice-candidate', (data: { to: string; candidate: unknown; meetingCode: string }) => {
    io.to(data.to).emit('meeting:ice-candidate', { from: socket.id, candidate: data.candidate, userId });
  });

  // Media controls
  socket.on('meeting:toggle-audio', (data: { meetingCode: string; enabled: boolean }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:toggle-audio', { userId, enabled: data.enabled });
  });

  socket.on('meeting:toggle-video', (data: { meetingCode: string; enabled: boolean }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:toggle-video', { userId, enabled: data.enabled });
  });

  socket.on('meeting:screen-share', (data: { meetingCode: string; sharing: boolean }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:screen-share', { userId, sharing: data.sharing });
  });

  // Hand raise
  socket.on('meeting:raise-hand', (data: { meetingCode: string; raised: boolean }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:raise-hand', { userId, raised: data.raised });
  });

  // Reactions
  socket.on('meeting:reaction', (data: { meetingCode: string; emoji: string }) => {
    io.in(`meeting:${data.meetingCode}`).emit('meeting:reaction', { userId, emoji: data.emoji });
  });

  // Chat
  socket.on('meeting:chat', (data: { meetingCode: string; message: string; displayName: string }) => {
    io.in(`meeting:${data.meetingCode}`).emit('meeting:chat', {
      userId,
      displayName: data.displayName,
      message: data.message,
      timestamp: new Date().toISOString(),
    });
  });

  // Host controls
  socket.on('meeting:mute-all', (data: { meetingCode: string }) => {
    socket.to(`meeting:${data.meetingCode}`).emit('meeting:mute-all', { by: userId });
  });

  socket.on('meeting:kick', (data: { meetingCode: string; targetUserId: string }) => {
    io.in(`meeting:${data.meetingCode}`).emit('meeting:kicked', { userId: data.targetUserId, by: userId });
  });

  socket.on('meeting:lock', (data: { meetingCode: string; locked: boolean }) => {
    io.in(`meeting:${data.meetingCode}`).emit('meeting:lock', { locked: data.locked, by: userId });
  });

  // Get participants in meeting room
  socket.on('meeting:get-participants', async (data: { meetingCode: string }, callback: (participants: string[]) => void) => {
    const room = io.sockets.adapter.rooms.get(`meeting:${data.meetingCode}`);
    const socketIds = room ? Array.from(room) : [];
    if (typeof callback === 'function') callback(socketIds);
  });
}
