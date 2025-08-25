import { db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Test Firebase permissions and provide solutions
 */
export async function testFirebasePermissions() {
  console.log('🔍 Testing Firebase permissions...');
  
  const tests = [
    {
      name: 'Read admins collection',
      test: async () => {
        try {
          const adminsSnapshot = await getDocs(collection(db, 'admins'));
          console.log(`✅ Can read admins collection: ${adminsSnapshot.size} documents`);
          return true;
        } catch (error) {
          console.log(`❌ Cannot read admins collection: ${error}`);
          return false;
        }
      }
    },
    {
      name: 'Read system collection',
      test: async () => {
        try {
          const systemSnapshot = await getDocs(collection(db, 'system'));
          console.log(`✅ Can read system collection: ${systemSnapshot.size} documents`);
          return true;
        } catch (error) {
          console.log(`❌ Cannot read system collection: ${error}`);
          return false;
        }
      }
    },
    {
      name: 'Write to test document',
      test: async () => {
        try {
          const testDoc = doc(db, 'test', 'permission-test');
          await setDoc(testDoc, {
            timestamp: new Date().toISOString(),
            message: 'Permission test'
          });
          console.log('✅ Can write to database');
          
          // Clean up test document
          await deleteDoc(testDoc);
          console.log('✅ Can delete from database');
          return true;
        } catch (error) {
          console.log(`❌ Cannot write to database: ${error}`);
          return false;
        }
      }
    }
  ];

  const results = [];
  for (const test of tests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    const result = await test.test();
    results.push({ name: test.name, passed: result });
  }

  console.log('\n📊 Permission Test Results:');
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });

  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n🎉 All permission tests passed!');
  } else {
    console.log('\n⚠️ Some permission tests failed. Check Firebase security rules.');
    console.log('\n🔧 To fix this, update your Firebase security rules to:');
    console.log(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents (for development only)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
    `);
  }

  return results;
}

/**
 * Create a simple admin account for testing
 */
export async function createTestAdmin() {
  try {
    console.log('🔧 Creating test admin account...');
    
    const testAdmin = {
      uid: 'test-admin-123',
      email: 'test@numzfleet.com',
      name: 'Test Admin',
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'admins', testAdmin.uid), testAdmin);
    console.log('✅ Test admin created successfully');
    console.log('📧 Email: test@numzfleet.com');
    console.log('🔑 Password: (you can set this in Firebase Auth)');
    
    return testAdmin;
  } catch (error) {
    console.error('❌ Failed to create test admin:', error);
    return null;
  }
}

/**
 * Reset Firebase to initial state
 */
export async function resetFirebaseToInitial() {
  try {
    console.log('🔄 Resetting Firebase to initial state...');
    
    // Delete system registration document
    try {
      await deleteDoc(doc(db, 'system', 'admin_registration'));
      console.log('✅ Deleted system registration document');
    } catch (error) {
      console.log('⚠️ Could not delete system document (may not exist)');
    }
    
    // Delete all admins
    try {
      const adminsSnapshot = await getDocs(collection(db, 'admins'));
      const deletePromises = adminsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${adminsSnapshot.size} admin accounts`);
    } catch (error) {
      console.log('⚠️ Could not delete admin accounts');
    }
    
    console.log('✅ Firebase reset complete. You can now register new admin accounts.');
    return true;
  } catch (error) {
    console.error('❌ Failed to reset Firebase:', error);
    return false;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testFirebasePermissions = testFirebasePermissions;
  (window as any).createTestAdmin = createTestAdmin;
  (window as any).resetFirebaseToInitial = resetFirebaseToInitial;
}




