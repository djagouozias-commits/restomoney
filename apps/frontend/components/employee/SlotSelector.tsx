'use client';

interface Creneau {
  label: string;
  time: string;
  disponible: boolean;
  lendemain?: boolean;
}

interface SlotSelectorProps {
  creneaux: Creneau[];
  selected: string | null;
  onChange: (time: string) => void;
}

export function SlotSelector({ creneaux, selected, onChange }: SlotSelectorProps) {
  const isLendemain = creneaux.some((c) => c.lendemain);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">Choisir un créneau de livraison</h3>
        {isLendemain && (
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
            📅 Livraison demain
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {creneaux.map((c) => (
          <button
            key={c.time}
            disabled={!c.disponible}
            onClick={() => onChange(c.time)}
            className={`py-3 px-4 rounded-xl border-2 text-center transition-all ${
              !c.disponible
                ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                : selected === c.time
                ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'
            }`}
          >
            <span className="text-lg font-bold">{c.label}</span>
            <p className="text-xs mt-0.5 opacity-70">
              {!c.disponible ? 'Dépassé' : c.lendemain ? 'Demain' : 'Disponible'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
