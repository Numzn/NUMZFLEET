import { Navigate, useParams } from 'react-router-dom';

/**
 * Opening a driver now leads to that person's profile, so this route only
 * forwards. The driver-anchored profile resolves whether the driver belongs to
 * someone with an account and sends the viewer to the right place.
 *
 * Kept so existing links and bookmarks to /fleet/drivers/:id still land
 * somewhere real.
 */
export default function FleetDriverPage() {
  const { id } = useParams();
  return <Navigate to={id ? `/settings/people/driver/${id}` : '/fleet/drivers'} replace />;
}
