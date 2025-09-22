/**
 * Route Change Preloader
 * 
 * Automatically shows/hides preloader during route transitions
 * Integrates with wouter routing and TanStack Query for smooth UX
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useIsFetching } from '@tanstack/react-query';
import { usePreloader } from './Preloader';

interface RouteChangePreloaderProps {
  /** Minimum delay before showing preloader (prevents flicker on fast routes) */
  delayMs?: number;
  /** Minimum time to keep preloader visible */
  minVisibleMs?: number;
  /** Threshold for query fetching count to consider "loading" */
  fetchThreshold?: number;
}

export const RouteChangePreloader = ({ 
  delayMs = 200, 
  minVisibleMs = 400,
  fetchThreshold = 0
}: RouteChangePreloaderProps) => {
  const [location] = useLocation();
  const isFetching = useIsFetching();
  const { show, hide } = usePreloader();
  
  const [currentPreloaderId, setCurrentPreloaderId] = useState<string | null>(null);
  const previousLocationRef = useRef<string>(location);
  const routeChangeTimeRef = useRef<number>(0);
  const hasShownInitialLoader = useRef<boolean>(false);

  // Show preloader on initial load (3 seconds) and route changes (normal duration)
  useEffect(() => {
    const previousLocation = previousLocationRef.current;
    const currentLocation = location;
    
    // Determine if this is initial load or route change
    const isInitialLoad = !hasShownInitialLoader.current;
    const isRouteChange = previousLocation !== currentLocation && hasShownInitialLoader.current;
    
    if (isInitialLoad || isRouteChange) {
      if (isInitialLoad) {
        hasShownInitialLoader.current = true;
      }
      
      // Record route change time
      routeChangeTimeRef.current = Date.now();
      previousLocationRef.current = currentLocation;

      // Function to show preloader
      const showPreloader = () => {
        if (currentPreloaderId) {
          hide(currentPreloaderId);
        }
        
        const preloaderId = show({
          scope: 'page',
          key: 'default',
          delayMs: 0, // We handle delay here
          minVisibleMs: isInitialLoad ? 3000 : minVisibleMs, // 3 seconds for initial load
          bgVariant: 'gradient',
        });
        
        setCurrentPreloaderId(preloaderId);
      };

      // Delay showing preloader to avoid flicker on fast transitions
      const delayTimer = setTimeout(showPreloader, delayMs);

      return () => {
        clearTimeout(delayTimer);
      };
    }
  }, [location, show, hide, delayMs, minVisibleMs]);

  // Hide preloader after minimum visible time or when fetching is complete
  useEffect(() => {
    if (currentPreloaderId) {
      // Ensure minimum visible time has passed since route change
      const elapsed = Date.now() - routeChangeTimeRef.current;
      const remainingMinTime = Math.max(0, minVisibleMs - elapsed);

      // Hide preloader either after min time or when no more fetching (whichever is longer)
      const shouldHideImmediately = isFetching <= fetchThreshold;
      const hideDelay = shouldHideImmediately ? remainingMinTime : Math.max(remainingMinTime, 100);

      const hideTimer = setTimeout(() => {
        hide(currentPreloaderId);
        setCurrentPreloaderId(null);
      }, hideDelay);

      return () => clearTimeout(hideTimer);
    }
  }, [isFetching, currentPreloaderId, hide, minVisibleMs, fetchThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPreloaderId) {
        hide(currentPreloaderId);
      }
    };
  }, []);

  return null; // This component doesn't render anything
};