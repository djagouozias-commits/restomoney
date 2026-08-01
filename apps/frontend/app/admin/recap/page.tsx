'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface EmployeCommande {
  login: string;
  quantite: number;
  options: string[];
}

interface LigneRecap {
  type: string;
  nom: string;
  employes: EmployeCommande[];
}

interface CreneauRecap {
  creneau: string;
  lignes: LigneRecap[];
}

interface RecapData {
  structure: { nom: string; domaine?: string; telephone?: string };
  date: string;
  creneaux: CreneauRecap[];
}

export default function RecapPage() {
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedStructure, setSelectedStructure] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<any[]>('/admin/structures').then(setStructures).catch(console.error);

    // Pré-remplir structureId depuis l'URL
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('structureId');
    if (sid) setSelectedStructure(sid);
  }, []);

  useEffect(() => {
    if (selectedStructure) loadRecap();
  }, [selectedStructure, date]);

  const loadRecap = async () => {
    if (!selectedStructure) return;
    setLoading(true);
    try {
      const data = await apiFetch<RecapData>(
        `/admin/recap?structureId=${selectedStructure}&date=${date}`,
      );
      setRecap(data);
    } catch (e) {
      setRecap(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalCommandes = recap?.creneaux.reduce(
    (sum, cr) => sum + cr.lignes.reduce((s, l) => s + l.employes.reduce((q, e) => q + e.quantite, 0), 0),
    0,
  ) || 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header — masqué à l'impression */}
      <header className="bg-white border-b border-gray-200 px-8 py-5 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Recapitulatif des commandes</h1>
          {recap && (
            <button
              onClick={handlePrint}
              className="ml-auto bg-gray-900 text-white px-5 py-2 rounded-lg text-base font-medium hover:bg-gray-700"
            >
              Imprimer
            </button>
          )}
        </div>
      </header>

      {/* Filtres — masqués à l'impression */}
      <div className="max-w-5xl mx-auto px-8 py-5 print:hidden">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-base font-medium text-gray-700">Structure</label>
            <select
              value={selectedStructure}
              onChange={(e) => setSelectedStructure(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">-- Choisir une structure --</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-base font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 border border-gray-300 rounded-lg px-4 py-2.5 text-base block focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <button
            onClick={loadRecap}
            disabled={!selectedStructure || loading}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-base font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Contenu imprimable */}
      <div ref={printRef} className="max-w-5xl mx-auto px-8 pb-8">
        {loading && (
          <p className="text-center text-gray-400 py-12 text-base print:hidden">Chargement...</p>
        )}

        {!loading && !recap && selectedStructure && (
          <p className="text-center text-gray-400 py-12 text-base print:hidden">
            Aucune commande pour cette selection.
          </p>
        )}

        {recap && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 print:border-0 print:p-0">
            {/* En-tête du reçu */}
            <div className="text-center border-b border-gray-200 pb-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">RestoMoney</h2>
              <p className="text-base text-gray-600 mt-1">Recapitulatif des commandes</p>
              <div className="flex justify-center gap-8 mt-4 text-base">
                <div>
                  <span className="text-gray-500">Structure :</span>{' '}
                  <strong>{recap.structure.nom}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Date :</span>{' '}
                  <strong>{new Date(recap.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Total commandes :</span>{' '}
                  <strong>{totalCommandes}</strong>
                </div>
              </div>
            </div>

            {/* Par créneau */}
            {recap.creneaux.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune commande ce jour.</p>
            ) : recap.creneaux.map((cr) => (
              <div key={cr.creneau} className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Creneau : {cr.creneau}
                  </h3>
                  <div className="flex-1 border-t border-gray-200"></div>
                  <span className="text-sm text-gray-500">
                    {cr.lignes.reduce((s, l) => s + l.employes.reduce((q, e) => q + e.quantite, 0), 0)} commande(s)
                  </span>
                </div>

                {/* Tableau par article */}
                <table className="w-full text-base border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 w-48">
                        Article
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-700 w-16">
                        Qte
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-700">
                        Employes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cr.lignes.map((ligne, idx) => {
                      const totalQte = ligne.employes.reduce((s, e) => s + e.quantite, 0);
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-4 py-3 font-medium">
                            <div>{ligne.nom}</div>
                            <div className="text-xs text-gray-400 capitalize">{ligne.type}</div>
                          </td>
                          <td className="border border-gray-200 px-4 py-3 text-center font-bold text-lg">
                            {totalQte}
                          </td>
                          <td className="border border-gray-200 px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {ligne.employes.map((emp, ei) => (
                                <div key={ei} className="inline-flex flex-col">
                                  <span className="bg-gray-100 border border-gray-300 rounded px-2 py-1 font-mono text-sm font-bold">
                                    {emp.login}
                                    {emp.quantite > 1 && (
                                      <span className="text-gray-500 ml-1">x{emp.quantite}</span>
                                    )}
                                  </span>
                                  {emp.options.length > 0 && (
                                    <span className="text-xs text-gray-400 mt-0.5 max-w-32">
                                      {emp.options.join(', ')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pied de page */}
            <div className="border-t border-gray-200 pt-6 mt-6 text-center text-sm text-gray-400">
              <p>Vos plats sont livres bien chauds. Une promesse que nous honorons depuis 5 ans.</p>
              <p className="mt-1">Imprime le {new Date().toLocaleString('fr-FR')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Styles d'impression */}
      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
