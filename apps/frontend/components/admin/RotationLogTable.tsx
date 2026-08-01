'use client';

interface LogRow {
  id: string;
  date_jour: string;
  statut: 'succes' | 'echec';
  message?: string;
  executed_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function RotationLogTable({ logs }: { logs: LogRow[] }) {
  if (!logs.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Aucun journal disponible.</p>
      </div>
    );
  }

  const succes = logs.filter(l => l.statut === 'succes').length;
  const echec  = logs.filter(l => l.statut === 'echec').length;

  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total rotations</p>
        </div>
        <div className="bg-green-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{succes}</p>
          <p className="text-xs text-green-600 mt-0.5">Succès</p>
        </div>
        <div className="bg-red-50 rounded-xl px-4 py-3 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-red-600">{echec}</p>
          <p className="text-xs text-red-500 mt-0.5">Échecs</p>
        </div>
      </div>

      {/* Tableau scrollable */}
      <div className="swipe-x rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm" style={{ minWidth: '520px' }}>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date rotation', 'Statut', 'Message', 'Exécuté à'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${log.statut === 'echec' ? 'bg-red-50/60' : ''}`}>
                <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                  {log.date_jour}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    log.statut === 'succes'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${log.statut === 'succes' ? 'bg-green-500' : 'bg-red-500'}`} />
                    {log.statut === 'succes' ? 'Succès' : 'Échec'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-500 max-w-xs">
                  {log.message
                    ? <span className="block truncate" title={log.message}>{log.message}</span>
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                  {fmtDate(log.executed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
