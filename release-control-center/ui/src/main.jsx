import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4fc3f7' },
    success: { main: '#66bb6a' },
    error: { main: '#ef5350' },
    warning: { main: '#ffa726' },
    background: { default: '#0d1117', paper: '#161b22' },
  },
  typography: { fontFamily: '"Segoe UI", system-ui, sans-serif' },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
