import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, collections } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTraccarAuth } from '@/hooks/use-traccar-auth';

interface AdminUser {
  uid: string;
  email: string;
  role: 'admin' | 'owner';
  name: string;
  createdAt: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  forceLogin: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerAdmin: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => Promise<void>;
  checkAdminRegistration: () => Promise<boolean>;
  setForceLogin: (force: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forceLogin, setForceLogin] = useState(true); // Always start with force login
  const { toast } = useToast();
  const { authenticate: authenticateTraccar } = useTraccarAuth();

  // Check if admin registration is allowed (allows up to 2 admin accounts)
  const checkAdminRegistration = async (): Promise<boolean> => {
    try {
      // Count existing admin accounts
      const { collection, getDocs } = await import('firebase/firestore');
      const adminsSnapshot = await getDocs(collection(db, 'admins'));
      const adminCount = adminsSnapshot.size;
      
      // Allow registration if less than 2 admin accounts exist
      const maxAdmins = 2;
      const registrationAllowed = adminCount < maxAdmins;
      
      console.log(`📊 Admin count: ${adminCount}/${maxAdmins} - Registration allowed: ${registrationAllowed}`);
      
      return registrationAllowed;
    } catch (error) {
      console.error('Error checking admin registration:', error);
      return false;
    }
  };

  // Load admin user data when Firebase user changes
  const loadAdminUser = async (firebaseUser: User) => {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data() as AdminUser;
        setAdminUser(adminData);
      } else {
        setAdminUser(null);
      }
    } catch (error) {
      console.error('Error loading admin user:', error);
      setAdminUser(null);
    }
  };

  // Listen for authentication state changes
  useEffect(() => {
    // Clear any existing sessions when the app starts
    const clearExistingSessions = async () => {
      try {
        // Check if there's an existing Firebase user
        const currentUser = auth.currentUser;
        if (currentUser) {
          console.log('🔒 Clearing existing Firebase session on app start');
          await signOut(auth);
          
          // Clear any stored session data
          if (typeof window !== 'undefined') {
            // Clear Firebase-specific storage
            const firebaseKeys = Object.keys(localStorage).filter(key => 
              key.startsWith('firebase:') || 
              key.startsWith('firebaseLocalStorageDb') ||
              key.includes('firebase')
            );
            firebaseKeys.forEach(key => localStorage.removeItem(key));
          }
        }
      } catch (error) {
        console.warn('Warning: Could not clear existing session:', error);
      }
    };

    // Handle browser refresh - clear sessions
    const handleBeforeUnload = () => {
      console.log('🔄 Browser refresh detected - clearing sessions');
      // Clear Firebase-specific storage on refresh
      if (typeof window !== 'undefined') {
        const firebaseKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('firebase:') || 
          key.startsWith('firebaseLocalStorageDb') ||
          key.includes('firebase')
        );
        firebaseKeys.forEach(key => localStorage.removeItem(key));
      }
    };

    // Add refresh listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clear sessions first, then set up auth listener
    clearExistingSessions().then(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        
        if (firebaseUser && !forceLogin) {
          // Only auto-load admin user if force login is disabled
          await loadAdminUser(firebaseUser);
        } else {
          setAdminUser(null);
        }
        
        setIsLoading(false);
      });

      return unsubscribe;
    });

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [forceLogin]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is an admin
      const adminDoc = await getDoc(doc(db, 'admins', userCredential.user.uid));
      if (!adminDoc.exists()) {
        await signOut(auth);
        throw new Error('Access denied. Admin privileges required.');
      }

      const adminData = adminDoc.data() as AdminUser;
      if (!adminData.isActive) {
        await signOut(auth);
        throw new Error('Account is deactivated. Contact the system administrator.');
      }

      // Set admin user data first
      setAdminUser(adminData);
      
      // Disable force login after successful authentication
      setForceLogin(false);

      toast({
        title: "Success",
        description: `Welcome back, ${adminData.name}!`,
      });

      // Authenticate with Traccar AFTER successful login and user data loading
      // Use setTimeout to ensure this happens after the current execution cycle
      setTimeout(async () => {
        try {
          console.log('🔐 Authenticating with Traccar in background...');
          await authenticateTraccar();
          console.log('✅ Traccar authentication successful');
        } catch (error) {
          console.warn('⚠️ Traccar authentication failed:', error);
          // Don't show error to user - this is background process
        }
      }, 100);

    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('user-not-found')) {
          errorMessage = 'User not found. Please check your email.';
        } else if (error.message.includes('wrong-password')) {
          errorMessage = 'Incorrect password. Please try again.';
        } else if (error.message.includes('too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.message.includes('Access denied')) {
          errorMessage = error.message;
        } else if (error.message.includes('Account is deactivated')) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register admin function (allows up to 2 admin accounts)
  const registerAdmin = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      
      // Check if admin registration is allowed
      const registrationAllowed = await checkAdminRegistration();
      if (!registrationAllowed) {
        throw new Error('Admin registration is not allowed. Maximum number of admin accounts (2) has been reached.');
      }

      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Determine admin role based on existing count
      const { collection, getDocs } = await import('firebase/firestore');
      const adminsSnapshot = await getDocs(collection(db, 'admins'));
      const adminCount = adminsSnapshot.size;
      
      // Create admin document
      const adminData: AdminUser = {
        uid: userCredential.user.uid,
        email: email,
        role: adminCount === 0 ? 'owner' : 'admin', // First admin is owner, others are admin
        name: name,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      await setDoc(doc(db, 'admins', userCredential.user.uid), adminData);
      
      // Update registration status
      await setDoc(doc(db, 'system', 'admin_registration'), {
        registrationAllowed: adminCount + 1 < 2, // Allow more if under limit
        registeredAt: new Date().toISOString(),
        registeredBy: userCredential.user.uid,
        adminCount: adminCount + 1,
        maxAdmins: 2,
      });

      setAdminUser(adminData);
      
      // Disable force login after successful registration
      setForceLogin(false);
      
      toast({
        title: "Success",
        description: `Welcome, ${name}! Your ${adminData.role} account has been created.`,
      });

      // Authenticate with Traccar AFTER successful registration and user data loading
      // Use setTimeout to ensure this happens after the current execution cycle
      setTimeout(async () => {
        try {
          console.log('🔐 Authenticating with Traccar in background...');
          await authenticateTraccar();
          console.log('✅ Traccar authentication successful');
        } catch (error) {
          console.warn('⚠️ Traccar authentication failed:', error);
          // Don't show error to user - this is background process
        }
      }, 100);
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('email-already-in-use')) {
          errorMessage = 'An account with this email already exists.';
        } else if (error.message.includes('weak-password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (error.message.includes('invalid-email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Admin registration is not allowed')) {
          errorMessage = error.message;
        } else if (error.message.includes('Maximum number of admin accounts')) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear session function - completely clears all authentication state
  const clearSession = async () => {
    try {
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear all local state
      setUser(null);
      setAdminUser(null);
      setForceLogin(true);
      
      // Clear any stored session data
      if (typeof window !== 'undefined') {
        // Clear localStorage and sessionStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear any Firebase-specific storage
        const firebaseKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('firebase:') || 
          key.startsWith('firebaseLocalStorageDb') ||
          key.includes('firebase')
        );
        firebaseKeys.forEach(key => localStorage.removeItem(key));
      }
      
      toast({
        title: "Session Cleared",
        description: "All sessions have been cleared. Please log in again.",
      });
      
      console.log('🔒 Session completely cleared - user must login again');
    } catch (error) {
      console.error('Error clearing session:', error);
      toast({
        title: "Error",
        description: "Failed to clear session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setAdminUser(null);
      setForceLogin(true); // Re-enable force login after logout
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const value: AuthContextType = {
    user,
    adminUser,
    isLoading,
    isAdmin: !!adminUser,
    isOwner: adminUser?.role === 'owner',
    forceLogin,
    login,
    registerAdmin,
    logout,
    clearSession,
    checkAdminRegistration,
    setForceLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

