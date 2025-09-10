import L from "leaflet";

// Create Google Maps style vehicle icons
export const createVehicleIcon = (status: string, isOnline: boolean, deviceName?: string) => {
  const color = isOnline ? '#4285F4' : '#EA4335'; // Google Maps blue for online, red for offline
  const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
  
  // Create Google Maps style marker with device name and status
  const svgIcon = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      ${deviceName ? `
        <div style="
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 2px;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        " title="${deviceName}">
          ${deviceName}
        </div>
      ` : ''}
      
      <!-- Google Maps style marker -->
      <div style="position: relative;">
        <!-- Main marker body -->
        <div style="
          width: 32px;
          height: 32px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">
          <!-- Inner circle -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 6px;
              height: 6px;
              background: ${color};
              border-radius: 50%;
            "></div>
          </div>
        </div>
        
        <!-- Status text below marker -->
        <div style="
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 4px;
          background: ${color};
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 9px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          border: 1px solid white;
        ">
          ${statusText}
        </div>
        
        <!-- Pulse animation for online devices -->
        ${isOnline ? `
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 2px solid ${color};
            border-radius: 50%;
            animation: pulse 2s infinite;
            opacity: 0.6;
          "></div>
        ` : ''}
      </div>
    </div>
  `;
  
  return new L.DivIcon({
    html: svgIcon,
    className: 'google-maps-style-icon',
    iconSize: [32, deviceName ? 80 : 50], // Adjust size for name and status
    iconAnchor: [16, deviceName ? 70 : 40], // Adjust anchor point
  });
};

// Fallback icon for compatibility
export const vehicleIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
