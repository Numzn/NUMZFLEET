import React from 'react';
import { UnifiedTrackingView } from '@/components/tracking/UnifiedTrackingView';

const UnifiedMapPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <UnifiedTrackingView height="100vh" />
    </div>
  );
};

export default UnifiedMapPage;


