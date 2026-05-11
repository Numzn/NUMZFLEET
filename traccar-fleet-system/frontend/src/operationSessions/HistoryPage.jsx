import { Navigate } from 'react-router-dom';

/** History is shown on the operations hub; keep route for bookmarks. */
const HistoryPage = () => (
  <Navigate to="/fleet/operation-sessions" replace />
);

export default HistoryPage;
