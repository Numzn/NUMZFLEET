import React from 'react';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { useReplay } from '@/hooks/use-replay';
import { historyApi } from '@/lib/history-api';

export const DebugReplay: React.FC = () => {
  const { mode, selectedDeviceId, replayData } = useTrackingMode();
  const { replayData: hookData, isLoading, error } = useReplay(selectedDeviceId);

  const testHistoryAPI = async () => {
    if (!selectedDeviceId) return;
    
    console.log('🧪 Testing History API for device:', selectedDeviceId);
    try {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const to = new Date();
      const positions = await historyApi.getHistoricalPositions(selectedDeviceId, from, to);
      console.log('🧪 History API test result:', positions.length, 'positions');
      alert(`History API test: ${positions.length} positions found`);
    } catch (error) {
      console.error('🧪 History API test error:', error);
      alert(`History API test error: ${error}`);
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs z-50 max-w-sm">
      <h3 className="font-bold mb-2">🐛 Replay Debug</h3>
      <div className="space-y-1">
        <div>Mode: <span className="text-yellow-400">{mode}</span></div>
        <div>Selected Device: <span className="text-yellow-400">{selectedDeviceId || 'None'}</span></div>
        <div>Context Positions: <span className="text-yellow-400">{replayData.positions.length}</span></div>
        <div>Hook Positions: <span className="text-yellow-400">{hookData?.positions?.length || 0}</span></div>
        <div>Hook Data Exists: <span className="text-yellow-400">{hookData ? 'Yes' : 'No'}</span></div>
        <div>Loading: <span className="text-yellow-400">{isLoading ? 'Yes' : 'No'}</span></div>
        <div>Error: <span className="text-red-400">{error || 'None'}</span></div>
        <div>Current Time: <span className="text-yellow-400">{replayData.currentTime?.toLocaleTimeString() || 'None'}</span></div>
        <div>Is Playing: <span className="text-yellow-400">{replayData.isPlaying ? 'Yes' : 'No'}</span></div>
        <div>Hook Data Type: <span className="text-yellow-400">{typeof hookData}</span></div>
        <button 
          onClick={testHistoryAPI}
          className="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          disabled={!selectedDeviceId}
        >
          Test History API
        </button>
      </div>
    </div>
  );
};
