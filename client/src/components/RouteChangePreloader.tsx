/**
 * Initial Load Preloader
 * 
 * Shows preloader only on initial page load with guaranteed 3 second minimum display
 * Does NOT show preloader during route transitions
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { usePreloader } from './Preloader';

interface InitialLoadPreloaderProps {
  /** Guaranteed minimum time to keep preloader visible on initial load */
  initialMinVisibleMs?: number;
}

export const RouteChangePreloader = ({ 
  initialMinVisibleMs = 3000 // 3 seconds guaranteed
}: InitialLoadPreloaderProps) => {
  const { show, hide } = usePreloader();
  
  const [currentPreloaderId, setCurrentPreloaderId] = useState<string | null>(null);
  const currentPreloaderIdRef = useRef<string | null>(null);
  const [isInitialRender, setIsInitialRender] = useState<boolean>(true);

  // Hide static preloader and show React preloader for guaranteed 3 seconds
  useLayoutEffect(() => {
    const hideStaticPreloader = () => {
      const staticPreloader = document.getElementById('static-preloader');
      if (staticPreloader) {
        staticPreloader.classList.add('hiding');
        setTimeout(() => {
          staticPreloader.remove();
        }, 500); // Wait for fade out animation
      }
    };

    if (isInitialRender) {
      setIsInitialRender(false);
      
      // Hide static preloader first
      setTimeout(hideStaticPreloader, 300);
      
      // Show React preloader for guaranteed 3 seconds
      const preloaderId = show({
        scope: 'page',
        key: 'default',
        delayMs: 0,
        minVisibleMs: initialMinVisibleMs,
        bgVariant: 'gradient',
      });
      
      setCurrentPreloaderId(preloaderId);
      currentPreloaderIdRef.current = preloaderId;
      
      // Hide preloader after guaranteed time
      setTimeout(() => {
        if (currentPreloaderIdRef.current) {
          hide(currentPreloaderIdRef.current);
          setCurrentPreloaderId(null);
        }
      }, initialMinVisibleMs);
    }
  }, [show, hide, isInitialRender, initialMinVisibleMs]);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      if (currentPreloaderIdRef.current) {
        hide(currentPreloaderIdRef.current);
      }
    };
  }, [hide]);

  return null; // This component doesn't render anything, only manages preloader
};