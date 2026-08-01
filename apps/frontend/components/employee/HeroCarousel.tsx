'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSwipe } from '@/lib/useSwipe';

// ── Citations — défilent indépendamment des images ────────────────────────────
const CITATIONS = [
  'Un bon repas commence par des ingrédients frais et une passion sincère.',
  'La ponctualité est le respect que l\'on porte à ceux qui nous font confiance.',
  'Chaque plat livré chaud est une promesse tenue.',
  'La qualité ne se compromet pas — elle se cultive chaque jour.',
  'Nourrir les équipes, c\'est investir dans leur énergie et leur succès.',
  'Derrière chaque commande, il y a une équipe qui compte sur vous.',
  'La saveur authentique ne supporte pas les compromis.',
  'Cinq ans de confiance, un seul engagement : arriver chaud.',
  'Le meilleur repas est celui qui rassemble et donne de l\'énergie.',
  'Chaque détail compte, du choix des plats jusqu\'à la livraison.',
  'La cuisine est un acte d\'amour que l\'on partage sans compter.',
  'Un repas chaud, c\'est un moral remonté.',
  'La fraîcheur n\'attend pas — nous non plus.',
  'Satisfaire votre appétit, c\'est notre plus belle récompense.',
  'De la cuisine à votre table, nous mettons tout notre coeur.',
];

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'1200\' height=\'600\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23111827\'/%3E%3C/svg%3E';

const IMAGE_INTERVAL  = 4000;  // images toutes les 4s
const CITATION_INTERVAL = 6000; // citations toutes les 6s — rythme différent pour motif unique
const TYPEWRITER_SPEED  = 38;   // ms par caractère

export function HeroCarousel() {
  const [images,    setImages]    = useState<string[]>([]);
  const [imgIndex,  setImgIndex]  = useState(0);
  const [imgFading, setImgFading] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  // Citation avec effet machine à écrire
  const [citIndex,   setCitIndex]   = useState(0);
  const [displayed,  setDisplayed]  = useState('');
  const [typing,     setTyping]     = useState(true);
  const typeRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charRef    = useRef(0);

  // ── Chargement images ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/carousel')
      .then((r) => r.json())
      .then((files: string[]) => { if (files.length > 0) setImages(files); })
      .catch(() => {});
  }, []);

  // ── Rotation images (ordre aléatoire sans répétition successive) ─────────
  const nextImage = useCallback(() => {
    if (images.length <= 1) return;
    setImgFading(true);
    setTimeout(() => {
      setImgIndex((prev) => {
        // Choisir un index différent du précédent
        let next = Math.floor(Math.random() * images.length);
        while (next === prev && images.length > 1) {
          next = Math.floor(Math.random() * images.length);
        }
        return next;
      });
      setImgFading(false);
    }, 400);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(nextImage, IMAGE_INTERVAL);
    return () => clearInterval(id);
  }, [nextImage, images.length]);

  // ── Machine à écrire ────────────────────────────────────────────────────
  useEffect(() => {
    const full = CITATIONS[citIndex % CITATIONS.length] ?? '';
    charRef.current = 0;
    setDisplayed('');
    setTyping(true);

    const tick = () => {
      charRef.current += 1;
      setDisplayed(full.slice(0, charRef.current));

      if (charRef.current < full.length) {
        typeRef.current = setTimeout(tick, TYPEWRITER_SPEED);
      } else {
        setTyping(false);
      }
    };

    typeRef.current = setTimeout(tick, TYPEWRITER_SPEED);
    return () => { if (typeRef.current) clearTimeout(typeRef.current); };
  }, [citIndex]);

  // Passer à la citation suivante
  useEffect(() => {
    const id = setInterval(() => {
      setCitIndex((prev) => (prev + 1) % CITATIONS.length);
    }, CITATION_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // ── Image source ─────────────────────────────────────────────────────────
  const src = images.length > 0
    ? (imgErrors.has(imgIndex) ? PLACEHOLDER : images[imgIndex])
    : PLACEHOLDER;

  // ── Swipe tactile ────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (imgFading || images.length <= 1) return;
    setImgFading(true);
    setTimeout(() => {
      setImgIndex((prev) => (prev + 1) % images.length);
      setImgFading(false);
    }, 300);
  }, [imgFading, images.length]);

  const goPrev = useCallback(() => {
    if (imgFading || images.length <= 1) return;
    setImgFading(true);
    setTimeout(() => {
      setImgIndex((prev) => (prev - 1 + images.length) % images.length);
      setImgFading(false);
    }, 300);
  }, [imgFading, images.length]);

  const swipeHandlers = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goPrev });

  return (
    <div className="w-full select-none">

      {/* ── Image — pleine largeur, grande hauteur ──────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-gray-900"
        style={{ height: 'clamp(220px, 50vw, 480px)' }}
        {...swipeHandlers}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: imgFading ? 0 : 1,
            transition: 'opacity 400ms ease',
          }}
        >
          {/* img natif au lieu de Next/Image — pas de limite sur les fichiers statiques locaux */}
          <img
            src={src}
            alt="Carousel RestoMoney"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgErrors((prev) => new Set(prev).add(imgIndex))}
          />
        </div>

        {/* Boutons navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Précédent"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goNext}
              aria-label="Suivant"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dots pagination */}
        {images.length > 1 && images.length <= 15 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i === imgIndex || imgFading) return;
                  setImgFading(true);
                  setTimeout(() => { setImgIndex(i); setImgFading(false); }, 300);
                }}
                className={`rounded-full transition-all duration-300 ${
                  i === imgIndex ? 'bg-white w-5 h-2' : 'bg-white/40 w-2 h-2'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bande citation — SOUS l'image, jamais par-dessus ────────────── */}
      <div className="mt-0 bg-gray-900 rounded-b-2xl -mt-2 pt-3 pb-4 px-5 min-h-[72px] flex flex-col justify-center">
        {/* Ligne décorative */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-0.5 bg-orange-500 rounded-full" />
          <span className="text-orange-400 text-xs font-semibold tracking-wider uppercase">
            RestoMoney
          </span>
        </div>

        {/* Texte machine à écrire */}
        <p className="text-white text-sm leading-relaxed font-light">
          {displayed}
          {/* Curseur clignotant pendant la frappe */}
          {typing && (
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                background: '#f97316',
                marginLeft: '2px',
                verticalAlign: 'text-bottom',
                animation: 'blink 0.7s step-end infinite',
              }}
            />
          )}
          {/* Trait fixe quand la frappe est terminée */}
          {!typing && (
            <span className="inline-block w-0.5 h-4 bg-orange-500/60 ml-1 align-middle" />
          )}
        </p>

        <style jsx global>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
