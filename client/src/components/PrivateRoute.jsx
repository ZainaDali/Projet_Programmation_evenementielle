import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-slate-800 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
