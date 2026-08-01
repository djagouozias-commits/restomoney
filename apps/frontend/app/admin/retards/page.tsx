'use client';

import { LateOrdersBoard } from '@/components/admin/LateOrdersBoard';
import Link from 'next/link';

export default function RetardsPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Retards et Penalites</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-8 py-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <LateOrdersBoard />
        </div>
      </main>
    </div>
  );
}
