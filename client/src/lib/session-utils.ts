/**
 * Session Management Utilities
 * These functions can be run in the browser console to manage authentication sessions
 */

import { auth } from './firebase';

/**
 * Clear all authentication sessions and force fresh login
 * Run this in browser console: window.clearAllSessions()
 */
export const clearAllSessions = async () => {
  try {
    console.log('🔒 Clearing all authentication sessions...');
    
    // Sign out from Firebase
    if (auth.currentUser) {
      await auth.signOut();
      console.log('✅ Firebase user signed out');
    }
    
    // Clear all localStorage
    localStorage.clear();
    console.log('✅ localStorage cleared');
    
    // Clear all sessionStorage
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
    
    // Clear specific Firebase keys
    const firebaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('firebase:') || 
      key.startsWith('firebaseLocalStorageDb') ||
      key.includes('firebase')
    );
    
    firebaseKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed Firebase key: ${key}`);
    });
    
    // Clear cookies (if any)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    console.log('✅ Cookies cleared');
    
    console.log('🎉 All sessions cleared! Refreshing page...');
    
    // Refresh the page to ensure clean state
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  }
};

/**
 * Check current authentication status
 * Run this in browser console: window.checkAuthStatus()
 */
export const checkAuthStatus = () => {
  console.log('🔍 Checking authentication status...');
  
  // Check Firebase auth state
  const currentUser = auth.currentUser;
  console.log('Firebase User:', currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified
  } : 'None');
  
  // Check localStorage
  const localStorageKeys = Object.keys(localStorage);
  const firebaseKeys = localStorageKeys.filter(key => 
    key.startsWith('firebase:') || 
    key.startsWith('firebaseLocalStorageDb') ||
    key.includes('firebase')
  );
  
  console.log('Total localStorage keys:', localStorageKeys.length);
  console.log('Firebase-related keys:', firebaseKeys);
  
  // Check sessionStorage
  const sessionStorageKeys = Object.keys(sessionStorage);
  console.log('Total sessionStorage keys:', sessionStorageKeys.length);
  
  // Check cookies
  console.log('Cookies:', document.cookie || 'None');
};

/**
 * Force logout and clear sessions
 * Run this in browser console: window.forceLogout()
 */
export const forceLogout = async () => {
  try {
    console.log('🚪 Force logging out...');
    
    // Sign out from Firebase
    await auth.signOut();
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    console.log('✅ Force logout completed');
    console.log('🔄 Refreshing page...');
    
    // Refresh the page
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Force logout failed:', error);
  }
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).clearAllSessions = clearAllSessions;
  (window as any).checkAuthStatus = checkAuthStatus;
  (window as any).forceLogout = forceLogout;
  
  console.log('🔧 Session utilities loaded! Available commands:');
  console.log('  - window.clearAllSessions() - Clear all sessions and refresh');
  console.log('  - window.checkAuthStatus() - Check current auth status');
  console.log('  - window.forceLogout() - Force logout and refresh');
}
