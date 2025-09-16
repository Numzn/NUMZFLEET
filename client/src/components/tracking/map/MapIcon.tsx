import L from "leaflet";

// Create Google Maps style vehicle icons with accuracy indicators
export const createVehicleIcon = (status: string, isOnline: boolean, deviceName?: string, accuracy?: number | null, accuracyScore?: number) => {
  const color = isOnline ? '#4285F4' : '#EA4335'; // Google Maps blue for online, red for offline
  const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
  
  // Determine accuracy indicator
  const getAccuracyIndicator = () => {
    if (!accuracyScore) return '';
    
    if (accuracyScore >= 80) {
      return '<div style="position: absolute; top: -8px; right: -8px; width: 12px; height: 12px; background: #10B981; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>';
    } else if (accuracyScore >= 60) {
      return '<div style="position: absolute; top: -8px; right: -8px; width: 12px; height: 12px; background: #F59E0B; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>';
    } else {
      return '<div style="position: absolute; top: -8px; right: -8px; width: 12px; height: 12px; background: #EF4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>';
    }
  };
  
  // Create clean, single marker with device name and accuracy indicator
  const svgIcon = `
    <div style="display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1000;">
      <!-- Device name label (the accurate one) -->
      ${deviceName ? `
        <div style="
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 4px;
          white-space: nowrap;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.3);
          backdrop-filter: blur(6px);
          z-index: 1001;
          position: relative;
        " title="${deviceName}">
          ${deviceName}
        </div>
      ` : ''}

      <!-- Single, clean marker -->
      <div style="position: relative;">
        <!-- Main marker body - simplified -->
        <div style="
          width: 24px;
          height: 24px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${getAccuracyIndicator()}
          <!-- Inner dot -->
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      </div>

      <!-- Accuracy radius indicator (if accuracy is available) -->
      ${accuracy && accuracy > 0 ? `
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${Math.min(accuracy * 2, 200)}px;
          height: ${Math.min(accuracy * 2, 200)}px;
          border: 2px solid ${color}40;
          border-radius: 50%;
          background: ${color}20;
          pointer-events: none;
          z-index: 999;
        " title="Accuracy: ±${accuracy}m"></div>
      ` : ''}
    </div>
  `;
  
  // Determine accuracy class
  const getAccuracyClass = () => {
    if (!accuracyScore) return '';
    
    if (accuracyScore >= 80) return 'high-accuracy';
    if (accuracyScore >= 60) return 'medium-accuracy';
    return 'low-accuracy';
  };

  return new L.DivIcon({
    html: svgIcon,
    className: `google-maps-style-icon ${getAccuracyClass()}`,
    iconSize: [24, deviceName ? 60 : 30], // Smaller, cleaner size
    iconAnchor: [12, deviceName ? 50 : 15], // Centered anchor point
    popupAnchor: [0, deviceName ? -55 : -25], // Better popup positioning
  });
};

// Fallback icon for compatibility
export const vehicleIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
