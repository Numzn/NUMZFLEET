/**
 * WebSocket handler for real-time fuel request updates
 */
import { validateSessionToken } from '../services/sessionService.js';
import { roleFlagsFromTraccar } from '../services/userService.js';
import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';
import { roomsForSocket } from './rooms.js';

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
        socket.data.isManager = roleFlagsFromTraccar(user).isManager;
        // Company is resolved server-side from the authenticated identity, so
        // room membership can be company-scoped (rooms.js). Fails closed: a
        // context that cannot be resolved yields no company and therefore no
        // manager room, rather than falling back to a shared one.
        try {
          const context = await resolveCompanyContextForTraccarUser(user);
          socket.data.companyId = context?.activeContext?.companyId ?? null;
          socket.data.isPlatform = context?.activeContext?.type === 'platform';
        } catch (contextError) {
          console.error(`❌ [Socket] Could not resolve company for socket ${socket.id}:`, contextError?.message || contextError);
          socket.data.companyId = null;
          socket.data.isPlatform = false;
        }
      } else if (isDev && socket.handshake?.auth?.userId != null) {
        const authUserId = Number(socket.handshake.auth.userId);
        socket.data.userId = Number.isFinite(authUserId) ? authUserId : null;
        socket.data.administrator = !!socket.handshake.auth.administrator;
        socket.data.isManager = roleFlagsFromTraccar({
          administrator: socket.handshake.auth.administrator,
          attributes: socket.handshake.auth.attributes,
          isManager: socket.handshake.auth.isManager,
        }).isManager;
        // Dev bypass only, and the company is still resolved server-side from
        // the claimed user id — the handshake never supplies a company itself.
        // Same trust boundary DEV_AUTH_BYPASS already grants on the HTTP side.
        //
        // Only resolve for a usable id: resolveCompanyContextForTraccarUser
        // answers a null id with the DEFAULT_COMPANY_ID fallback, which would
        // hand an unidentifiable socket a real company.
        socket.data.companyId = null;
        socket.data.isPlatform = false;
        if (Number.isFinite(socket.data.userId)) {
          try {
            const context = await resolveCompanyContextForTraccarUser({ id: socket.data.userId });
            socket.data.companyId = context?.activeContext?.companyId ?? null;
            socket.data.isPlatform = context?.activeContext?.type === 'platform';
          } catch {
            socket.data.companyId = null;
            socket.data.isPlatform = false;
          }
        }
      } else {
        socket.data.userId = null;
        socket.data.administrator = false;
        socket.data.isManager = false;
        socket.data.companyId = null;
        socket.data.isPlatform = false;
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
      socket.data.isManager = false;
      socket.data.companyId = null;
      socket.data.isPlatform = false;
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
      const isManager = socket.data?.isManager || false;

      if (isDev) {
        console.log(`✅ [Socket] Client connected: ${socket.id}`, {
          userId,
          administrator: isAdministrator,
          isManager,
          handshake: {
            auth: socket.handshake.auth,
            headers: Object.keys(socket.handshake.headers),
          }
        });
      }

      // ========== Auto-join rooms with error handling ==========
      try {
        // Membership is decided entirely by rooms.js from server-resolved
        // identity — manager rooms are company-scoped, so a manager of one
        // company can never be in another company's room.
        const rooms = roomsForSocket({
          userId,
          isManager,
          isPlatform: socket.data?.isPlatform || false,
          companyId: socket.data?.companyId || null,
        });

        for (const room of rooms) {
          socket.join(room);
        }

        if (isDev) {
          console.log(`✅ [Socket] ${socket.id} joined ${rooms.length ? rooms.join(', ') : 'no rooms'}`);
          if (!userId) {
            console.warn(`⚠️ [Socket] No userId for socket ${socket.id}, skipping personal rooms`);
          }
          if (isManager && !socket.data?.companyId && !socket.data?.isPlatform) {
            console.warn(`⚠️ [Socket] Manager socket ${socket.id} has no resolvable company — no manager room joined`);
          }
        }
      } catch (joinError) {
        console.error(`❌ [Socket] Error joining rooms for ${socket.id}:`, joinError);
        console.error('Stack:', joinError.stack);
        // Don't disconnect - let connection continue without room membership
      }
      // =========================================================
      // Room membership is server-owned only (see auto-join above). Client join-room is not supported.

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

export default initializeSocket;


