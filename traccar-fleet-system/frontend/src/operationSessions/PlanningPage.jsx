import { Navigate } from 'react-router-dom';

/** @deprecated Use /fleet/operation-sessions/prepare */
const PlanningPage = () => (
  <Navigate to="/fleet/operation-sessions/prepare" replace />
);

export default PlanningPage;
