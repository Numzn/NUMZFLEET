import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Button,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectUnreadCount,
  makeSelectNotificationsWithFilters,
  makeSelectGroupedByDayBucket,
} from '../store/notifications/notificationSelectors.js';
import { notificationsActions } from '../store/notifications/notificationsSlice.js';
import { isNotificationPersistenceSyncEnabled } from './notificationFeatureFlags.js';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotificationApi,
  mapServerNotificationToEntity,
  patchNotificationLifecycle,
} from './notificationApi.js';

const defaultFilters = () => ({
  category: '',
  severity: '',
  read: 'all',
  archived: false,
});

const NotificationCenter = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);

  const persistence = useSelector(isNotificationPersistenceSyncEnabled);
  const user = useSelector((s) => s.session.user);
  const unread = useSelector(selectUnreadCount);

  // Stable reference — only changes when filter field values change.
  const filterArgs = useMemo(() => ({
    category: filters.category || undefined,
    severity: filters.severity || undefined,
    read: filters.read === 'all' ? undefined : filters.read,
    archived: filters.archived,
  }), [filters.category, filters.severity, filters.read, filters.archived]);

  // Per-instance memoized selectors so each component gets its own cache.
  const selectFiltered = useMemo(() => makeSelectNotificationsWithFilters(), []);
  const selectGrouped = useMemo(() => makeSelectGroupedByDayBucket(), []);

  const filtered = useSelector((s) => selectFiltered(s, filterArgs));
  const grouped = useSelector((s) => selectGrouped(s, filterArgs));

  const sortedDays = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  const open = Boolean(anchorEl);

  const loadServerPage = useCallback(async (before) => {
    if (!persistence) return;
    setLoading(true);
    try {
      const json = await fetchNotifications({ before: before || undefined, limit: 40 });
      const rows = json?.items || [];
      const mapped = rows
        .map((row) => mapServerNotificationToEntity(row, { markChannelsDelivered: true }))
        .filter(Boolean);
      if (mapped.length) {
        dispatch(notificationsActions.hydrateFromServer({
          items: mapped,
          cursor: json?.nextBefore || null,
        }));
      }
      setNextBefore(json?.nextBefore || null);
    } catch (e) {
      console.warn('[NotificationCenter] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [persistence, dispatch]);

  useEffect(() => {
    if (open && persistence) {
      loadServerPage();
    }
  }, [open, persistence, loadServerPage]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const onMarkRead = async (id, entity) => {
    dispatch(notificationsActions.markRead(id));
    if (persistence) {
      try {
        const dedup = entity?.metadata?.dedupKey;
        const apiId = entity?.serverId
          || (dedup && user?.id != null ? `${user.id}:${dedup}` : null)
          || id;
        await markNotificationRead(apiId);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const onMarkAllRead = async () => {
    dispatch(notificationsActions.markAllRead());
    if (persistence) {
      try {
        await markAllNotificationsRead();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const onArchive = async (id) => {
    dispatch(notificationsActions.archiveNotification(id));
    if (persistence) {
      try {
        await archiveNotificationApi(id);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const onOpenNotification = (n) => {
    const deepLink = n?.metadata?.deepLink;
    if (!deepLink) return;
    if (!n.read) onMarkRead(n.id, n);
    handleClose();
    navigate(deepLink);
  };

  const onAcknowledge = async (id) => {
    const ts = new Date().toISOString();
    dispatch(notificationsActions.markLifecycle({ id, acknowledgedAt: ts }));
    if (persistence) {
      try {
        await patchNotificationLifecycle(id, { acknowledgedAt: ts });
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <>
      <IconButton onClick={handleClick} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Badge variant="dot" invisible={unread === 0} color="error" overlap="circular">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { width: 400, maxHeight: 560, p: 0 },
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Notifications
            </Typography>
            {unread > 0 && (
              <Button size="small" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {['', 'fuel', 'tracking', 'system', 'assignment'].map((c) => (
              <Chip
                key={c || 'all'}
                size="small"
                label={c || 'All categories'}
                color={filters.category === c ? 'primary' : 'default'}
                onClick={() => setFilters((f) => ({ ...f, category: c }))}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {['', 'info', 'success', 'warning', 'critical'].map((s) => (
              <Chip
                key={s || 'all-sev'}
                size="small"
                label={s || 'All severity'}
                color={filters.severity === s ? 'secondary' : 'default'}
                onClick={() => setFilters((f) => ({ ...f, severity: s }))}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'read', label: 'Read' },
            ].map(({ key, label }) => (
              <Chip
                key={key}
                size="small"
                label={label}
                variant={filters.read === key ? 'filled' : 'outlined'}
                onClick={() => setFilters((f) => ({ ...f, read: key }))}
              />
            ))}
          </Box>

          <Divider sx={{ my: 1 }} />

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!loading && filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">No notifications</Typography>
            </Box>
          )}

          {!loading && sortedDays.map((day) => (
            <Box key={day} sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                {day}
              </Typography>
              <List dense disablePadding>
                {(grouped[day] || []).map((n) => (
                  <ListItemButton
                    key={n.id}
                    alignItems="flex-start"
                    disableRipple={!n.metadata?.deepLink}
                    onClick={n.metadata?.deepLink ? () => onOpenNotification(n) : undefined}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      cursor: n.metadata?.deepLink ? 'pointer' : 'default',
                    }}
                  >
                    <ListItemText
                      primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
                      primary={n.title}
                      secondary={n.message}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                      {!n.read && (
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); onMarkRead(n.id, n); }}
                        >
                          Read
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onAcknowledge(n.id); }}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={(e) => { e.stopPropagation(); onArchive(n.id); }}
                      >
                        Archive
                      </Button>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ))}

          {persistence && nextBefore && (
            <Button fullWidth size="small" onClick={() => loadServerPage(nextBefore)} sx={{ mt: 1 }}>
              Load more
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;
