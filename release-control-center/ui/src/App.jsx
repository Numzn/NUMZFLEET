import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Container, Tab, Tabs, Toolbar, Typography, Chip, Button,
} from '@mui/material';
import { useAuth } from './auth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import TimelinePage from './pages/TimelinePage.jsx';
import JobsPage from './pages/JobsPage.jsx';

function NavTabs() {
  const location = useLocation();
  const path = location.pathname;
  const tab = path.startsWith('/timeline') ? '/timeline' : path.startsWith('/jobs') ? '/jobs' : '/';

  return (
    <Tabs value={tab} textColor="inherit" indicatorColor="primary" sx={{ ml: 2 }}>
      <Tab label="Overview" value="/" component={Link} to="/" />
      <Tab label="Timeline" value="/timeline" component={Link} to="/timeline" />
      <Tab label="Jobs" value="/jobs" component={Link} to="/jobs" />
    </Tabs>
  );
}

export default function App() {
  const { isAuthenticated, setToken } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            NUMZFLEET Release Control Center
          </Typography>
          <Chip label="orchestration only" size="small" sx={{ ml: 1 }} variant="outlined" />
          <Box sx={{ flex: 1 }} />
          <NavTabs />
          <Button color="inherit" size="small" onClick={() => setToken('')} sx={{ ml: 1 }}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
