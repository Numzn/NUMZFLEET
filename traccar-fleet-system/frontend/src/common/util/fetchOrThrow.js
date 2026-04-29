import { isFuelApiPath } from '../../config/traccarApi.js';

const handleUnauthorized = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const current = `${window.location.pathname}${window.location.search}`;
  window.sessionStorage.setItem('postLogin', current);
  window.location.replace('/login');
};

function pathnameFromFetchInput(input) {
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        return new URL(input).pathname;
      } catch {
        return input.split('?')[0];
      }
    }
    return input.split('?')[0];
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      return new URL(input.url).pathname;
    } catch {
      return '';
    }
  }
  return '';
}

/** Fuel-api and Socket.IO 401s do not mean Traccar session is gone; avoid kicking users back to login. */
function isNonTraccarUnauthorizedPath(path) {
  if (!path) return false;
  if (isFuelApiPath(path)) return true;
  if (path.startsWith('/socket.io')) return true;
  return false;
}

export default async (input, init = {}) => {
  const { redirectOnUnauthorized = true, ...requestInit } = init;
  const response = await fetch(input, { credentials: 'include', ...requestInit });
  if (!response.ok) {
    const path = pathnameFromFetchInput(input);
    const allowRedirect =
      redirectOnUnauthorized
      && response.status === 401
      && !isNonTraccarUnauthorizedPath(path);
    if (allowRedirect) {
      handleUnauthorized();
    }
    throw new Error(await response.text());
  }
  return response;
};
