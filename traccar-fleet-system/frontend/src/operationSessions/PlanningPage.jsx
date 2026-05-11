import { Navigate } from 'react-router-dom';

/** @deprecated Use /fleet/operation-sessions/create */
const PlanningPage = () => (
  <Navigate to="/fleet/operation-sessions/create" replace />
);

export default PlanningPage;
