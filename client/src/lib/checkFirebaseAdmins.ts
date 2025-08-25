import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Check and display all admin accounts in Firebase
 */
export async function checkFirebaseAdmins() {
  try {
    console.log('🔍 Checking Firebase admin accounts...');
    
    // Check admins collection
    const adminsSnapshot = await getDocs(collection(db, 'admins'));
    console.log(`📊 Found ${adminsSnapshot.size} admin account(s) in 'admins' collection`);
    
    if (adminsSnapshot.empty) {
      console.log('❌ No admin accounts found in Firebase');
      return { admins: [], system: null };
    }
    
    const admins = adminsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('👥 Admin Accounts:');
    admins.forEach((admin, index) => {
      console.log(`  ${index + 1}. ${admin.name} (${admin.email})`);
      console.log(`     - Role: ${admin.role}`);
      console.log(`     - Active: ${admin.isActive}`);
      console.log(`     - Created: ${admin.createdAt}`);
      console.log(`     - UID: ${admin.uid}`);
      console.log('');
    });
    
    // Check system collection for registration status
    try {
      const systemDoc = await getDoc(doc(db, 'system', 'admin_registration'));
      if (systemDoc.exists()) {
        const systemData = systemDoc.data();
        console.log('⚙️ System Registration Status:');
        console.log(`  - Registration Allowed: ${systemData.registrationAllowed}`);
        console.log(`  - Admin Count: ${systemData.adminCount || 'N/A'}`);
        console.log(`  - Max Admins: ${systemData.maxAdmins || 'N/A'}`);
        console.log(`  - Registered At: ${systemData.registeredAt}`);
        console.log(`  - Registered By: ${systemData.registeredBy}`);
        console.log('');
        
        return { admins, system: systemData };
      } else {
        console.log('⚙️ No system registration document found');
        return { admins, system: null };
      }
    } catch (error) {
      console.log('⚠️ Could not check system registration status:', error);
      return { admins, system: null };
    }
    
  } catch (error) {
    console.error('❌ Error checking Firebase admins:', error);
    return { admins: [], system: null };
  }
}

/**
 * Check specific admin by email
 */
export async function checkAdminByEmail(email: string) {
  try {
    console.log(`🔍 Checking admin with email: ${email}`);
    
    const adminsSnapshot = await getDocs(collection(db, 'admins'));
    const admin = adminsSnapshot.docs.find(doc => doc.data().email === email);
    
    if (admin) {
      const adminData = admin.data();
      console.log('✅ Admin found:');
      console.log(`  - Name: ${adminData.name}`);
      console.log(`  - Email: ${adminData.email}`);
      console.log(`  - Role: ${adminData.role}`);
      console.log(`  - Active: ${adminData.isActive}`);
      console.log(`  - UID: ${adminData.uid}`);
      console.log(`  - Created: ${adminData.createdAt}`);
      return adminData;
    } else {
      console.log('❌ No admin found with that email');
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking admin by email:', error);
    return null;
  }
}

/**
 * Check Firebase authentication users
 */
export async function checkFirebaseAuthUsers() {
  try {
    console.log('🔍 Checking Firebase Authentication users...');
    
    // Note: This requires admin SDK, but we can check if the current user exists
    const { getAuth, onAuthStateChanged } = await import('firebase/auth');
    const auth = getAuth();
    
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('👤 Current authenticated user:');
          console.log(`  - Email: ${user.email}`);
          console.log(`  - UID: ${user.uid}`);
          console.log(`  - Email Verified: ${user.emailVerified}`);
          console.log(`  - Created: ${user.metadata.creationTime}`);
          console.log(`  - Last Sign In: ${user.metadata.lastSignInTime}`);
        } else {
          console.log('❌ No user currently authenticated');
        }
        unsubscribe();
        resolve(user);
      });
    });
  } catch (error) {
    console.error('❌ Error checking Firebase Auth users:', error);
    return null;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).checkFirebaseAdmins = checkFirebaseAdmins;
  (window as any).checkAdminByEmail = checkAdminByEmail;
  (window as any).checkFirebaseAuthUsers = checkFirebaseAuthUsers;
}




