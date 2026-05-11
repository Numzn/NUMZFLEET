import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AppLayout from '../common/components/AppLayout';
import KPICards from './components/KPICards';
import ErbPricesCard from './components/ErbPricesCard';
import useFilter from '../main/useFilter';
import usePersistedState from '../common/util/usePersistedState';

const DashboardPage = () => {
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const positions = useSelector((state) => state.session.positions);
  const events = useSelector((state) => state.events.items);
  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);

  const [keyword] = useState('');
  const [filter] = usePersistedState('filter', {
    statuses: [],
    groups: [],
  });
  const [filterSort] = usePersistedState('filterSort', '');
  const [filterMap] = usePersistedState('filterMap', false);

  useFilter(keyword, filter, filterSort, filterMap, positions, setFilteredDevices, setFilteredPositions);

  useEffect(() => {
    const h = (location.hash || '').replace(/^#/, '');
    if (h !== 'dashboard-erb') return;
    const el = document.getElementById('dashboard-erb');
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash]);

  const dashboardSummary = useMemo(() => {
    const onlineCount = filteredDevices.filter((device) => (
      filteredPositions.some((position) => position.deviceId === device.id)
    )).length;
    const urgentAlerts = Object.values(events).filter((event) => (
      event.type === 'alarm' || event.type === 'panic'
    )).length;
    const pendingFuelRequests = Object.values(fuelRequests).filter((request) => {
      const status = request.status?.toLowerCase?.() || '';
      return status === 'pending' || status === 'submitted' || status === 'awaiting_approval';
    }).length;

    return {
      totalFleet: filteredDevices.length,
      onlineCount,
      offlineCount: Math.max(filteredDevices.length - onlineCount, 0),
      urgentAlerts,
      pendingFuelRequests,
    };
  }, [events, filteredDevices, filteredPositions, fuelRequests]);

  const quickStats = [
    {
      label: 'Connected now',
      value: `${dashboardSummary.onlineCount}/${dashboardSummary.totalFleet || 0}`,
      tone: '#67e8f9',
      icon: <DirectionsCarFilledOutlinedIcon sx={{ fontSize: '1rem' }} />,
    },
    {
      label: 'Fuel approvals',
      value: `${dashboardSummary.pendingFuelRequests}`,
      tone: '#fbbf24',
      icon: <LocalGasStationOutlinedIcon sx={{ fontSize: '1rem' }} />,
    },
    {
      label: 'Urgent alerts',
      value: `${dashboardSummary.urgentAlerts}`,
      tone: '#fda4af',
      icon: <WarningAmberRoundedIcon sx={{ fontSize: '1rem' }} />,
    },
  ];

  const handleFuelQueueJump = () => navigate('/fuel-requests');

  return (
    <AppLayout showSidebar={true}>
      <Box sx={{
        px: { xs: 1.5, sm: 2.5, md: 3.5, lg: 4 },
        py: { xs: 1.25, sm: 2, md: 2.5 },
        pb: 'calc(var(--app-bottomnav-height, 0px) + env(safe-area-inset-bottom, 0px) + 28px)',
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at top, rgba(8, 145, 178, 0.1), transparent 28%), linear-gradient(180deg, rgba(2, 6, 23, 0.96) 0%, rgba(6, 23, 42, 0.9) 100%)'
          : 'radial-gradient(circle at top, rgba(6, 182, 212, 0.1), transparent 24%), linear-gradient(180deg, #f7fbff 0%, #eef5fb 100%)',
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            mb: { xs: 3, md: 4 },
            p: { xs: 2, sm: 2.5, md: 2.75 },
            borderRadius: { xs: '16px', md: '16px' },
            border: `1px solid ${alpha('#9be7f5', theme.palette.mode === 'dark' ? 0.18 : 0.28)}`,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(4, 15, 28, 0.94) 0%, rgba(8, 34, 56, 0.92) 55%, rgba(10, 79, 98, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(8, 28, 46, 0.96) 0%, rgba(10, 69, 96, 0.92) 58%, rgba(13, 138, 165, 0.88) 100%)',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 18px 48px rgba(0, 0, 0, 0.32)'
              : '0 18px 50px rgba(6, 37, 64, 0.16)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-28%',
              right: '-10%',
              width: { xs: 170, md: 210 },
              height: { xs: 170, md: 210 },
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(103, 232, 249, 0.18) 0%, rgba(103, 232, 249, 0) 72%)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              left: { xs: '-18%', md: '-10%' },
              bottom: '-55%',
              width: { xs: 160, md: 200 },
              height: { xs: 160, md: 200 },
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, rgba(251, 191, 36, 0) 72%)',
            },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 2, md: 2.5 }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ position: 'relative', zIndex: 1 }}
          >
            <Box sx={{ maxWidth: 720 }}>
              <Chip
                label="Fleet command center"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  mb: 1,
                  height: { xs: 24, sm: 26, md: 28 },
                  color: '#dffbff',
                  fontWeight: 700,
                  fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '& .MuiChip-label': {
                    px: { xs: 0.75, sm: 1, md: 1.25 },
                  },
                }}
              />
              <Typography
                sx={{
                  fontSize: { xs: '1.25rem', sm: '1.8rem', md: '2rem' },
                  lineHeight: 1.08,
                  fontWeight: 800,
                  letterSpacing: '-0.035em',
                  color: '#f8fdff',
                  maxWidth: 640,
                }}
              >
                {isMobile
                  ? 'Fleet Dashboard'
                  : 'Fleet Dashboard with a cleaner control surface for live ops and mobile review.'}
              </Typography>
              <Typography
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  mt: 0.85,
                  maxWidth: 560,
                  color: 'rgba(232, 246, 252, 0.72)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem' },
                  lineHeight: 1.5,
                }}
              >
                Live fleet health, fuel queue, and urgent alerts in one compact top section.
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                sx={{ mt: 1.75, display: { xs: 'none', sm: 'flex' } }}
              >
                {quickStats.map((stat) => (
                  <Box
                    key={stat.label}
                    sx={{
                      minWidth: { xs: 'calc(50% - 4px)', sm: 150 },
                      flex: { xs: '1 1 calc(50% - 4px)', sm: '0 1 auto' },
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 0.8, sm: 1 },
                      px: { xs: 0.85, sm: 1.15 },
                      py: { xs: 0.7, sm: 0.95 },
                      borderRadius: { xs: '14px', sm: '16px' },
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 26, sm: 30 },
                        height: { xs: 26, sm: 30 },
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '9px',
                        color: stat.tone,
                        backgroundColor: alpha(stat.tone, 0.14),
                        boxShadow: `0 0 0 1px ${alpha(stat.tone, 0.18)}`,
                        fontSize: { xs: '0.85rem', sm: '1rem' },
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        color: '#ffffff', 
                        fontWeight: 800, 
                        lineHeight: 1.1, 
                        fontSize: { xs: '0.8rem', sm: '0.96rem' },
                        display: '-webkit-box',
                        overflow: 'hidden',
                      }}>
                        {stat.value}
                      </Typography>
                      <Typography sx={{ 
                        color: 'rgba(226, 241, 248, 0.72)', 
                        fontSize: { xs: '0.65rem', sm: '0.72rem' },
                        lineHeight: 1.1,
                      }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Stack
              spacing={1}
              sx={{
                width: { xs: '100%', md: 290 },
                alignSelf: { xs: 'stretch', md: 'center' },
              }}
            >
              <Chip
                label={dashboardSummary.offlineCount > 0 ? `${dashboardSummary.offlineCount} offline right now` : 'All visible right now'}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  alignSelf: { xs: 'flex-start', md: 'flex-end' },
                  height: { xs: 22, sm: 24 },
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  color: '#f8fdff',
                  fontWeight: 700,
                  backgroundColor: dashboardSummary.offlineCount > 0
                    ? 'rgba(251, 191, 36, 0.16)'
                    : 'rgba(52, 211, 153, 0.16)',
                  border: dashboardSummary.offlineCount > 0
                    ? '1px solid rgba(251, 191, 36, 0.2)'
                    : '1px solid rgba(52, 211, 153, 0.18)',
                  '& .MuiChip-label': {
                    px: { xs: 0.75, sm: 1 },
                  },
                }}
              />
              <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1}>
                <Button
                  fullWidth
                  onClick={() => navigate('/map')}
                  endIcon={<ArrowOutwardIcon />}
                  startIcon={<MapOutlinedIcon />}
                  sx={{
                    justifyContent: 'space-between',
                    px: { xs: 1, sm: 1.35 },
                    py: { xs: 0.8, sm: 1 },
                    borderRadius: { xs: '12px', sm: '12px' },
                    fontWeight: 700,
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    color: '#02131e',
                    background: 'linear-gradient(135deg, #9be7f5 0%, #67e8f9 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #b2eff8 0%, #7deaf9 100%)',
                    },
                    '& .MuiButton-startIcon': {
                      marginRight: { xs: 0.5, sm: 0.75 },
                    },
                    '& .MuiButton-endIcon': {
                      marginLeft: 'auto',
                    },
                  }}
                >
                  Open live map
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleFuelQueueJump}
                  startIcon={<LocalGasStationOutlinedIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    px: { xs: 1, sm: 1.35 },
                    py: { xs: 0.8, sm: 1 },
                    borderRadius: { xs: '12px', sm: '12px' },
                    fontWeight: 700,
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    color: '#f8fdff',
                    borderColor: 'rgba(255, 255, 255, 0.16)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.24)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  Jump to fuel queue
                </Button>
              </Stack>
              <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/reports/combined')}
                  startIcon={<AssessmentOutlinedIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    px: { xs: 0.9, sm: 1.25 },
                    py: { xs: 0.75, sm: 0.9 },
                    minWidth: 0,
                    borderRadius: { xs: '12px', sm: '12px' },
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    fontWeight: 600,
                    color: 'rgba(234, 245, 250, 0.92)',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.22)',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    },
                  }}
                >
                  Reports
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/settings/devices')}
                  startIcon={<DirectionsCarFilledOutlinedIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    px: { xs: 0.9, sm: 1.25 },
                    py: { xs: 0.75, sm: 0.9 },
                    minWidth: 0,
                    borderRadius: { xs: '12px', sm: '12px' },
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    fontWeight: 600,
                    color: 'rgba(234, 245, 250, 0.92)',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.22)',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    },
                  }}
                >
                  Devices
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        {/* Fleet KPI cards */}
        <Box sx={{ mb: 4 }}>
          <KPICards devices={filteredDevices} positions={filteredPositions} compactMobile={isMobile} />
        </Box>

        {/* ERB Fuel Prices */}
        <Box id="dashboard-erb" sx={{ mb: 4, scrollMarginTop: 96 }}>
          <ErbPricesCard />
        </Box>

      </Box>
    </AppLayout>
  );
};

export default DashboardPage;

