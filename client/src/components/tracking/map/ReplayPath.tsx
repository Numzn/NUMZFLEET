import React, { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import { getEfficiencyScore, getColorFromScore } from '@/utils/efficiency-scoring';

interface ReplayPathProps {
  positions: any[];
  currentPosition: any;
  className?: string;
}

export const ReplayPath: React.FC<ReplayPathProps> = ({
  positions,
  currentPosition,
  className = ''
}) => {
  const map = useMap();

  // Calculate efficiency path segments
  const pathSegments = React.useMemo(() => {
    if (!positions || positions.length < 2) return [];

    const segments = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const current = positions[i];
      const next = positions[i + 1];
      
      const score = getEfficiencyScore(current, next);
      const color = getColorFromScore(score);
      
      segments.push({
        positions: [[current.latitude, current.longitude], [next.latitude, next.longitude]],
        color,
        score
      });
    }
    return segments;
  }, [positions]);

  // Fit map to show all positions when data loads
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = positions.reduce((acc: any, pos: any) => {
        return [
          [Math.min(acc[0][0], pos.latitude), Math.min(acc[0][1], pos.longitude)],
          [Math.max(acc[1][0], pos.latitude), Math.max(acc[1][1], pos.longitude)]
        ];
      }, [[90, 180], [-90, -180]]);

      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [positions, map]);

  if (!positions || positions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Efficiency Path Segments */}
      {pathSegments.map((segment, index) => (
        <Polyline
          key={index}
          positions={segment.positions}
          color={segment.color}
          weight={4}
          opacity={0.8}
        />
      ))}

      {/* Start Position Marker */}
      {positions.length > 0 && (
        <Polyline
          positions={[[positions[0].latitude, positions[0].longitude]]}
          color="#10b981"
          weight={8}
          opacity={1}
        />
      )}

      {/* End Position Marker */}
      {positions.length > 1 && (
        <Polyline
          positions={[[positions[positions.length - 1].latitude, positions[positions.length - 1].longitude]]}
          color="#ef4444"
          weight={8}
          opacity={1}
        />
      )}
    </>
  );
};


