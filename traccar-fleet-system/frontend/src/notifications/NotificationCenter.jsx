import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Button,
  Divider,
  Chip,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectUnreadCount,
  makeSelectNotificationsWithFilters,
  makeSelectGroupedByDayBucket,
  makeSelectGroupedByCategory,
  makeSelectGroupedByVehicle,
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

const SEVERITY_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
};

function SeverityIcon({ severity }) {
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  const sx = { fontSize: 18, color, mt: 0.25 };
  if (severity === 'critical') return <ErrorOutlineIcon sx={sx} />;
  if (severity === 'warning') return <WarningAmberIcon sx={sx} />;
  if (severity === 'success') return <CheckCircleOutlineIcon sx={sx} />;
  return <InfoOutlinedIcon sx={sx} />;
}

function NotificationRow({
  n,
  onOpenNotification,
  onMarkRead,
  onAcknowledge,
  onArchive,
}) {
  return (
    <ListItemButton
      alignItems="flex-start"
      disableRipple={!n.metadata?.deepLink}
      onClick={n.metadata?.deepLink ? () => onOpenNotification(n) : undefined}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        pl: 1,
        borderLeft: `3px solid ${SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.info}`,
        bgcolor: n.read ? 'transparent' : 'action.hover',
        cursor: n.metadata?.deepLink ? 'pointer' : 'default',
      }}
    >
      <SeverityIcon severity={n.severity} />
      <Box sx={{ flex: 1, minWidth: 0, ml: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            {n.title}
          </Typography>
          {n.category && (
            <Chip size="small" label={n.category} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {n.message}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
          {!n.read && (
            <Button size="small" onClick={(e) => { e.stopPropagation(); onMarkRead(n.id, n); }}>
              Read
            </Button>
          )}
          <Button size="small" onClick={(e) => { e.stopPropagation(); onAcknowledge(n.id); }}>
            Acknowledge
          </Button>
          <Button size="small" color="inherit" onClick={(e) => { e.stopPropagation(); onArchive(n.id); }}>
            Archive
          </Button>
        </Box>
      </Box>
    </ListItemButton>
  );
}

const NotificationCenter = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [groupMode, setGroupMode] = useState('day');
  const [loading, setLoading] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);

  const persistence = useSelector(isNotificationPersistenceSyncEnabled);
  const user = useSelector((s) => s.session.user);
  const unread = useSelector(selectUnreadCount);

  const filterArgs = useMemo(() => ({
    category: filters.category || undefined,
    severity: filters.severity || undefined,
    read: filters.read === 'all' ? undefined : filters.read,
    archived: filters.archived,
  }), [filters.category, filters.severity, filters.read, filters.archived]);

  const selectFiltered = useMemo(() => makeSelectNotificationsWithFilters(), []);
  const selectGroupedDay = useMemo(() => makeSelectGroupedByDayBucket(), []);
  const selectGroupedCategory = useMemo(() => makeSelectGroupedByCategory(), []);
  const selectGroupedVehicle = useMemo(() => makeSelectGroupedByVehicle(), []);

  const filtered = useSelector((s) => selectFiltered(s, filterArgs));
  const groupedDay = useSelector((s) => selectGroupedDay(s, filterArgs));
  const groupedCategory = useSelector((s) => selectGroupedCategory(s, filterArgs));
  const groupedVehicle = useSelector((s) => selectGroupedVehicle(s, filterArgs));

  const grouped = groupMode === 'category'
    ? groupedCategory
    : (groupMode === 'vehicle' ? groupedVehicle : groupedDay);

  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    if (groupMode === 'day') return keys.sort((a, b) => b.localeCompare(a));
    return keys.sort((a, b) => a.localeCompare(b));
  }, [grouped, groupMode]);

  const readItems = useMemo(() => filtered.filter((n) => n.read), [filtered]);
  const unreadItems = useMemo(() => filtered.filter((n) => !n.read), [filtered]);

  const open = Boolean(anchorEl) || (isMobile && anchorEl === document.body);

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
    setAnchorEl(isMobile ? document.body : event.currentTarget);
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

  const panelContent = (
    <Box sx={{ p: 2, pb: 1, width: isMobile ? '100%' : 480, maxHeight: isMobile ? '100vh' : 640, overflow: 'auto' }}>
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
        {[
          { key: 'day', label: 'By day' },
          { key: 'category', label: 'By category' },
          { key: 'vehicle', label: 'By vehicle' },
        ].map(({ key, label }) => (
          <Chip
            key={key}
            size="small"
            label={label}
            color={groupMode === key ? 'primary' : 'default'}
            onClick={() => setGroupMode(key)}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {['', 'fuel', 'tracking', 'maintenance', 'compliance', 'system', 'assignment'].map((c) => (
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
        <Chip
          size="small"
          label="Archived"
          variant={filters.archived ? 'filled' : 'outlined'}
          onClick={() => setFilters((f) => ({ ...f, archived: !f.archived, read: 'all' }))}
        />
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

      {!loading && filters.read !== 'read' && unreadItems.length > 0 && groupMode === 'day' && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
            Unread
          </Typography>
          <List dense disablePadding>
            {unreadItems.slice(0, 20).map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpenNotification={onOpenNotification}
                onMarkRead={onMarkRead}
                onAcknowledge={onAcknowledge}
                onArchive={onArchive}
              />
            ))}
          </List>
        </Box>
      )}

      {!loading && sortedGroupKeys.map((groupKey) => (
        <Box key={groupKey} sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
            {groupKey}
          </Typography>
          <List dense disablePadding>
            {(grouped[groupKey] || []).map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpenNotification={onOpenNotification}
                onMarkRead={onMarkRead}
                onAcknowledge={onAcknowledge}
                onArchive={onArchive}
              />
            ))}
          </List>
        </Box>
      ))}

      {!loading && filters.read !== 'unread' && readItems.length > 0 && groupMode === 'day' && (
        <Box sx={{ mb: 1, opacity: 0.85 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            Earlier (read)
          </Typography>
          <List dense disablePadding>
            {readItems.slice(0, 10).map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpenNotification={onOpenNotification}
                onMarkRead={onMarkRead}
                onAcknowledge={onAcknowledge}
                onArchive={onArchive}
              />
            ))}
          </List>
        </Box>
      )}

      {persistence && nextBefore && (
        <Button fullWidth size="small" onClick={() => loadServerPage(nextBefore)} sx={{ mt: 1 }}>
          Load more
        </Button>
      )}
    </Box>
  );

  return (
    <>
      <IconButton onClick={handleClick} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Badge variant="dot" invisible={unread === 0} color="error" overlap="circular">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {isMobile ? (
        <Drawer anchor="right" open={open} onClose={handleClose} PaperProps={{ sx: { width: '100%', maxWidth: 420 } }}>
          {panelContent}
        </Drawer>
      ) : (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { p: 0 } }}
        >
          {panelContent}
        </Popover>
      )}
    </>
  );
};

export default NotificationCenter;
