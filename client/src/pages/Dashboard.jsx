import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PollsView from '../components/PollsView';
import ActivityLog from '../components/ActivityLog';

const Dashboard = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);

  const addActivity = (message, type = 'system') => {
    setActivities(prev => [{ id: Date.now(), message, type, time: new Date().toLocaleTimeString('fr-FR') }, ...prev].slice(0, 50));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header connected={true} user={user} />
      <div className="container mx-auto px-6 py-6">
        <div className="flex gap-6">
          <Sidebar />
          <main className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <PollsView addActivity={addActivity} />
          </main>
          {/* ActivityLog is kept but will only show local actions for now */}
          <ActivityLog activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
