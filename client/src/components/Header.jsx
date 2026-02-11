import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, LogOut, Circle, Shield } from 'lucide-react';

const Header = ({ connected, user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-800 text-white border-b border-slate-700">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-7 h-7" />
            <span className="font-semibold text-lg">Chat App</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm">
              <Circle
                className={`w-2.5 h-2.5 ${connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
              />
              {connected ? 'Connecté' : 'Déconnecté'}
            </span>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
              <span className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium">{user?.username}</span>
              {user?.role === 'admin' && (
                <Shield className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
