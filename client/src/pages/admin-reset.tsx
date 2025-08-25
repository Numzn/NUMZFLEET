import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Users, Trash2, Database } from 'lucide-react';
import { resetAdminRegistration, listAdminAccounts } from '@/lib/resetAdminRegistration';
import { checkFirebaseAdmins, checkAdminByEmail, checkFirebaseAuthUsers } from '@/lib/checkFirebaseAdmins';

export default function AdminResetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<any[]>([]);

  const handleListAccounts = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const accounts = await listAdminAccounts();
      setAdminAccounts(accounts);
      setMessage({
        type: 'info',
        text: `Found ${accounts.length} admin account(s) in the database.`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to list admin accounts. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRegistration = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const success = await resetAdminRegistration();
      if (success) {
                 setMessage({
           type: 'success',
           text: 'Admin registration has been reset successfully! You can now register up to 2 admin accounts.'
         });
        // Refresh the admin accounts list
        await handleListAccounts();
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to reset admin registration. Please try again.'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'An error occurred while resetting admin registration.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckFirebase = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      console.log('🔍 Starting Firebase admin check...');
      await checkFirebaseAdmins();
      await checkFirebaseAuthUsers();
      
      setMessage({
        type: 'info',
        text: 'Firebase admin check completed! Check the browser console for detailed information.'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to check Firebase admins. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            <CardTitle>Admin Account Management</CardTitle>
          </div>
          <CardDescription>
            Reset admin registration or view existing admin accounts (supports up to 2 admin accounts)
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Message Display */}
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

                     {/* Action Buttons */}
           <div className="flex gap-4 flex-wrap">
             <Button
               onClick={handleListAccounts}
               disabled={isLoading}
               variant="outline"
               className="flex items-center gap-2"
             >
               <Users className="h-4 w-4" />
               List Admin Accounts
             </Button>
             
             <Button
               onClick={handleCheckFirebase}
               disabled={isLoading}
               variant="outline"
               className="flex items-center gap-2"
             >
               <Database className="h-4 w-4" />
               Check Firebase
             </Button>
             
             <Button
               onClick={handleResetRegistration}
               disabled={isLoading}
               variant="destructive"
               className="flex items-center gap-2"
             >
               <Trash2 className="h-4 w-4" />
               Reset Admin Registration
             </Button>
           </div>

          {/* Admin Accounts List */}
          {adminAccounts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Existing Admin Accounts:</h3>
              <div className="space-y-2">
                {adminAccounts.map((admin, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={admin.isActive ? 'default' : 'secondary'}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{admin.role}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Instructions:</h4>
                         <ul className="text-sm space-y-1">
               <li>• Use "List Admin Accounts" to see existing admin accounts</li>
               <li>• Use "Reset Admin Registration" to allow new admin registration</li>
               <li>• After resetting, you can register up to 2 admin accounts on the login page</li>
               <li>• First admin becomes "owner", second becomes "admin"</li>
               <li>• This will only reset the registration lock, not delete existing accounts</li>
             </ul>
          </div>

          {/* Navigation */}
          <div className="text-center">
            <Button
              onClick={() => window.location.href = '/login'}
              variant="outline"
            >
              Go to Login Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
