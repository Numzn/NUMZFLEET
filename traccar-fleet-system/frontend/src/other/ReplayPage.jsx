import {
  useState, useEffect, useMemo, useRef, useCallback,
} from 'react';
import {
  Box, Chip, IconButton, Paper, Slider, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import dayjs from 'dayjs';
import TuneIcon from '@mui/icons-material/Tune';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapChromePadding from '../map/MapChromePadding.jsx';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapRouteEvents from '../map/MapRouteEvents';
import MapPositions from '../map/MapPositions';
import { formatTime, formatNumericHours } from '../common/util/formatter';
import { prefixString } from '../common/util/stringUtils';
import ReportFilter, { updateReportParams } from '../reports/components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import StatusCard from '../common/components/StatusCard';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import PositionValue from '../common/components/PositionValue';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { REPORTS_HOME } from '../common/util/navigationParents';
import { traccarPath } from '../config/traccarApi.js';

// Shared floating-surface treatment for header / state card / console — NUMZFLEET design tokens
// (see src/common/theme/globalCssVariables.css), mode-aware for light/dark automatically.
const floatingSurfaceSx = {
  bgcolor: 'var(--surface-elevated)',
  border: '1px solid var(--surface-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-elevation)',
};

const TICK_COLOR = { stop: '#1976d2', event: '#ed6c02' };

const useStyles = makeStyles()((theme) => ({
  root: {
    // Positioning context for the header below — `main` (UnifiedShell.jsx) is already a flex
    // sibling that starts right after the real shell topbar, so anything absolutely positioned
    // inside this div is automatically below that topbar, at every breakpoint, with no need to
    // read or guess its height. (A previous attempt read `--app-topbar-height` via `position:
    // fixed`, which is relative to the viewport, not this container — that var is only refreshed
    // by UnifiedShell on certain state changes and can be stale after client-side navigation into
    // /replay, which is why the header still overlapped the topbar after that fix.)
    position: 'relative',
    height: '100%',
  },
  header: {
    position: 'absolute',
    zIndex: 3,
    top: theme.spacing(1.5),
    left: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.5, 0.5, 0.5),
    maxWidth: theme.dimensions.drawerWidthTablet,
    [theme.breakpoints.down('md')]: {
      right: theme.spacing(1.5),
      maxWidth: 'none',
    },
  },
  headerText: {
    minWidth: 0,
    flex: 1,
  },
  stateCard: {
    // `top` is set inline via sx, from the header's real measured height (headerHeight state
    // below) — not a hardcoded guess. This used to be `position: fixed` with a viewport-relative
    // offset while `header` (above) is `position: absolute` relative to `root`; two different
    // coordinate systems for two cards meant to stack, which is exactly why they overlapped.
    position: 'absolute',
    zIndex: 3,
    left: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    maxWidth: theme.dimensions.popupMaxWidth,
  },
  speedRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.75),
  },
  speedValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.75),
  },
  console: {
    position: 'fixed',
    zIndex: 3,
    left: '50%',
    bottom: theme.spacing(2),
    transform: 'translateX(-50%)',
    width: `min(720px, calc(100% - ${theme.spacing(4)}))`,
    padding: theme.spacing(1.25, 2, 0.75),
    [theme.breakpoints.down('md')]: {
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      transform: 'none',
      borderRadius: 0,
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      boxShadow: 'none',
      paddingBottom: 'env(safe-area-inset-bottom, 12px)',
    },
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing(0.5, 1.5),
  },
  timestamp: {
    fontWeight: 700,
  },
  timelineWrap: {
    margin: theme.spacing(0.5, 0, 0),
  },
  tickStrip: {
    position: 'relative',
    height: 6,
    margin: theme.spacing(-0.5, 0, 0),
  },
  tick: {
    position: 'absolute',
    top: 0,
    width: 5,
    height: 5,
    borderRadius: '50%',
    transform: 'translateX(-50%)',
  },
  timeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: theme.spacing(-0.5),
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 0),
  },
  filterCard: {
    position: 'fixed',
    zIndex: 3,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(380px, calc(100% - 32px))',
    padding: theme.spacing(2.5),
  },
}));

const SPEED_OPTIONS = [0.5, 1, 2, 4];

const ReplayPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const timerRef = useRef();
  const consoleRef = useRef(null);
  const headerRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);

  const [positions, setPositions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stops, setStops] = useState([]);
  const [events, setEvents] = useState([]);
  const [consoleHeight, setConsoleHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  const loaded = Boolean(from && to && !loading && positions.length);
  const currentPosition = loaded ? positions[index] : null;

  const deviceName = useSelector((state) => {
    if (selectedDeviceId) {
      const device = state.devices.items[selectedDeviceId];
      if (device) {
        return device.name;
      }
    }
    return null;
  });

  // Keeps MapLibre's own controls (scale, speed legend) clear of the floating bottom console.
  useEffect(() => {
    const el = consoleRef.current;
    if (!loaded || !el) {
      setConsoleHeight(0);
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      setConsoleHeight(entries[0]?.contentRect?.height ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  // Lets the vehicle-state card sit right below the header's real height, not a guessed offset —
  // the header's content height varies (device name line only shows once a device is selected).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      setHeaderHeight(entries[0]?.contentRect?.height ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Maps each Traccar position id to its index in `positions`, so stops/events (which only carry
  // a positionId) can be located on the same timeline the playback controls scrub through.
  const positionIndexById = useMemo(() => {
    const map = new Map();
    positions.forEach((position, positionIndex) => map.set(position.id, positionIndex));
    return map;
  }, [positions]);

  const stopMarkers = useMemo(() => stops
    .filter((stop) => positionIndexById.has(stop.positionId))
    .map((stop) => ({
      id: `stop-${stop.positionId}`,
      index: positionIndexById.get(stop.positionId),
      latitude: stop.latitude,
      longitude: stop.longitude,
      kind: 'stop',
    })), [stops, positionIndexById]);

  const eventMarkers = useMemo(() => events
    .filter((event) => event.positionId && positionIndexById.has(event.positionId))
    .map((event) => {
      const position = positions[positionIndexById.get(event.positionId)];
      return {
        id: `event-${event.id}`,
        index: positionIndexById.get(event.positionId),
        latitude: position.latitude,
        longitude: position.longitude,
        kind: 'event',
      };
    }), [events, positionIndexById, positions]);

  const routeMarkers = useMemo(() => [...stopMarkers, ...eventMarkers], [stopMarkers, eventMarkers]);

  const activeStop = useMemo(
    () => stops.find((stop) => positionIndexById.get(stop.positionId) === index),
    [stops, positionIndexById, index],
  );
  const activeEvent = useMemo(
    () => events.find((event) => positionIndexById.get(event.positionId) === index),
    [events, positionIndexById, index],
  );

  const elapsedLabel = useMemo(() => {
    if (!currentPosition || positions.length < 2) {
      return null;
    }
    const startTime = positions[0].fixTime;
    const endTime = positions[positions.length - 1].fixTime;
    const elapsedMs = dayjs(currentPosition.fixTime).diff(dayjs(startTime));
    const totalMs = dayjs(endTime).diff(dayjs(startTime));
    return `${formatNumericHours(elapsedMs, t)} / ${formatNumericHours(totalMs, t)}`;
  }, [currentPosition, positions, t]);

  useEffect(() => {
    if (!from && !to) {
      setPositions([]);
      setStops([]);
      setEvents([]);
    }
  }, [from, to, setPositions]);

  useEffect(() => {
    if (playing && positions.length > 0) {
      // Fixed-interval playback: each tick advances one recorded sample, at 500ms / speed.
      // This is not a timestamp-accurate real-time simulation — samples are not evenly spaced in
      // time (GPS reporting intervals vary), so playback speed reflects sample rate, not wall-clock time.
      timerRef.current = setInterval(() => {
        setIndex((index) => index + 1);
      }, 500 / speed);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [playing, positions, speed]);

  useEffect(() => {
    if (index >= positions.length - 1) {
      clearInterval(timerRef.current);
      setPlaying(false);
    }
  }, [index, positions]);

  const onPointClick = useCallback((_, index) => {
    setIndex(index);
  }, [setIndex]);

  const onMarkerClick = useCallback((positionId) => {
    setShowCard(!!positionId);
  }, [setShowCard]);

  // Stops/events are supplementary context, not part of the core replay flow — fetched best-effort
  // so a report-endpoint failure never blocks or errors out route playback itself.
  const loadRouteContext = useCallback(async (deviceId, from, to) => {
    const query = new URLSearchParams({ deviceId, from, to });
    try {
      const [stopsResponse, eventsResponse] = await Promise.all([
        fetchOrThrow(`${traccarPath('/api/reports/stops')}?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        }),
        fetchOrThrow(`${traccarPath('/api/reports/events')}?${new URLSearchParams({ deviceId, from, to, type: 'allEvents' }).toString()}`, {
          headers: { Accept: 'application/json' },
        }),
      ]);
      setStops(await stopsResponse.json());
      setEvents(await eventsResponse.json());
    } catch {
      setStops([]);
      setEvents([]);
    }
  }, [setStops, setEvents]);

  const onShow = useCatch(async ({ deviceIds, from, to }) => {
    const deviceId = deviceIds.find(() => true);
    setLoading(true);
    setSelectedDeviceId(deviceId);
    const query = new URLSearchParams({ deviceId, from, to });
    try {
      const response = await fetchOrThrow(`${traccarPath('/api/positions')}?${query.toString()}`);
      setIndex(0);
      const positions = await response.json();
      setPositions(positions);
      if (!positions.length) {
        throw Error(t('sharedNoData'));
      }
      loadRouteContext(deviceId, from, to);
    } finally {
      setLoading(false);
    }
  });

  const handleDownload = () => {
    const query = new URLSearchParams({ deviceId: selectedDeviceId, from, to });
    window.location.assign(`${traccarPath('/api/positions/kml')}?${query.toString()}`);
  };

  const handleSpeedChange = (_, value) => {
    if (value) {
      setSpeed(value);
    }
  };

  return (
    <div className={classes.root}>
      <MapView>
        <MapChromePadding sheetInsetPx={loaded ? consoleHeight : 0} />
        <MapGeofence />
        <MapRoutePath positions={positions} />
        <MapRoutePoints positions={positions} onClick={onPointClick} showSpeedControl />
        <MapRouteEvents positions={routeMarkers} onClick={onPointClick} />
        {index < positions.length && (
          <MapPositions positions={[positions[index]]} onMarkerClick={onMarkerClick} titleField="fixTime" />
        )}
      </MapView>
      <MapScale />
      <MapCamera positions={positions} />

      {/* Compact top-left header — back / title / vehicle / export / change-route */}
      <Paper elevation={0} className={classes.header} sx={floatingSurfaceSx} ref={headerRef}>
        <IconButton size="small" onClick={() => navigate(REPORTS_HOME)}>
          <BackIcon />
        </IconButton>
        <Box className={classes.headerText}>
          <Typography variant="subtitle2" fontWeight={700} noWrap lineHeight={1.15}>
            {t('reportReplay')}
          </Typography>
          {deviceName && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {deviceName}
            </Typography>
          )}
        </Box>
        {loaded && (
          <>
            <IconButton size="small" onClick={handleDownload} title={t('reportExport')}>
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => updateReportParams(searchParams, setSearchParams, 'ignore', [])}
              title={t('replayChangeRoute')}
            >
              <TuneIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Paper>

      {/* Compact floating vehicle-state card — speed-forward, driven by positions[index] */}
      {loaded && currentPosition && (
        <Paper
          elevation={0}
          className={classes.stateCard}
          sx={{ ...floatingSurfaceSx, top: `calc(${theme.spacing(1.5)} + ${headerHeight || 40}px + ${theme.spacing(1)})` }}
        >
          <div className={classes.speedRow}>
            <Typography className={classes.speedValue}>
              <PositionValue position={currentPosition} property="speed" />
            </Typography>
            {!mobile && currentPosition.course !== undefined && currentPosition.course !== null && (
              <Typography variant="body2" color="text.secondary">
                <PositionValue position={currentPosition} property="course" />
              </Typography>
            )}
          </div>
          <div className={classes.chipRow}>
            {currentPosition.attributes?.hasOwnProperty('motion') && (
              <Chip
                size="small"
                label={currentPosition.attributes.motion ? 'Moving' : 'Stopped'}
                color={currentPosition.attributes.motion ? 'success' : 'default'}
                variant={currentPosition.attributes.motion ? 'filled' : 'outlined'}
              />
            )}
            {currentPosition.attributes?.hasOwnProperty('ignition') && (
              <Chip
                size="small"
                label={currentPosition.attributes.ignition ? 'Ignition On' : 'Ignition Off'}
                color={currentPosition.attributes.ignition ? 'success' : 'default'}
                variant={currentPosition.attributes.ignition ? 'filled' : 'outlined'}
              />
            )}
          </div>
        </Paper>
      )}

      {/* Floating bottom playback console */}
      {loaded && (
        <Paper elevation={0} className={classes.console} sx={floatingSurfaceSx} ref={consoleRef}>
          <div className={classes.metaRow}>
            <Typography variant="body1" className={classes.timestamp} noWrap>
              {formatTime(currentPosition.fixTime, 'seconds')}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {`${index + 1} / ${positions.length}`}
            </Typography>
            {(stops.length > 0 || events.length > 0) && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {`${stops.length} ${t('reportStops')} · ${events.length} ${t('reportEvents')}`}
              </Typography>
            )}
          </div>
          {(activeStop || activeEvent || elapsedLabel) && (
            <div className={classes.metaRow}>
              <Typography variant="caption" color="secondary" noWrap>
                {activeStop && `⏸ ${t('reportStops')} `}
                {activeEvent && `⚑ ${t(prefixString('event', activeEvent.type)) || activeEvent.type}`}
              </Typography>
              {elapsedLabel && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {elapsedLabel}
                </Typography>
              )}
            </div>
          )}

          <div className={classes.timelineWrap}>
            <Slider
              max={positions.length - 1}
              step={null}
              marks={positions.map((_, index) => ({ value: index }))}
              value={index}
              onChange={(_, index) => setIndex(index)}
            />
            {positions.length > 1 && routeMarkers.length > 0 && (
              <div className={classes.tickStrip}>
                {routeMarkers.map((marker) => (
                  <span
                    key={marker.id}
                    className={classes.tick}
                    style={{
                      left: `${(marker.index / (positions.length - 1)) * 100}%`,
                      backgroundColor: TICK_COLOR[marker.kind],
                    }}
                    title={marker.kind === 'stop' ? t('reportStops') : t('reportEvents')}
                  />
                ))}
              </div>
            )}
            <div className={classes.timeLabels}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {formatTime(positions[0].fixTime, 'minutes')}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {formatTime(positions[positions.length - 1].fixTime, 'minutes')}
              </Typography>
            </div>
          </div>

          <div className={classes.controls}>
            <IconButton onClick={() => setIndex((index) => index - 1)} disabled={playing || index <= 0}>
              <SkipPreviousIcon />
            </IconButton>
            <IconButton onClick={() => setPlaying(!playing)} disabled={index >= positions.length - 1}>
              {playing ? <PauseIcon /> : <PlayArrowIcon /> }
            </IconButton>
            <IconButton onClick={() => setIndex((index) => index + 1)} disabled={playing || index >= positions.length - 1}>
              <SkipNextIcon />
            </IconButton>
            <ToggleButtonGroup size="small" exclusive value={speed} onChange={handleSpeedChange} aria-label={t('replayPlaybackSpeed')}>
              {SPEED_OPTIONS.map((option) => (
                <ToggleButton key={option} value={option} sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>
                  {`${option}×`}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </Paper>
      )}

      {/* Route selection — shown only until a device/date range is chosen */}
      {!loaded && (
        <Paper elevation={0} className={classes.filterCard} sx={floatingSurfaceSx}>
          <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
        </Paper>
      )}

      {showCard && index < positions.length && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={positions[index]}
          onClose={() => setShowCard(false)}
          disableActions
        />
      )}
    </div>
  );
};

export default ReplayPage;
