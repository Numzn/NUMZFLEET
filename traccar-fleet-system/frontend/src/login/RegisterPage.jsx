import { Navigate } from 'react-router-dom';

/**
 * Public self-registration is disabled for NumzTrak SaaS.
 */
const RegisterPage = () => <Navigate to="/login" replace />;

export default RegisterPage;
