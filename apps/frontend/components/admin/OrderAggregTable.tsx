'use client';

interface AggregRow {
  creneau: string;
  type: string;
  nom: string;
  quantite_totale: number;
}

export function OrderAggregTable({ rows }: { rows: AggregRow[] }) {
  if (!rows.length) return <p className="text-gray-400 text-sm text-center py-4">Aucune donnée</p>;

  const creneaux = Array.from(new Set(rows.map((r) => r.creneau))).sort();

  return (
    <div className="overflow-x-auto">
      {creneaux.map((creneau) => {
        const filtered = rows.filter((r) => r.creneau === creneau);
        return (
          <div key={creneau} className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">Créneau {creneau}</h4>
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Article</th>
                  <th className="px-3 py-2 text-left text-gray-500">Type</th>
                  <th className="px-3 py-2 text-right text-gray-500">Quantité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{r.nom}</td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{r.type}</td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600">{r.quantite_totale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
