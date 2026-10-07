import { useLayoutEffect, useRef } from 'react';

// En la compu (pantalla apaisada con mouse o touchpad) los campos quedan como siempre. En celulares y tablets, si el
// texto de un campo no entra, la letra se achica de a poco (hasta un mínimo) para que se lea entero.
const NOTEBOOK = '(pointer:fine) and (min-width:801px) and (orientation:landscape)';
const MIN_PX = 10;

export function useFitInput(value: string) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const fit = () => {
      input.style.fontSize = '';
      if (typeof matchMedia === 'undefined' || matchMedia(NOTEBOOK).matches || !input.clientWidth) return;
      let size = parseFloat(getComputedStyle(input).fontSize);
      while (size > MIN_PX && input.scrollWidth > input.clientWidth + 1) {
        size -= 0.5;
        input.style.fontSize = `${size}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(input);
    return () => observer.disconnect();
  }, [value]);
  return ref;
}
