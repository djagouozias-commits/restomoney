'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

export default function CarouselAdminPage() {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drag & drop state
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/carousel');
    const files: string[] = await res.json();
    setImages(files);
    setOrderChanged(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setError('Sélectionnez au moins une image.'); return; }
    setError(''); setSuccess(''); setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch('/api/carousel/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Erreur upload : ${file.name}`);
      }
      setSuccess(`${files.length} image${files.length > 1 ? 's' : ''} ajoutée${files.length > 1 ? 's' : ''} avec succès.`);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: any) {
      setError(e.message || 'Erreur lors du téléchargement.');
    } finally { setUploading(false); }
  };

  // ── Suppression ────────────────────────────────────────────────────────────
  const handleDelete = async (filename: string) => {
    const name = filename.replace('/carousel/', '');
    if (!confirm(`Supprimer "${name}" ?`)) return;
    setDeleting(name);
    try {
      const res = await fetch(`/api/carousel/delete?file=${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur lors de la suppression.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la suppression.');
    } finally { setDeleting(null); }
  };

  // ── Sauvegarde ordre ───────────────────────────────────────────────────────
  const saveOrder = async (newImages: string[]) => {
    setSaving(true);
    try {
      const order = newImages.map((src) => src.replace('/carousel/', ''));
      await fetch('/api/carousel/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      setSuccess('Ordre sauvegardé.');
      setOrderChanged(false);
    } catch {
      setError('Erreur lors de la sauvegarde de l\'ordre.');
    } finally { setSaving(false); }
  };

  // ── Boutons ↑ ↓ (mobile) ──────────────────────────────────────────────────
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setImages(next);
    setOrderChanged(true);
    setSuccess('');
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Petite image fantôme
    const ghost = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  };

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) { setDragOver(null); return; }
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(index, 0, item);
    setImages(next);
    setOrderChanged(true);
    setSuccess('');
    dragIndex.current = null;
    setDragOver(null);
  };

  const onDragEnd = () => {
    dragIndex.current = null;
    setDragOver(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700 text-xl font-light">&larr;</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Images du carousel</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Upload */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Ajouter des images</h2>
          <p className="text-sm text-gray-500 mb-4">
            Formats acceptés : JPG, PNG, WebP, JFIF. Les images s'affichent dans le carousel selon l'ordre défini ci-dessous.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">{success}</div>
          )}

          <form onSubmit={handleUpload} className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner les images</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/jfif"
                multiple
                ref={fileRef}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {uploading ? 'Envoi...' : 'Télécharger'}
            </button>
          </form>
        </div>

        {/* Grille avec drag & drop */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Ordre d'affichage</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Glissez-déposez les images pour les réorganiser. Sur mobile, utilisez les boutons ↑ ↓.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{images.length} image{images.length !== 1 ? 's' : ''}</span>
              {orderChanged && (
                <button
                  onClick={() => saveOrder(images)}
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Sauvegarde...' : '💾 Sauvegarder l\'ordre'}
                </button>
              )}
            </div>
          </div>

          {images.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Aucune image dans le carousel.</p>
              <p className="text-xs mt-1">Ajoutez des images ci-dessus pour les faire apparaître.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {images.map((src, index) => {
                const name = src.replace('/carousel/', '');
                const isDragTarget = dragOver === index;
                return (
                  <div
                    key={src}
                    draggable
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDrop={(e) => onDrop(e, index)}
                    onDragEnd={onDragEnd}
                    className={`relative group rounded-xl overflow-hidden border-2 bg-gray-50 transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragTarget
                        ? 'border-orange-400 scale-95 shadow-lg shadow-orange-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ aspectRatio: '16/9' }}
                  >
                    {/* Numéro de position */}
                    <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>

                    {/* Icône drag (desktop hint) */}
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 rounded p-1">
                        <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                          <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z"/>
                        </svg>
                      </div>
                    </div>

                    <img
                      src={src}
                      alt={name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                    />

                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end gap-1.5 p-2 pb-3">
                      <p className="text-white text-xs font-medium text-center truncate w-full px-1">{name}</p>

                      {/* Boutons ↑ ↓ pour mobile */}
                      <div className="flex gap-1.5 w-full">
                        <button
                          onClick={() => moveImage(index, index - 1)}
                          disabled={index === 0}
                          title="Déplacer vers la gauche"
                          className="flex-1 bg-white/20 hover:bg-white/40 text-white text-base font-bold py-1 rounded disabled:opacity-30 transition-colors"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveImage(index, index + 1)}
                          disabled={index === images.length - 1}
                          title="Déplacer vers la droite"
                          className="flex-1 bg-white/20 hover:bg-white/40 text-white text-base font-bold py-1 rounded disabled:opacity-30 transition-colors"
                        >
                          →
                        </button>
                      </div>

                      <button
                        onClick={() => handleDelete(src)}
                        disabled={deleting === name}
                        className="w-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {deleting === name ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Barre d'action sticky en bas si ordre modifié */}
          {orderChanged && (
            <div className="mt-6 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex-wrap gap-3">
              <p className="text-sm text-orange-800 font-medium">
                ⚠️ L'ordre a été modifié mais pas encore sauvegardé.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { load(); setSuccess(''); }}
                  className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-4 py-2 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={() => saveOrder(images)}
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
