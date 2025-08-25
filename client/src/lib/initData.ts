import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const sampleVehicles = [
  {
    name: "Toyota Corolla",
    model: "2023",
    type: "sedan",
    registrationNumber: "ABC-123",
    budget: 500,
    isActive: true
  },
  {
    name: "Honda CR-V",
    model: "2022",
    type: "suv",
    registrationNumber: "XYZ-789",
    budget: 700,
    isActive: true
  }
];

const sampleDrivers = [
  {
    name: "John Smith",
    licenseNumber: "DL12345",
    phoneNumber: "555-0123",
    email: "john@example.com",
    isActive: true
  },
  {
    name: "Jane Doe",
    licenseNumber: "DL67890",
    phoneNumber: "555-4567",
    email: "jane@example.com",
    isActive: true
  }
];

const sampleFuelRecords = [
  {
    sessionDate: new Date().toISOString(),
    fuelAmount: 45.5,
    fuelCost: 182,
    currentMileage: 15000,
    fuelEfficiency: 12.5,
    attendant: "Station 1",
    pumpNumber: "P001"
  },
  {
    sessionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    fuelAmount: 40.0,
    fuelCost: 160,
    currentMileage: 14500,
    fuelEfficiency: 12.8,
    attendant: "Station 2",
    pumpNumber: "P002"
  }
];

async function checkIfDataExists() {
  const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
  const driversSnap = await getDocs(collection(db, 'drivers'));
  return !vehiclesSnap.empty || !driversSnap.empty;
}

async function initializeData() {
  try {
    // Check if data already exists
    const hasData = await checkIfDataExists();
    if (hasData) {
      console.log('Data already exists in the database. Skipping initialization.');
      return;
    }

    console.log('Initializing sample data...');

    // Add vehicles
    const vehicles = await Promise.all(
      sampleVehicles.map(vehicle => 
        addDoc(collection(db, 'vehicles'), {
          ...vehicle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      )
    );
    console.log(`Added ${vehicles.length} vehicles`);

    // Add drivers
    const drivers = await Promise.all(
      sampleDrivers.map(driver => 
        addDoc(collection(db, 'drivers'), {
          ...driver,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      )
    );
    console.log(`Added ${drivers.length} drivers`);

    // Add fuel records (one for each vehicle)
    const fuelRecords = await Promise.all(
      vehicles.map((vehicleRef, index) => 
        addDoc(collection(db, 'fuelRecords'), {
          ...sampleFuelRecords[index],
          vehicleId: vehicleRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      )
    );
    console.log(`Added ${fuelRecords.length} fuel records`);

    console.log('Sample data initialization complete!');
  } catch (error) {
    console.error('Error initializing data:', error);
    throw error;
  }
}

// Export for use in development
export { initializeData };
