'use client';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface Plat { id: string; nom: string; actif: boolean; }
interface PlanningEntry { jour_semaine: number; position: number; plat_id: string; }

interface Props {
  plats: Plat[];
  planning: PlanningEntry[];
  onChange: (entries: PlanningEntry[]) => void;
}

export function WeeklyPlanningGrid({ plats, planning, onChange }: Props) {
  const getValue = (jour: number, pos: number) =>
    planning.find((e) => e.jour_semaine === jour && e.position === pos)?.plat_id || '';

  const handleChange = (jour: number, pos: number, plat_id: string) => {
    const next = planning.filter((e) => !(e.jour_semaine === jour && e.position === pos));
    if (plat_id) next.push({ jour_semaine: jour, position: pos, plat_id });
    onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-gray-500 font-medium w-28">Jour</th>
            {[1, 2, 3].map((p) => (
              <th key={p} className="px-3 py-2 text-center text-gray-500 font-medium">Plat {p}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {JOURS.map((jour, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-700">{jour}</td>
              {[1, 2, 3].map((pos) => (
                <td key={pos} className="px-3 py-2">
                  <select
                    value={getValue(idx, pos)}
                    onChange={(e) => handleChange(idx, pos, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">— Aucun —</option>
                    {plats.filter((p) => p.actif).map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
