import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type AdminUser = Database['public']['Tables']['admins']['Row'];

interface AuthContextType {
  user: any | null;
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
  debugAuthState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forceLogin, setForceLogin] = useState(false);
  const { toast } = useToast();

  // Check if admin registration is complete
  const checkAdminRegistration = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Error checking admin registration:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking admin registration:', error);
      return false;
    }
  }, []);

  // Load admin user data with better error handling
  const loadAdminUser = useCallback(async (user: any): Promise<AdminUser | null> => {
    if (!user) {
      setAdminUser(null);
      return null;
    }

    try {
      console.log('🔍 Loading admin user for:', user.email);
      console.log('🔍 User object:', user);
      
      // First try exact email match
      console.log('🔍 Attempting exact email match...');
      let { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', user.email)
        .single();

      console.log('🔍 Exact match result:', { data, error });

      if (error) {
        console.log('⚠️ Exact email match failed, trying partial match...');
        console.log('⚠️ Error details:', error);
        
        // Try partial email match (username part)
        const username = user.email.split('@')[0];
        console.log('🔍 Trying partial match with username:', username);
        
        const { data: partialData, error: partialError } = await supabase
          .from('admins')
          .select('*')
          .ilike('email', `%${username}%`)
          .single();

        console.log('🔍 Partial match result:', { partialData, partialError });

        if (partialError || !partialData) {
          console.error('❌ No admin user found for:', user.email);
          console.error('❌ Partial match error:', partialError);
          setAdminUser(null);
          return null;
        }

        data = partialData;
        console.log('✅ Found admin user by partial match:', data);
      } else {
        console.log('✅ Found admin user by exact match:', data);
      }

      setAdminUser(data);
      return data;
    } catch (error) {
      console.error('❌ Error loading admin user:', error);
      console.error('❌ Error stack:', error.stack);
      setAdminUser(null);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing authentication...');
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            console.log('👤 Found existing session for:', session.user.email);
            setUser(session.user);
            
            // Load admin user
            const adminData = await loadAdminUser(session.user);
            if (adminData) {
              console.log('✅ Admin user loaded successfully');
            } else {
              console.log('⚠️ No admin user found, forcing login');
              setForceLogin(true);
            }
          } else {
            console.log('🔒 No existing session found');
            setForceLogin(true);
          }
          
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
          setForceLogin(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email);
        
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const adminData = await loadAdminUser(session.user);
          if (adminData) {
            setForceLogin(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setAdminUser(null);
          setForceLogin(true);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAdminUser]);

  // Login function with improved error handling
  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    try {
      console.log('🔐 Login attempt for:', usernameOrEmail);
      setIsLoading(true);
      
      // Check if this is the first login (no admins exist)
      const hasAdmins = await checkAdminRegistration();
      console.log('📊 Has admins:', hasAdmins);
      
      if (!hasAdmins) {
        console.log('👑 First-time setup - creating admin account');
        
        // First-time setup - create admin account
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: usernameOrEmail,
          password,
        });

        if (authError) {
          throw authError;
        }

        if (authData.user) {
          // Create admin record with the user's ID
          const { error: adminError } = await supabase
            .from('admins')
            .insert({
              id: authData.user.id, // Use the auth user's ID
              email: authData.user.email!,
              role: 'owner',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (adminError) {
            console.error('❌ Admin creation error:', adminError);
            throw adminError;
          }

          console.log('✅ Admin account created successfully');
          setUser(authData.user);
          setForceLogin(false);
          
          // Load admin user immediately
          await loadAdminUser(authData.user);
          
          toast({
            title: "Admin Account Created",
            description: "Welcome! Your admin account has been set up successfully.",
          });
        }
      } else {
        console.log('🔑 Normal login process');
        
        // Normal login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: usernameOrEmail,
          password,
        });

        if (error) {
          throw error;
        }

        console.log('✅ Login successful for:', data.user.email);
        setUser(data.user);
        setForceLogin(false);
        
        // Load admin user immediately
        const adminData = await loadAdminUser(data.user);
        if (!adminData) {
          throw new Error('Admin user not found. Please contact system administrator.');
        }
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "An error occurred during login.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [checkAdminRegistration, loadAdminUser, toast]);

  // Register admin function
  const registerAdmin = useCallback(async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Create admin record with the user's ID
        const { error: adminError } = await supabase
          .from('admins')
          .insert({
            id: data.user.id, // Use the auth user's ID
            email: data.user.email!,
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (adminError) {
          throw adminError;
        }

        setUser(data.user);
        setForceLogin(false);
        
        // Load admin user immediately
        await loadAdminUser(data.user);
        
        toast({
          title: "Admin Account Created",
          description: "Admin account has been created successfully.",
        });
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadAdminUser, toast]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      
      setUser(null);
      setAdminUser(null);
      setForceLogin(true);
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Failed",
        description: error.message || "An error occurred during logout.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Clear session function
  const clearSession = useCallback(async () => {
    try {
      await logout();
      toast({
        title: "Session Cleared",
        description: "All session data has been cleared.",
      });
    } catch (error) {
      console.error('Clear session error:', error);
      toast({
        title: "Clear Session Error",
        description: "An error occurred while clearing the session.",
        variant: "destructive",
      });
    }
  }, [logout, toast]);

  // Debug function
  const debugAuthState = useCallback(() => {
    console.log('=== 🔍 AUTH STATE DEBUG ===');
    console.log('👤 User:', user?.email || 'null');
    console.log('👑 Admin User:', adminUser?.email || 'null');
    console.log('⏳ Is Loading:', isLoading);
    console.log('🔒 Force Login:', forceLogin);
    console.log('🔑 Is Admin:', adminUser?.role === 'admin' || adminUser?.role === 'owner');
    console.log('👑 Is Owner:', adminUser?.role === 'owner');
    console.log('========================');
  }, [user, adminUser, isLoading, forceLogin]);

  const value: AuthContextType = {
    user,
    adminUser,
    isLoading,
    isAdmin: adminUser?.role === 'admin' || adminUser?.role === 'owner',
    isOwner: adminUser?.role === 'owner',
    forceLogin,
    login,
    registerAdmin,
    logout,
    clearSession,
    checkAdminRegistration,
    setForceLogin,
    debugAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

