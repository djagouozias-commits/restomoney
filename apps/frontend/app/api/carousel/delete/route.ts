import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAROUSEL_DIR = path.join(process.cwd(), 'public', 'carousel');

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Nom de fichier manquant.' }, { status: 400 });
    }

    // Security: prevent path traversal
    const basename = path.basename(file);
    if (basename !== file || file.includes('..') || file.includes('/')) {
      return NextResponse.json({ error: 'Nom de fichier invalide.' }, { status: 400 });
    }

    const filepath = path.join(CAROUSEL_DIR, basename);

    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 });
    }

    fs.unlinkSync(filepath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[carousel delete]', err);
    return NextResponse.json({ error: 'Erreur lors de la suppression.' }, { status: 500 });
  }
}
