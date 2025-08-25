import { doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Utility function to reset admin registration
 * This allows you to register new admin accounts (up to 2)
 */
export async function resetAdminRegistration() {
  try {
    // Delete the system document that controls admin registration
    await deleteDoc(doc(db, 'system', 'admin_registration'));
    console.log('✅ Admin registration has been reset successfully!');
    console.log('You can now register up to 2 admin accounts.');
    return true;
  } catch (error) {
    console.error('❌ Error resetting admin registration:', error);
    return false;
  }
}

/**
 * Utility function to list all existing admin accounts
 */
export async function listAdminAccounts() {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const adminsSnapshot = await getDocs(collection(db, 'admins'));
    
    if (adminsSnapshot.empty) {
      console.log('📋 No admin accounts found in the database.');
      return [];
    }
    
    const admins = adminsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📋 Existing admin accounts:');
    admins.forEach(admin => {
      console.log(`- ${admin.email} (${admin.name}) - Active: ${admin.isActive}`);
    });
    
    return admins;
  } catch (error) {
    console.error('❌ Error listing admin accounts:', error);
    return [];
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).resetAdminRegistration = resetAdminRegistration;
  (window as any).listAdminAccounts = listAdminAccounts;
}
