import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { LoginForm } from './LoginForm';

interface LoginCardProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
}

export function LoginCard({ onSubmit, isLoading }: LoginCardProps) {
  return (
    <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
      <CardHeader className="text-center pb-4">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-lg mb-3">
          <Shield className="h-5 w-5 text-blue-300" />
        </div>
        <CardTitle className="text-xl font-bold text-white">
          Admin Access
        </CardTitle>
        <CardDescription className="text-blue-200 text-sm">
          Sign in to your dashboard
        </CardDescription>
      </CardHeader>
      
      <CardContent className="px-6 pb-6">
        <LoginForm onSubmit={onSubmit} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
