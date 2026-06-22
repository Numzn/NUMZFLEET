import { Navigate } from 'react-router-dom';

/** Legacy route — daily operations live under FuelOperationsLayout tabs. */
const OperationSessionsPage = () => (
  <Navigate to="/fleet/operation-sessions" replace />
);

export default OperationSessionsPage;
