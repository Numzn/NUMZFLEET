import { app, auth, db } from './firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

/**
 * Comprehensive Firebase diagnostics
 */
export async function runFirebaseDiagnostics() {
  console.log('🔍 Running comprehensive Firebase diagnostics...');
  console.log('===============================================');
  
  const results = {
    app: false,
    auth: false,
    firestore: false,
    permissions: false,
    project: false
  };

  // Test 1: App Configuration
  try {
    console.log('\n1️⃣ Testing Firebase App Configuration...');
    if (app) {
      console.log('✅ Firebase app is initialized');
      console.log(`   - Project ID: ${app.options.projectId}`);
      console.log(`   - Auth Domain: ${app.options.authDomain}`);
      console.log(`   - API Key: ${app.options.apiKey?.substring(0, 10)}...`);
      results.app = true;
    } else {
      console.log('❌ Firebase app is not initialized');
    }
  } catch (error) {
    console.log('❌ Error testing app configuration:', error);
  }

  // Test 2: Authentication
  try {
    console.log('\n2️⃣ Testing Firebase Authentication...');
    if (auth) {
      console.log('✅ Firebase Auth is initialized');
      
      // Test anonymous auth
      try {
        await signInAnonymously(auth);
        console.log('✅ Anonymous authentication works');
        results.auth = true;
      } catch (authError) {
        console.log('❌ Anonymous authentication failed:', authError);
        if (authError.code === 'auth/configuration-not-found') {
          console.log('🔧 This suggests the Firebase project is not properly configured');
          console.log('   - Check if the project exists in Firebase Console');
          console.log('   - Verify the API key is correct');
          console.log('   - Ensure Authentication is enabled in the project');
        }
      }
    } else {
      console.log('❌ Firebase Auth is not initialized');
    }
  } catch (error) {
    console.log('❌ Error testing authentication:', error);
  }

  // Test 3: Firestore
  try {
    console.log('\n3️⃣ Testing Firestore Database...');
    if (db) {
      console.log('✅ Firestore is initialized');
      
      // Test basic read operation
      try {
        const testCollection = collection(db, '_test_diagnostics');
        console.log('✅ Can access Firestore collections');
        results.firestore = true;
      } catch (firestoreError) {
        console.log('❌ Firestore access failed:', firestoreError);
      }
    } else {
      console.log('❌ Firestore is not initialized');
    }
  } catch (error) {
    console.log('❌ Error testing Firestore:', error);
  }

  // Test 4: Permissions
  try {
    console.log('\n4️⃣ Testing Database Permissions...');
    const tests = [
      {
        name: 'Read admins collection',
        test: async () => {
          const adminsSnapshot = await getDocs(collection(db, 'admins'));
          return adminsSnapshot.size;
        }
      },
      {
        name: 'Write test document',
        test: async () => {
          const testDoc = doc(db, '_test_diagnostics', 'permission-test');
          await setDoc(testDoc, { timestamp: new Date().toISOString() });
          await deleteDoc(testDoc);
          return true;
        }
      }
    ];

    for (const test of tests) {
      try {
        await test.test();
        console.log(`✅ ${test.name} - PASSED`);
      } catch (error) {
        console.log(`❌ ${test.name} - FAILED:`, error);
      }
    }
    
    results.permissions = true;
  } catch (error) {
    console.log('❌ Error testing permissions:', error);
  }

  // Test 5: Project Status
  try {
    console.log('\n5️⃣ Checking Project Status...');
    console.log('📋 To verify your Firebase project:');
    console.log('   1. Go to https://console.firebase.google.com');
    console.log('   2. Check if project "numzfleet" exists');
    console.log('   3. Verify Authentication is enabled');
    console.log('   4. Verify Firestore Database is created');
    console.log('   5. Check if the API key is correct');
    results.project = true;
  } catch (error) {
    console.log('❌ Error checking project status:', error);
  }

  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log('======================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}`);
  });

  const allPassed = Object.values(results).every(r => r);
  if (allPassed) {
    console.log('\n🎉 All tests passed! Firebase is properly configured.');
  } else {
    console.log('\n⚠️ Some tests failed. See recommendations below.');
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('==================');
    
    if (!results.auth) {
      console.log('• Enable Authentication in Firebase Console');
      console.log('• Go to Authentication > Sign-in method');
      console.log('• Enable Email/Password authentication');
    }
    
    if (!results.firestore) {
      console.log('• Create Firestore Database in Firebase Console');
      console.log('• Go to Firestore Database > Create database');
      console.log('• Choose "Start in test mode" for development');
    }
    
    if (!results.permissions) {
      console.log('• Update Firestore security rules');
      console.log('• Go to Firestore Database > Rules');
      console.log('• Use test mode rules for development');
    }
  }

  return results;
}

/**
 * Quick Firebase project verification
 */
export async function verifyFirebaseProject() {
  console.log('🔍 Verifying Firebase project configuration...');
  
  try {
    // Test basic connectivity
    const testDoc = doc(db, '_verification', 'test');
    await setDoc(testDoc, { verified: true, timestamp: new Date().toISOString() });
    await deleteDoc(testDoc);
    
    console.log('✅ Firebase project is accessible');
    console.log('✅ Read/write permissions are working');
    console.log('✅ Project configuration is correct');
    
    return true;
  } catch (error) {
    console.error('❌ Firebase project verification failed:', error);
    
    if (error.code === 'auth/configuration-not-found') {
      console.log('\n🔧 SOLUTION:');
      console.log('1. Go to Firebase Console: https://console.firebase.google.com');
      console.log('2. Create a new project or select existing project');
      console.log('3. Enable Authentication (Authentication > Sign-in method)');
      console.log('4. Create Firestore Database (Firestore Database > Create database)');
      console.log('5. Update your app configuration with the correct project details');
    }
    
    return false;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).runFirebaseDiagnostics = runFirebaseDiagnostics;
  (window as any).verifyFirebaseProject = verifyFirebaseProject;
}




