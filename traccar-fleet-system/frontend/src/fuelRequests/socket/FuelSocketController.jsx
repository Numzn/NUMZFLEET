import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { fuelRequestsActions } from '../store/fuelRequests';
import { useToastNotifications } from '../../hooks/useToastNotifications';

const FuelSocketController = () => {
  const dispatch = useDispatch();
  const authenticated = useSelector((state) => !!state.session.user);
  const user = useSelector((state) => state.session.user);
  
  // Enable browser notifications - users can see notifications even when tab is not active
  // Check if user has enabled browser notifications in preferences
  const browserNotificationsEnabled = 
    user?.attributes?.browserNotificationsEnabled !== false; // Default to true if not set
  
  const { showToast, ToastNotification, showFuelRequestNotification } = useToastNotifications({
    enableBrowserNotifications: browserNotificationsEnabled,
    autoRequestPermission: false, // Don't auto-request, let user enable manually
  });
  
  // Use refs to avoid recreating socket connection
  const socketRef = useRef(null);
  const showToastRef = useRef(showToast);
  const showFuelRequestNotificationRef = useRef(showFuelRequestNotification);
  const userRef = useRef(user);
  const dispatchRef = useRef(dispatch);
  const browserNotificationsEnabledRef = useRef(browserNotificationsEnabled);
  
  // Smart notification tracking - prevent duplicates
  const shownNotificationsRef = useRef(new Set()); // Track shown notification IDs
  const notificationTimeoutRef = useRef({}); // Track timeouts for clearing
  const tabFocusStateRef = useRef(true); // Track tab focus state reliably

  // Update refs when values change
  useEffect(() => {
    showToastRef.current = showToast;
    showFuelRequestNotificationRef.current = showFuelRequestNotification;
    userRef.current = user;
    dispatchRef.current = dispatch;
    browserNotificationsEnabledRef.current = browserNotificationsEnabled;
  }, [showToast, showFuelRequestNotification, user, dispatch, browserNotificationsEnabled]);

  // Track tab focus state reliably using visibilitychange API
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateFocusState = () => {
      tabFocusStateRef.current = !document.hidden && document.hasFocus();
    };

    // Set initial state
    updateFocusState();

    // Listen for visibility changes (more reliable than focus/blur)
    document.addEventListener('visibilitychange', updateFocusState);
    window.addEventListener('focus', updateFocusState);
    window.addEventListener('blur', updateFocusState);

    return () => {
      document.removeEventListener('visibilitychange', updateFocusState);
      window.removeEventListener('focus', updateFocusState);
      window.removeEventListener('blur', updateFocusState);
    };
  }, []);

  useEffect(() => {
    // Guard against SSR/test environments where window is not available
    if (typeof window === 'undefined') {
      return;
    }

    if (!authenticated || !user) {
      return;
    }

    // Determine fuel API WebSocket URL.
    // With new service-based routing, Socket.IO is at /socket.io on the same origin
    const fuelApiUrl = '/';

    // Reuse socket while connected or actively reconnecting.
    let socket = socketRef.current;

    if (!socket || (!socket.connected && !socket.active)) {
      // Disconnect existing socket if any
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      // Connect to fuel API WebSocket via Socket.IO
      
      socket = io(fuelApiUrl, {
        transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
        timeout: 20000,
        forceNew: false, // Allow reuse of existing connection
        path: '/socket.io', // Socket.IO standard path (NO trailing slash - this is critical!)
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        withCredentials: true, // Important: send cookies for authentication
        upgrade: true, // Allow upgrade from polling to websocket
        rememberUpgrade: true, // Remember transport preference
        // Socket.IO v4+ standard options
        autoConnect: true,
        // Socket.IO v4+ standard: auth is an object, not a callback!
        auth: {
          userId: user?.id,
          administrator: user?.administrator,
        },
      });

      socketRef.current = socket;
    }

    // Register event listeners FIRST, before connection
    // This ensures listeners are ready when events arrive
    
    // Smart notification function with deduplication
    const showSmartNotification = (request, change, eventType) => {
      if (!request || !request.id) return;
      
      // Create unique notification ID based on request ID and change type
      const notificationId = `${eventType}-${request.id}-${change?.type || 'created'}`;
      
      // Check if already shown (within last 5 seconds to prevent duplicates)
      if (shownNotificationsRef.current.has(notificationId)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Notification] Skipping duplicate: ${notificationId}`);
        }
        return;
      }
      
      // Mark as shown IMMEDIATELY to prevent race conditions
      shownNotificationsRef.current.add(notificationId);
      
      // Clear from set after 5 seconds to allow re-notification if needed
      if (notificationTimeoutRef.current[notificationId]) {
        clearTimeout(notificationTimeoutRef.current[notificationId]);
      }
      notificationTimeoutRef.current[notificationId] = setTimeout(() => {
        shownNotificationsRef.current.delete(notificationId);
        delete notificationTimeoutRef.current[notificationId];
      }, 5000);
      
      // Use reliable focus state from ref (updated via visibilitychange API)
      const isTabFocused = tabFocusStateRef.current;
      const isManager = userRef.current?.administrator;
      const isMyRequest = request.userId === userRef.current?.id;
      
      // For fuel-request-created: Only show to managers
      if (eventType === 'fuel-request-created' && isManager) {
        // Only show push notification (no toast notification for new requests)
        // Use a small delay to ensure focus state is stable
        setTimeout(() => {
          // Always show push notification for new fuel requests (no toast)
          if (showFuelRequestNotificationRef.current) {
            try {
              showFuelRequestNotificationRef.current('request-created', {
                id: request.id,
                driverName: request.driverName || 'Driver',
                fuelAmount: request.requestedAmount,
                vehicleName: request.vehicleName,
                ...request,
              });
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Notification] Showing push for fuel-request-created: ${notificationId}`);
              }
            } catch (error) {
              console.error('❌ [Push] Error showing push notification:', error);
            }
          }
        }, 50); // Small delay to ensure focus state is stable
      }
      
      // For fuel-request-updated: Show to relevant user
      if (eventType === 'fuel-request-updated' && change && (isMyRequest || isManager)) {
        const message = change.message || `Fuel request ${change.type}`;
        
        // Determine notification type
        let notificationType = 'info';
        if (change.type === 'approved') notificationType = 'success';
        else if (change.type === 'rejected') notificationType = 'error';
        else if (change.type === 'cancelled') notificationType = 'warning';
        else if (change.type === 'fulfilled') notificationType = 'success';
        
        // Smart notification routing:
        // - If tab is focused: Show toast only (user is actively using app)
        // - If tab is NOT focused: Show push notification only (user is away)
        // Use a small delay to ensure focus state is stable
        setTimeout(() => {
          // Re-check focus state after delay to ensure accuracy
          const currentFocusState = tabFocusStateRef.current;
          
          if (currentFocusState) {
            // Tab is focused - show toast ONLY (no push)
            if (showToastRef.current) {
              try {
                showToastRef.current(message, notificationType, undefined, { skipPush: true });
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[Notification] Showing toast for fuel-request-updated (tab focused): ${notificationId}`);
                }
              } catch (error) {
                console.error('❌ [Toast] Error calling showToast:', error);
              }
            }
          } else {
            // Tab is NOT focused - show push notification ONLY (no toast)
            if (showFuelRequestNotificationRef.current) {
              const pushNotificationType = change.type === 'approved' ? 'request-approved' :
                                         change.type === 'rejected' ? 'request-rejected' :
                                         change.type === 'fulfilled' ? 'request-fulfilled' :
                                         change.type === 'cancelled' ? 'request-cancelled' : null;
              
              if (pushNotificationType) {
                try {
                  showFuelRequestNotificationRef.current(pushNotificationType, {
                    id: request.id,
                    fuelAmount: request.approvedAmount || request.requestedAmount,
                    reason: request.notes || request.rejectionReason,
                    vehicleName: request.vehicleName,
                    ...request,
                  });
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[Notification] Showing push for fuel-request-updated (tab not focused): ${notificationId}`);
                  }
                } catch (error) {
                  console.error('❌ [Push] Error showing push notification:', error);
                }
              }
            }
          }
        }, 50); // Small delay to ensure focus state is stable
      }
    };

    // Fuel request events - remove old listeners before adding new ones to prevent duplicates
    socket.off('fuel-request-created');
    socket.off('fuel-request-updated');

    // Fuel request events - REGISTER BEFORE CONNECTION
    socket.on('fuel-request-created', (data) => {
      // Handle both old format (just request) and new format (with change data)
      const request = data.request || data;
      const change = data.change;
      
      dispatchRef.current(fuelRequestsActions.update([request]));
      
      if (userRef.current?.administrator) {
        // Use smart notification system to prevent duplicates
        showSmartNotification(request, change, 'fuel-request-created');
      }
    });

    socket.on('fuel-request-updated', (data) => {
      // Handle both old format (just request) and new format (with change data)
      const request = data.request || data;
      const change = data.change;
      
      if (!change) {
        console.warn('⚠️ No change data in event - using fallback format');
      }
      
      dispatchRef.current(fuelRequestsActions.update([request]));
      
      // Use smart notification system to prevent duplicates
      if (change) {
        showSmartNotification(request, change, 'fuel-request-updated');
      } else {
        // Fallback for old format
        if (!userRef.current?.administrator && request.userId === userRef.current?.id) {
          if (showToastRef.current) {
            showToastRef.current('Your fuel request was updated', 'info', undefined, { skipPush: true });
          }
        }
      }
    });

    // Listen for room-joined event (fallback for Socket.IO callback issues)
    socket.off('room-joined');
    socket.on('room-joined', (data) => {
      // Room joined successfully
    });

    // Connection events - remove old listener first to prevent duplicates
    socket.off('connect');
    socket.on('connect', () => {
      setTimeout(() => {
        if (!socket.connected) {
          console.warn('⚠️ [Room] Socket disconnected, skipping join-room');
          return;
        }
        
        if (userRef.current?.administrator) {
          const room = 'managers';
          socket.emit('join-room', room, (response) => {
            if (!response) {
              console.warn('⚠️ [Room] No callback received, using room-joined event');
            }
          });
        } else {
          const room = `driver-${userRef.current?.id}`;
          socket.emit('join-room', room, (response) => {
            if (!response) {
              console.warn('⚠️ [Room] No callback received, using room-joined event');
            }
          });
        }
      }, 500);
    });

    // If already connected, join rooms immediately
    if (socket.connected) {
      setTimeout(() => {
        if (!socket.connected) {
          console.warn('⚠️ [Room] Socket disconnected, skipping join-room');
          return;
        }
        
        if (userRef.current?.administrator) {
          const room = 'managers';
          socket.emit('join-room', room, (response) => {
            if (!response) {
              console.warn('⚠️ [Room] No callback received, using room-joined event');
            }
          });
        } else {
          const room = `driver-${userRef.current?.id}`;
          socket.emit('join-room', room, (response) => {
            if (!response) {
              console.warn('⚠️ [Room] No callback received, using room-joined event');
            }
          });
        }
      }, 500);
    }

    // Disconnect and error handlers - remove old listeners first
    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      // Log Docker-specific disconnect reasons
      if (reason === 'transport close' || reason === 'transport error') {
        console.warn('🐳 [FuelSocket] Transport error - possible Docker network issue');
        console.warn('   - Check if fuel-api container restarted');
        console.warn('   - Verify nginx proxy is running (if using nginx)');
        console.warn('   - Check Docker network connectivity');
      }
    });

    socket.off('connect_error');
    socket.on('connect_error', (error) => {
      console.error('❌ [FuelSocket] Fuel WebSocket connection error:', error);
      
      // Common Docker-related error patterns
      if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
        console.error('🐳 [FuelSocket] Docker Network Issue Detected:');
        console.error('   - Check if fuel-api container is running: docker ps | grep fuel-api');
        console.error('   - Check Docker network: docker network inspect numztrak-network');
        console.error('   - If accessing directly (port 3002), try accessing via nginx: http://localhost');
        console.error('   - Check Vite proxy logs in frontend container');
      }
      
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        console.error('🐳 [FuelSocket] Connection Timeout - Possible Docker Issues:');
        console.error('   - Container may be slow to respond');
        console.error('   - Network latency between containers');
        console.error('   - Check container resource usage: docker stats');
      }
      
      // Try to fallback to polling if websocket fails
      if (error.type === 'TransportError' || error.message.includes('websocket')) {
        console.warn('⚠️ [FuelSocket] WebSocket failed, will retry with polling...');
        // Socket.IO will automatically fallback to polling
      }
    });

    // Cleanup on unmount or when dependencies change significantly
    return () => {
      // Always clean up socket connection on unmount
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clean up notification timeouts
      Object.values(notificationTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      notificationTimeoutRef.current = {};
      shownNotificationsRef.current.clear();
    };
  }, [authenticated, user?.id]);

  // Render toast notifications only (popup notifications handled by FuelRequestsCard)
  return <ToastNotification />;
};

export default FuelSocketController;



