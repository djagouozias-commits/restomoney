import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAROUSEL_DIR = path.join(process.cwd(), 'public', 'carousel');
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jfif', 'image/pjpeg'];

export async function POST(req: NextRequest) {
  try {
    // Ensure carousel directory exists
    if (!fs.existsSync(CAROUSEL_DIR)) {
      fs.mkdirSync(CAROUSEL_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non accepté. Utilisez JPG, PNG ou WebP.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).` }, { status: 400 });
    }

    // Generate unique filename to avoid collisions
    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const base = path.basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40);
    const timestamp = Date.now();
    const filename = `${base}-${timestamp}${ext}`;
    const filepath = path.join(CAROUSEL_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({ filename, url: `/carousel/${filename}` });
  } catch (err) {
    console.error('[carousel upload]', err);
    return NextResponse.json({ error: 'Erreur lors du téléchargement.' }, { status: 500 });
  }
}
