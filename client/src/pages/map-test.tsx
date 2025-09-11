import React from 'react';
import { StandaloneMap } from '@/components/tracking/map/StandaloneMap';

/**
 * Map Test Page
 * This page loads the map independently for testing
 * Navigate to /map-test to see the map working
 */
export default function MapTestPage() {
  return <StandaloneMap />;
}
