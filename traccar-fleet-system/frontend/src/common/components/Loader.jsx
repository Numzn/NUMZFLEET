import { useEffect } from 'react';

/**
 * Shows the static `.loader` spinner that index.html paints before the bundle
 * parses, instead of rendering a second one — so there is no flash between the
 * pre-React spinner and this component, and no two spinners at once.
 *
 * index.jsx hides that element once React has mounted; this shows it again
 * while something is genuinely loading, and hides it on unmount. The element is
 * therefore shared state between index.html, index.jsx and this file — it must
 * be hidden, never removed. The guard below keeps a missing element from taking
 * down the whole app: four components render <Loader />, including App during
 * every session bootstrap.
 */
const Loader = () => {
  useEffect(() => {
    const loader = document.querySelector('.loader');
    if (!loader) return undefined;
    loader.style.display = '';
    return () => {
      loader.style.display = 'none';
    };
  }, []);
  return null;
};

export default Loader;
