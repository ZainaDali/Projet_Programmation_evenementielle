import { Activity } from 'lucide-react';

const ActivityLog = ({ activities }) => {
  return (
    <aside className="w-72 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center gap-2">
        <Activity className="w-5 h-5 text-slate-600" />
        <span className="font-semibold text-slate-800">Activité</span>
      </div>
      <div className="h-[500px] overflow-y-auto p-3">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucune activité</p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-3 rounded-lg text-sm border-l-2 ${
                  activity.type === 'online'
                    ? 'bg-slate-50 border-l-green-500 text-slate-700'
                    : activity.type === 'offline'
                    ? 'bg-slate-50 border-l-red-400 text-slate-700'
                    : 'bg-slate-50 border-l-slate-600 text-slate-700'
                }`}
              >
                <p>{activity.message}</p>
                <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ActivityLog;
