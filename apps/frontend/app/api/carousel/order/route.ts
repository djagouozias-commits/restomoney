import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ORDER_FILE = path.join(process.cwd(), 'public', 'carousel', '_order.json');
const CAROUSEL_DIR = path.join(process.cwd(), 'public', 'carousel');

export async function GET() {
  try {
    if (fs.existsSync(ORDER_FILE)) {
      const raw = fs.readFileSync(ORDER_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(raw));
    }
    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { order } = await req.json() as { order: string[] };
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'order must be an array' }, { status: 400 });
    }

    // Valider que tous les fichiers existent
    const safe = order.filter((f) => {
      const base = path.basename(f);
      return base === f && !f.includes('..') && fs.existsSync(path.join(CAROUSEL_DIR, base));
    });

    fs.writeFileSync(ORDER_FILE, JSON.stringify(safe, null, 2));
    return NextResponse.json({ ok: true, count: safe.length });
  } catch {
    return NextResponse.json({ error: 'Erreur sauvegarde ordre' }, { status: 500 });
  }
}
