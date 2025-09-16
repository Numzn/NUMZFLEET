#!/usr/bin/env node

// Test script for coordinate optimization
import { optimizeCoordinates } from './src/algorithms/douglas-peucker.js';

console.log('🧪 Testing Coordinate Optimization...\n');

// Generate test data - a simple route with many points
function generateTestRoute() {
  const points = [];
  const startLat = -15.35; // Lusaka, Zambia
  const startLng = 28.28;
  
  // Create a route with 100 points
  for (let i = 0; i < 100; i++) {
    const lat = startLat + (Math.random() - 0.5) * 0.01; // Small random variations
    const lng = startLng + (Math.random() - 0.5) * 0.01;
    
    points.push({
      id: i,
      deviceId: 123,
      latitude: lat,
      longitude: lng,
      speed: Math.random() * 60, // 0-60 km/h
      course: Math.random() * 360,
      deviceTime: new Date(Date.now() - (100 - i) * 60000).toISOString(), // 1 minute intervals
      serverTime: new Date(Date.now() - (100 - i) * 60000).toISOString(),
      accuracy: Math.random() * 50 + 10, // 10-60 meters
      altitude: 1200 + Math.random() * 100
    });
  }
  
  return points;
}

// Test different optimization levels
const testRoute = generateTestRoute();
console.log(`📊 Generated test route with ${testRoute.length} points\n`);

const testCases = [
  { name: 'Conservative', tolerance: 5, minSpeed: 2 },
  { name: 'Balanced', tolerance: 10, minSpeed: 5 },
  { name: 'Aggressive', tolerance: 25, minSpeed: 10 },
  { name: 'Very Aggressive', tolerance: 50, minSpeed: 15 }
];

testCases.forEach(testCase => {
  console.log(`🔧 Testing ${testCase.name} optimization:`);
  
  const result = optimizeCoordinates(testRoute, {
    tolerance: testCase.tolerance,
    minSpeed: testCase.minSpeed,
    minTimeInterval: 30000,
    maxSpeed: 200,
    minAccuracy: 100,
    preserveStops: true,
    preserveSpeedChanges: true
  });
  
  console.log(`   Original: ${result.originalCount} points`);
  console.log(`   Optimized: ${result.optimizedCount} points`);
  console.log(`   Reduction: ${result.reductionPercentage.toFixed(1)}%`);
  console.log(`   Statistics:`);
  console.log(`     - Accuracy filtered: ${result.statistics.accuracyFiltered}`);
  console.log(`     - Speed filtered: ${result.statistics.speedFiltered}`);
  console.log(`     - Time filtered: ${result.statistics.timeFiltered}`);
  console.log(`     - Douglas-Peucker: ${result.statistics.douglasPeuckerReduced}`);
  console.log('');
});

// Test with real-world scenario - highway drive
console.log('🛣️  Testing highway drive scenario:');
const highwayRoute = [];
const startLat = -15.35;
const startLng = 28.28;

// Create a straight highway route
for (let i = 0; i < 200; i++) {
  const lat = startLat + (i * 0.0001); // Moving north
  const lng = startLng + (i * 0.0001); // Moving east
  
  highwayRoute.push({
    id: i,
    deviceId: 123,
    latitude: lat,
    longitude: lng,
    speed: 80 + Math.random() * 20, // 80-100 km/h
    course: 45, // Northeast
    deviceTime: new Date(Date.now() - (200 - i) * 30000).toISOString(), // 30 second intervals
    serverTime: new Date(Date.now() - (200 - i) * 30000).toISOString(),
    accuracy: 5 + Math.random() * 10, // Good accuracy
    altitude: 1200
  });
}

const highwayResult = optimizeCoordinates(highwayRoute, {
  tolerance: 10,
  minSpeed: 5,
  minTimeInterval: 30000,
  maxSpeed: 200,
  minAccuracy: 100,
  preserveStops: true,
  preserveSpeedChanges: true
});

console.log(`   Highway route: ${highwayResult.originalCount} → ${highwayResult.optimizedCount} points`);
console.log(`   Reduction: ${highwayResult.reductionPercentage.toFixed(1)}%`);
console.log('');

// Test with city driving scenario
console.log('🏙️  Testing city driving scenario:');
const cityRoute = [];
for (let i = 0; i < 150; i++) {
  const lat = startLat + Math.sin(i * 0.1) * 0.001; // Winding route
  const lng = startLng + Math.cos(i * 0.1) * 0.001;
  
  cityRoute.push({
    id: i,
    deviceId: 123,
    latitude: lat,
    longitude: lng,
    speed: i % 10 === 0 ? 0 : 20 + Math.random() * 40, // Frequent stops
    course: (i * 10) % 360,
    deviceTime: new Date(Date.now() - (150 - i) * 20000).toISOString(), // 20 second intervals
    serverTime: new Date(Date.now() - (150 - i) * 20000).toISOString(),
    accuracy: 20 + Math.random() * 30, // Variable accuracy
    altitude: 1200
  });
}

const cityResult = optimizeCoordinates(cityRoute, {
  tolerance: 10,
  minSpeed: 5,
  minTimeInterval: 30000,
  maxSpeed: 200,
  minAccuracy: 100,
  preserveStops: true,
  preserveSpeedChanges: true
});

console.log(`   City route: ${cityResult.originalCount} → ${cityResult.optimizedCount} points`);
console.log(`   Reduction: ${cityResult.reductionPercentage.toFixed(1)}%`);
console.log('');

console.log('✅ Optimization testing complete!');
console.log('\n📈 Key findings:');
console.log('- Highway routes can be optimized more aggressively (straight lines)');
console.log('- City routes need more conservative settings (frequent turns/stops)');
console.log('- Douglas-Peucker algorithm is most effective on straight segments');
console.log('- Speed and time filtering provide additional optimization opportunities');


