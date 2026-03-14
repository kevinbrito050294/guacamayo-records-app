import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ImageCarousel({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Separamos el string de la DB en un array si viene como "url1,url2"
  const imgs = typeof images === 'string' ? (images as string).split(',') : images;

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imgs.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imgs.length) % imgs.length);
  };

  if (!imgs.length || !imgs[0]) return <div className="bg-slate-200 h-48 w-full animate-pulse" />;

  return (
    <div className="relative w-full h-48 sm:h-64 overflow-hidden group">
      <img 
        src={imgs[currentIndex]} 
        className="w-full h-full object-cover transition-all duration-500"
        alt="Producto"
      />
      
      {imgs.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {imgs.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? 'bg-amber-500' : 'bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}