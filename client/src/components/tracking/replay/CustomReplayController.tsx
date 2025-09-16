import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface CustomReplayControllerProps {
  data: any;
  onTimeChange: (time: Date) => void;
  onPositionChange: (position: any) => void;
  isPlaying: boolean;
  playbackSpeed: number;
}

export const CustomReplayController: React.FC<CustomReplayControllerProps> = ({
  data,
  onTimeChange,
  onPositionChange,
  isPlaying,
  playbackSpeed
}) => {
  const map = useMap();
  const animationRef = useRef<number>();
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (!data || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      const positions = data.positions;
      const currentIndex = currentIndexRef.current;
      
      if (currentIndex < positions.length) {
        const position = positions[currentIndex];
        onTimeChange(new Date(position.deviceTime));
        onPositionChange(position);
        
        // Move to next position
        currentIndexRef.current = currentIndex + 1;
        
        // Calculate delay based on playback speed
        const nextPosition = positions[currentIndex + 1];
        if (nextPosition) {
          const timeDiff = new Date(nextPosition.deviceTime).getTime() - new Date(position.deviceTime).getTime();
          const delay = Math.max(100, timeDiff / playbackSpeed);
          
          animationRef.current = setTimeout(animate, delay);
        }
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [data, isPlaying, playbackSpeed, onTimeChange, onPositionChange]);

  return null;
};


