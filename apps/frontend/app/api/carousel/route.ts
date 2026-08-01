import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAROUSEL_DIR = path.join(process.cwd(), 'public', 'carousel');
const ORDER_FILE   = path.join(CAROUSEL_DIR, '_order.json');
const EXTENSIONS   = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.jfif'];

export async function GET() {
  if (!fs.existsSync(CAROUSEL_DIR)) {
    return NextResponse.json([]);
  }

  // Lister tous les fichiers image (hors _order.json)
  const allFiles = fs
    .readdirSync(CAROUSEL_DIR)
    .filter((f) => EXTENSIONS.includes(path.extname(f).toLowerCase()));

  // Charger l'ordre sauvegardé
  let order: string[] = [];
  if (fs.existsSync(ORDER_FILE)) {
    try { order = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf-8')); } catch { order = []; }
  }

  // Construire la liste finale :
  // 1. Les fichiers dans l'ordre sauvegardé (s'ils existent encore)
  // 2. Les nouveaux fichiers pas encore dans l'ordre, triés alphabétiquement
  const orderedSet = new Set(order);
  const extra = allFiles.filter((f) => !orderedSet.has(f)).sort();
  const finalOrder = [...order.filter((f) => allFiles.includes(f)), ...extra];

  return NextResponse.json(finalOrder.map((f) => `/carousel/${f}`));
}
