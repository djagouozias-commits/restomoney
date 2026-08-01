'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { WeeklyPlanningGrid } from '@/components/admin/WeeklyPlanningGrid';
import Link from 'next/link';

export default function PlanningPage() {
  const [plats, setPlats] = useState<any[]>([]);
  const [planning, setPlanning] = useState<any[]>([]);
  const [surcharges, setSurcharges] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Surcharge form
  const [sDate, setSDate] = useState('');
  const [sPlats, setSPlats] = useState(['', '', '']);

  const loadAll = () => Promise.all([
    apiFetch<any[]>('/admin/plats').then(setPlats),
    apiFetch<any[]>('/admin/planning').then(setPlanning),
    apiFetch<any[]>('/admin/planning/surcharges').then(setSurcharges),
  ]).catch(console.error);

  useEffect(() => { loadAll(); }, []);

  const handleSavePlanning = async () => {
    setSaving(true);
    await apiFetch('/admin/planning', { method: 'PUT', body: JSON.stringify(planning) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddSurcharge = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let i = 0; i < 3; i++) {
      if (sPlats[i]) {
        await apiFetch('/admin/planning/surcharges', {
          method: 'POST',
          body: JSON.stringify({ date_jour: sDate, position: i + 1, plat_id: sPlats[i] }),
        });
      }
    }
    setSDate('');
    setSPlats(['', '', '']);
    loadAll();
  };

  const handleDeleteSurcharge = async (id: string) => {
    await apiFetch(`/admin/planning/surcharges/${id}`, { method: 'DELETE' });
    loadAll();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">Planning hebdomadaire</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Grille planning */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Planning de la semaine</h2>
            <button
              onClick={handleSavePlanning}
              disabled={saving}
              className="bg-gray-800 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
            </button>
          </div>
          <WeeklyPlanningGrid plats={plats} planning={planning} onChange={setPlanning} />
        </div>

        {/* Surcharges ponctuelles */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Surcharges ponctuelles</h2>
          <form onSubmit={handleAddSurcharge} className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500">Date</label>
              <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} required
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <label className="text-xs text-gray-500">Plat {i + 1}</label>
                <select value={sPlats[i]} onChange={(e) => setSPlats(sPlats.map((v, j) => j === i ? e.target.value : v))}
                  className="w-full mt-1 border rounded-lg px-2 py-2 text-sm">
                  <option value="">— Aucun —</option>
                  {plats.filter((p) => p.actif).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            ))}
            <button type="submit" className="bg-amber-500 text-white py-2 rounded-lg text-sm mt-4 sm:mt-0">Ajouter</button>
          </form>

          {surcharges.length > 0 && (
            <table className="w-full text-sm mt-2">
              <thead className="text-gray-500 border-b">
                <tr>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Pos.</th>
                  <th className="py-2 text-left">Plat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {surcharges.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{s.date_jour}</td>
                    <td className="py-2">{s.position}</td>
                    <td className="py-2">{s.plat_nom}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleDeleteSurcharge(s.id)} className="text-red-500 hover:underline text-xs">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
