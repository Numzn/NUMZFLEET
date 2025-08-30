import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LoginHeader, 
  LoginCard, 
  LoginFooter, 
  AnimatedBackground 
} from '@/components/auth';

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  const handleLogin = async (username: string, password: string) => {
    try {
      await login(username, password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative">
      <AnimatedBackground />
      
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-sm">
        <LoginHeader />
        <LoginCard onSubmit={handleLogin} isLoading={isLoading} />
        <LoginFooter />
      </div>
    </div>
  );
}

