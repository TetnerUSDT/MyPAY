/**
 * Initial Load Preloader
 *
 * Shows Lottie preloader only during initial page load.
 * Hides as soon as React finishes initializing (no forced minimum wait).
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { usePreloader } from './Preloader';

export const RouteChangePreloader = () => {
  const { show, hide } = usePreloader();
  const currentPreloaderIdRef = useRef<string | null>(null);
  const [isInitialRender, setIsInitialRender] = useState<boolean>(true);

  useLayoutEffect(() => {
    if (!isInitialRender) return;
    setIsInitialRender(false);

    // Remove the static HTML preloader (fade out)
    const hideStaticPreloader = () => {
      const el = document.getElementById('static-preloader');
      if (el) {
        el.classList.add('hiding');
        setTimeout(() => el.remove(), 350);
      }
    };
    hideStaticPreloader();

    // Show the React/Lottie preloader
    const id = show({
      scope: 'page',
      key: 'default',
      delayMs: 0,
      minVisibleMs: 800,   // short minimum so Lottie is visible briefly
      bgVariant: 'solid',
    });
    currentPreloaderIdRef.current = id;

    // Hide after 800ms — app content will take over
    setTimeout(() => {
      if (currentPreloaderIdRef.current) {
        hide(currentPreloaderIdRef.current);
        currentPreloaderIdRef.current = null;
      }
    }, 800);
  }, [show, hide, isInitialRender]);

  useLayoutEffect(() => {
    return () => {
      if (currentPreloaderIdRef.current) {
        hide(currentPreloaderIdRef.current);
      }
    };
  }, [hide]);

  return null;
};
