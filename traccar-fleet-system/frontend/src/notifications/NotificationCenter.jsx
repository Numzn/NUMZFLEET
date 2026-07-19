import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Drawer,
  List,
  ListItemButton,
  Typography,
  Box,
  Button,
  Divider,
  Menu,
  MenuItem,
  ListSubheader,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
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

const CATEGORY_OPTIONS = ['', 'fuel', 'tracking', 'maintenance', 'compliance', 'system', 'assignment'];
const SEVERITY_OPTIONS = ['', 'info', 'success', 'warning', 'critical'];
const GROUP_OPTIONS = [
  { key: 'day', label: 'Day' },
  { key: 'category', label: 'Category' },
  { key: 'vehicle', label: 'Vehicle' },
];

function SeverityDot({ severity }) {
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
        mt: '6px',
      }}
    />
  );
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
        borderRadius: 1.5,
        mb: 0.25,
        py: 1,
        gap: 1,
        bgcolor: n.read ? 'transparent' : (theme) => alpha(theme.palette.primary.main, 0.06),
        cursor: n.metadata?.deepLink ? 'pointer' : 'default',
        '&:hover .notif-actions': { opacity: 1 },
      }}
    >
      <SeverityDot severity={n.severity} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight={n.read ? 500 : 700}
            sx={{ flex: 1, lineHeight: 1.35 }}
          >
            {n.title}
          </Typography>
          {n.category && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.65rem', flexShrink: 0 }}
            >
              {n.category}
            </Typography>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.4 }}>
          {n.message}
        </Typography>

        <Box
          className="notif-actions"
          sx={{
            display: 'flex',
            gap: 0.25,
            mt: 0.5,
            opacity: { xs: 1, sm: 0 },
            transition: 'opacity 0.12s ease',
          }}
        >
          {!n.read && (
            <Tooltip title="Mark as read">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMarkRead(n.id, n); }}>
                <DoneAllIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Acknowledge">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAcknowledge(n.id); }}>
              <TaskAltOutlinedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Archive">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onArchive(n.id); }}>
              <Inventory2OutlinedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
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
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
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

  const activeFilterCount = (filters.category ? 1 : 0) + (filters.severity ? 1 : 0) + (filters.archived ? 1 : 0);

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
    setFilterMenuAnchor(null);
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
    <Box sx={{ width: isMobile ? '100%' : 400, maxHeight: isMobile ? '100vh' : 600, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 2, pb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Notifications
        </Typography>
        {unread > 0 && (
          <Button size="small" onClick={onMarkAllRead} sx={{ textTransform: 'none', fontWeight: 500 }}>
            Mark all read
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pb: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filters.archived ? 'archived' : filters.read}
          onChange={(_e, value) => {
            if (value == null) return;
            if (value === 'archived') {
              setFilters((f) => ({ ...f, archived: true, read: 'all' }));
            } else {
              setFilters((f) => ({ ...f, archived: false, read: value }));
            }
          }}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: 1.25,
              py: 0.25,
              fontSize: '0.8rem',
              border: 'none',
              borderRadius: 999,
              color: 'text.secondary',
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                color: 'text.primary',
                fontWeight: 600,
              },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="unread">Unread</ToggleButton>
          <ToggleButton value="archived">Archived</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Filters">
          <IconButton
            size="small"
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            sx={{ color: activeFilterCount ? 'primary.main' : 'text.secondary' }}
          >
            <Badge variant="dot" color="primary" invisible={!activeFilterCount}>
              <TuneIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: (t) => alpha(t.palette.background.paper, 1) } }}
      >
        <ListSubheader disableSticky sx={{ lineHeight: 2.5 }}>Group by</ListSubheader>
        {GROUP_OPTIONS.map(({ key, label }) => (
          <MenuItem key={key} selected={groupMode === key} onClick={() => setGroupMode(key)}>
            {label}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />

        <ListSubheader disableSticky sx={{ lineHeight: 2.5 }}>Category</ListSubheader>
        {CATEGORY_OPTIONS.map((c) => (
          <MenuItem
            key={c || 'all-cat'}
            selected={filters.category === c}
            onClick={() => setFilters((f) => ({ ...f, category: c }))}
            sx={{ textTransform: c ? 'capitalize' : 'none' }}
          >
            {c || 'All categories'}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />

        <ListSubheader disableSticky sx={{ lineHeight: 2.5 }}>Severity</ListSubheader>
        {SEVERITY_OPTIONS.map((s) => (
          <MenuItem
            key={s || 'all-sev'}
            selected={filters.severity === s}
            onClick={() => setFilters((f) => ({ ...f, severity: s }))}
            sx={{ textTransform: s ? 'capitalize' : 'none' }}
          >
            {s || 'All severity'}
          </MenuItem>
        ))}
      </Menu>

      <Divider />

      <Box sx={{ overflow: 'auto', px: 1, py: 1, flex: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} thickness={4} />
          </Box>
        )}

        {!loading && filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {filters.archived ? 'No archived notifications' : "You're all caught up"}
            </Typography>
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
              Earlier
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
          <Button fullWidth size="small" onClick={() => loadServerPage(nextBefore)} sx={{ mt: 1, textTransform: 'none' }}>
            Load more
          </Button>
        )}
      </Box>
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
        <Drawer
          anchor="right"
          open={open}
          onClose={handleClose}
          PaperProps={{ sx: { width: '100%', maxWidth: 420, bgcolor: (t) => alpha(t.palette.background.paper, 1) } }}
        >
          {panelContent}
        </Drawer>
      ) : (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { p: 0, borderRadius: 2, bgcolor: (t) => alpha(t.palette.background.paper, 1) } }}
        >
          {panelContent}
        </Popover>
      )}
    </>
  );
};

export default NotificationCenter;
