/**
 * WebSocket handler for real-time fuel request updates
 */
import { validateSessionToken } from '../services/sessionService.js';

const getSessionTokenFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const item of cookies) {
    const [rawKey, ...rest] = item.trim().split('=');
    if (rawKey === 'JSESSIONID') {
      return rest.join('=') || null;
    }
  }

  return null;
};

export const initializeSocket = (io) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Socket.IO v4+ standard: Use middleware for authentication
  io.use(async (socket, next) => {
    try {
      // Initialize socket.data if it doesn't exist
      if (!socket.data) {
        socket.data = {};
      }

      const cookieHeader = socket.handshake?.headers?.cookie;
      const sessionToken = getSessionTokenFromCookieHeader(cookieHeader);
      const user = await validateSessionToken(sessionToken);

      if (user) {
        socket.data.userId = user.id || null;
        socket.data.administrator = !!user.administrator;
      } else {
        socket.data.userId = null;
        socket.data.administrator = false;
      }

      if (!user && isDev) {
        console.warn(`⚠️ [Socket] No valid session cookie for socket ${socket.id}`);
      }

      // Always allow connection; route-level and room-level checks handle authorization.
      next();
    } catch (error) {
      console.error(`❌ [Socket] Middleware error for ${socket.id}:`, error);
      console.error('Stack:', error.stack);
      // Do not fail the Socket.IO handshake on middleware parsing errors.
      socket.data = socket.data || {};
      socket.data.userId = null;
      socket.data.administrator = false;
      next();
    }
  });

  io.on('connection', (socket) => {
    try {
      // Initialize socket.data safely
      if (!socket.data) {
        socket.data = {};
      }
      
      const userId = socket.data?.userId;
      const isAdministrator = socket.data?.administrator || false;
      
      if (isDev) {
        console.log(`✅ [Socket] Client connected: ${socket.id}`, {
          userId,
          administrator: isAdministrator,
          handshake: {
            auth: socket.handshake.auth,
            headers: Object.keys(socket.handshake.headers),
          }
        });
      }

      // ========== Auto-join rooms with error handling ==========
      try {
        if (isAdministrator) {
          socket.join('managers');
          if (isDev) {
            console.log(`✅ [Socket] ${socket.id} joined managers room`);
          }
        }
        
        if (userId) {
          const driverRoom = `driver-${userId}`;
          socket.join(driverRoom);
          if (isDev) {
            console.log(`✅ [Socket] ${socket.id} joined ${driverRoom}`);
          }
        } else if (isDev) {
          console.warn(`⚠️ [Socket] No userId for socket ${socket.id}, skipping driver room`);
        }
      } catch (joinError) {
        console.error(`❌ [Socket] Error joining rooms for ${socket.id}:`, joinError);
        console.error('Stack:', joinError.stack);
        // Don't disconnect - let connection continue without room membership
      }
      // =========================================================

      // Join appropriate rooms based on user role (manual join requests)
      socket.on('join-room', (roomName, callback) => {
        try {
          if (!roomName || typeof roomName !== 'string') {
            const error = 'Invalid room name';
            if (isDev) {
              console.error(`❌ [Room] Invalid room name from ${socket.id}:`, roomName);
            }
            if (typeof callback === 'function') {
              callback({ success: false, error });
            }
            return;
          }
          
          socket.join(roomName);
          
          // Send acknowledgment if callback provided
          if (typeof callback === 'function') {
            try {
              const adapter = io.sockets.adapter;
              const room = adapter.rooms?.get(roomName);
              const roomSize = room ? room.size : 0;
              const response = { 
                success: true, 
                room: roomName, 
                socketId: socket.id, 
                roomSize 
              };
              callback(response);
            } catch (callbackError) {
              console.error(`❌ [Room] Error sending acknowledgment:`, callbackError);
              callback({ success: false, error: callbackError.message });
            }
          }
          
          // ALWAYS emit fallback event (Socket.IO v4+ compatibility)
          try {
            const adapter = io.sockets.adapter;
            const room = adapter.rooms?.get(roomName);
            const roomSize = room ? room.size : 0;
            socket.emit('room-joined', { 
              success: true, 
              room: roomName, 
              socketId: socket.id, 
              roomSize,
              timestamp: new Date().toISOString()
            });
          } catch (emitError) {
            console.error(`❌ [Room] Error emitting room-joined event:`, emitError);
          }
        } catch (error) {
          console.error(`❌ [Room] Error in join-room handler for ${socket.id}:`, error);
          console.error('Stack:', error.stack);
          if (typeof callback === 'function') {
            callback({ success: false, error: error.message });
          }
        }
      });

      // Error event handler
      socket.on('error', (error) => {
        console.error(`❌ [Socket] Socket error for ${socket.id}:`, error);
      });

      socket.on('disconnect', (reason) => {
        if (isDev) {
          console.log(`🔌 [Socket] Client disconnected: ${socket.id}`, {
            reason,
            userId,
            administrator: isAdministrator
          });
        }
      });
      
    } catch (error) {
      // CRITICAL: Catch any errors in connection handler
      console.error(`❌ [Socket] Connection handler error for ${socket.id}:`, error);
      console.error('Stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        userId: socket.data?.userId,
        administrator: socket.data?.administrator,
      });
      
      // Emit error to client before disconnecting
      try {
        socket.emit('error', { 
          message: 'Connection setup failed',
          type: 'connection_error'
        });
      } catch (emitError) {
        // Ignore emit errors
      }
      
      // Disconnect the socket
      socket.disconnect(true);
    }
  });

  return io;
};

// NOTE: Event emission functions have been moved to fuelRequests/handlers/socketEvents.js
// These functions are kept here for backward compatibility but should use socketEvents.js instead
// The actual implementations with proper logging are in socketEvents.js

export default initializeSocket;


