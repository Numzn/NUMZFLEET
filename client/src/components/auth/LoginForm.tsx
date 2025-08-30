import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
}

export function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    try {
      await onSubmit(username, password);
    } catch (error) {
      // Error is handled by parent
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username Field */}
      <div className="space-y-2">
        <Label htmlFor="username" className="text-white font-medium text-sm">
          Username or Email
        </Label>
        <div className="relative group">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-300 group-hover:text-blue-200 transition-colors" />
          <Input
            id="username"
            type="text"
            placeholder="Enter your username or email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-10 h-10 bg-white/10 border-white/20 text-white placeholder-blue-200/60 focus:border-blue-400/50 focus:ring-blue-400/20 hover:border-white/30 transition-all duration-200 text-sm"
            required
            disabled={isLoading}
          />
        </div>
      </div>
      
      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-white font-medium text-sm">
          Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-300 group-hover:text-blue-200 transition-colors" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 h-10 bg-white/10 border-white/20 text-white placeholder-blue-200/60 focus:border-blue-400/50 focus:ring-blue-400/20 hover:border-white/30 transition-all duration-200 text-sm"
            required
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Login Button */}
      <Button 
        type="submit" 
        className="w-full h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-6 transform hover:scale-[1.02] active:scale-[0.98]" 
        disabled={isLoading || !username || !password}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Signing in...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        )}
      </Button>
    </form>
  );
}
