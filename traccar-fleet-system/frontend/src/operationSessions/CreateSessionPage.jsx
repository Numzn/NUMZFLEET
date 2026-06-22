import { Navigate } from 'react-router-dom';

/** @deprecated Redirect to the Prepare flow */
const CreateSessionPage = () => (
  <Navigate to="/fleet/operation-sessions/prepare" replace />
);

export default CreateSessionPage;
