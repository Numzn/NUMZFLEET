import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forceLogin, setForceLogin] = useState(false);
  const { toast } = useToast();

  // Check if admin registration is complete
  const checkAdminRegistration = async (): Promise<boolean> => {
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
  };

  // Load admin user data
  const loadAdminUser = async (user: any) => {
    if (!user) {
      setAdminUser(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) {
        console.error('Error loading admin user:', error);
        setAdminUser(null);
        return;
      }

      setAdminUser(data);
    } catch (error) {
      console.error('Error loading admin user:', error);
      setAdminUser(null);
    }
  };

  // Listen for authentication state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadAdminUser(session.user);
        } else {
          setAdminUser(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Login function - supports both username and email login
  const login = async (usernameOrEmail: string, password: string) => {
    try {
      console.log('Login attempt for:', usernameOrEmail);
      setIsLoading(true);
      
      // Check if this is the first login (no admins exist)
      const hasAdmins = await checkAdminRegistration();
      console.log('Has admins:', hasAdmins);
      
      if (!hasAdmins) {
        // First-time setup - create admin account
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: usernameOrEmail,
          password,
        });

        if (authError) {
          throw authError;
        }

        if (authData.user) {
          // Create admin record
          const { error: adminError } = await supabase
            .from('admins')
            .insert({
              email: authData.user.email!,
              role: 'owner',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (adminError) {
            throw adminError;
          }

          setUser(authData.user);
          setForceLogin(false);
          console.log('Admin account created, user set:', authData.user);
          toast({
            title: "Admin Account Created",
            description: "Welcome! Your admin account has been set up successfully.",
          });
        }
      } else {
        // Normal login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: usernameOrEmail,
          password,
        });

        if (error) {
          throw error;
        }

        console.log('Login successful, user:', data.user);
        setUser(data.user);
        setForceLogin(false);
        
        // Manually load admin user after login
        await loadAdminUser(data.user);
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "An error occurred during login.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register admin function
  const registerAdmin = async (email: string, password: string, name: string) => {
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
        // Create admin record
        const { error: adminError } = await supabase
          .from('admins')
                      .insert({
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
  };

  // Logout function
  const logout = async () => {
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
  };

  // Clear session function
  const clearSession = async () => {
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
  };

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

