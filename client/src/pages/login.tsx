import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, User, Lock, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, registerAdmin, checkAdminRegistration, isLoading } = useAuth();
  const [isRegistrationAllowed, setIsRegistrationAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if admin registration is allowed
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const allowed = await checkAdminRegistration();
        setIsRegistrationAllowed(allowed);
      } catch (error) {
        console.error('Error checking registration:', error);
        setIsRegistrationAllowed(false);
      }
    };
    
    checkRegistration();
  }, [checkAdminRegistration]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      return;
    }
    
    try {
      await login(loginEmail, loginPassword);
    } catch (error) {
      // Error is handled in the auth context
    }
  };

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerPassword || !registerName || !confirmPassword) {
      return;
    }
    
    if (registerPassword !== confirmPassword) {
      return;
    }
    
    try {
      await registerAdmin(registerEmail, registerPassword, registerName);
    } catch (error) {
      // Error is handled in the auth context
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    
    return {
      strength: Math.min(strength, 5),
      label: labels[Math.min(strength - 1, 4)],
      color: colors[Math.min(strength - 1, 4)]
    };
  };

  const passwordStrength = getPasswordStrength(registerPassword);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-900"
        style={{
          backgroundImage: `url('/images/login-background.webp')`
        }}
      >
        {/* Overlay for better readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-2xl">
              NumzFleet
            </h1>
            <p className="text-blue-100 text-base drop-shadow-lg">
              Fleet Management System
            </p>
          </div>

          {/* Main Card - Glass Morphism Effect */}
          <Card className="shadow-2xl border-0 bg-white/10 backdrop-blur-md border border-white/20">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-bold text-white drop-shadow-lg">
                Admin Access
              </CardTitle>
              <CardDescription className="text-blue-100">
                {isRegistrationAllowed === null ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-300"></div>
                    <span className="text-blue-200 text-sm">Checking system status...</span>
                  </div>
                ) : isRegistrationAllowed ? (
                  <div className="flex items-center justify-center gap-2 text-green-300 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Initial setup mode - Create admin account
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-blue-200 text-sm">
                    <Shield className="h-4 w-4" />
                    Admin account exists - Please login
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="px-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2 bg-white/20 backdrop-blur-sm h-10 border border-white/30">
                  <TabsTrigger 
                    value="login" 
                    disabled={isLoading}
                    className="data-[state=active]:bg-white/30 data-[state=active]:text-white transition-all text-sm font-medium"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    disabled={isLoading || isRegistrationAllowed === false}
                    className="data-[state=active]:bg-white/30 data-[state=active]:text-white transition-all text-sm font-medium"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Register
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login" className="space-y-4 mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-white font-medium text-sm drop-shadow-md">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="admin@numzfleet.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-white font-medium text-sm drop-shadow-md">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 h-11 text-sm transition-all border border-white/30 hover:border-white/50 backdrop-blur-sm" 
                      disabled={isLoading || !loginEmail || !loginPassword}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Sign In
                        </div>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register" className="space-y-4 mt-6">
                  {isRegistrationAllowed === false ? (
                    <div className="text-center py-6">
                      <AlertCircle className="h-12 w-12 text-orange-300 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-white mb-2 drop-shadow-md">
                        Registration Disabled
                      </h3>
                      <p className="text-blue-100 text-sm">
                        Maximum number of admin accounts (2) has been reached. Please use the login form to access the system.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-name" className="text-white font-medium text-sm drop-shadow-md">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                          <Input
                            id="register-name"
                            type="text"
                            placeholder="Enter your full name"
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                            className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-email" className="text-white font-medium text-sm drop-shadow-md">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                          <Input
                            id="register-email"
                            type="email"
                            placeholder="admin@numzfleet.com"
                            value={registerEmail}
                            onChange={(e) => setRegisterEmail(e.target.value)}
                            className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="text-white font-medium text-sm drop-shadow-md">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                          <Input
                            id="register-password"
                            type="password"
                            placeholder="Create a strong password"
                            value={registerPassword}
                            onChange={(e) => setRegisterPassword(e.target.value)}
                            className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                            required
                            disabled={isLoading}
                          />
                        </div>
                        
                        {/* Password strength indicator */}
                        {registerPassword && (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <div
                                  key={level}
                                  className={`h-1 flex-1 rounded transition-all ${
                                    level <= passwordStrength.strength 
                                      ? passwordStrength.color 
                                      : 'bg-white/20'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className={`text-xs font-medium drop-shadow-md ${
                              passwordStrength.strength >= 4 ? 'text-green-300' : 
                              passwordStrength.strength >= 3 ? 'text-blue-300' : 
                              passwordStrength.strength >= 2 ? 'text-yellow-300' : 'text-red-300'
                            }`}>
                              {passwordStrength.label}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-white font-medium text-sm drop-shadow-md">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                          <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-10 bg-white/20 border-white/30 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/30 transition-all h-10 text-sm backdrop-blur-sm"
                            required
                            disabled={isLoading}
                          />
                        </div>
                        
                        {confirmPassword && registerPassword && (
                          <div className="flex items-center gap-2">
                            {confirmPassword === registerPassword ? (
                              <CheckCircle className="h-4 w-4 text-green-300" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-300" />
                            )}
                            <span className={`text-xs font-medium drop-shadow-md ${
                              confirmPassword === registerPassword ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {confirmPassword === registerPassword ? 'Passwords match' : 'Passwords do not match'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Important notice */}
                      <div className="p-4 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          <Shield className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-100">
                            <p className="font-medium mb-1">Important Notice</p>
                            <p>This is the initial admin account setup. Once created, no additional admin accounts can be registered through this interface.</p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 h-11 text-sm transition-all border border-white/30 hover:border-white/50 backdrop-blur-sm" 
                        disabled={
                          isLoading || 
                          !registerEmail || 
                          !registerPassword || 
                          !registerName || 
                          !confirmPassword ||
                          registerPassword !== confirmPassword ||
                          passwordStrength.strength < 3
                        }
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Creating account...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Create Admin Account
                          </div>
                        )}
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-white/80 text-sm drop-shadow-lg">
              © 2024 NumzFleet. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

