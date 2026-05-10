import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import dimensions from '../../common/theme/dimensions';
import { map } from '../core/MapView';
import { usePrevious } from '../../reactHelper';
import { useAttributePreference } from '../../common/util/preferences';

const easeInOutCirc = (t) => (
  t < 0.5
    ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
);

const easeOutQuint = (t) => 1 - (1 - t) ** 5;

const MapSelectedDevice = ({ mapReady }) => {
  const currentTime = useSelector((state) => state.devices.selectTime);
  const currentId = useSelector((state) => state.devices.selectedId);
  const previousTime = usePrevious(currentTime);
  const previousId = usePrevious(currentId);

  const selectZoom = useAttributePreference('web.selectZoom', 10);
  const mapFollow = useAttributePreference('mapFollow', false);

  const position = useSelector((state) => state.session.positions[currentId]);

  const previousPosition = usePrevious(position);

  useEffect(() => {
    if (!mapReady) return;

    const positionChanged = position && (!previousPosition || position.latitude !== previousPosition.latitude || position.longitude !== previousPosition.longitude);
    const isSelectionChange = currentId !== previousId || currentTime !== previousTime;
    const isFollowUpdate = mapFollow && positionChanged;

    if ((isSelectionChange || isFollowUpdate) && position) {
      const isPremiumFocus = isSelectionChange;
      map.easeTo({
        center: [position.longitude, position.latitude],
        zoom: Math.max(map.getZoom(), selectZoom),
        offset: [0, -dimensions.popupMapOffset / 2],
        duration: isPremiumFocus ? 1500 : 850,
        easing: isPremiumFocus ? easeInOutCirc : easeOutQuint,
        essential: true,
      });
    }
  }, [currentId, previousId, currentTime, previousTime, mapFollow, position, previousPosition, selectZoom, mapReady]);

  return null;
};

MapSelectedDevice.handlesMapReady = true;

export default MapSelectedDevice;
