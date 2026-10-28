import { useEffect, useState } from 'react';

// Rotas por hash (#/mapa/...), para funcionar no GitHub Pages sem servidor.

function atual(): string[] {
  return decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
}

export function useRota(): string[] {
  const [r, setR] = useState(atual);
  useEffect(() => {
    const f = () => {
      setR(atual());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function ir(caminho: string) {
  location.hash = '#/' + caminho.replace(/^\//, '');
}

export function link(caminho: string): string {
  return '#/' + caminho.replace(/^\//, '');
}
