import { Navigate } from 'react-router-dom';
import { useTechnician } from '../util/permissions';

export default function TechnicianRoute({ children }) {
  const technician = useTechnician();
  if (!technician) {
    return <Navigate to="/map" replace />;
  }
  return children;
}
