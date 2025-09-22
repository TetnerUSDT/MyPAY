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

  useEffect(() => {
    const previousLocation = previousLocationRef.current;
    const currentLocation = location;

    // Check if route actually changed
    if (previousLocation === currentLocation) {
      return;
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
        minVisibleMs,
        bgVariant: 'gradient',
      });
      
      setCurrentPreloaderId(preloaderId);
    };

    // Function to check if we should show preloader
    const checkAndShowPreloader = () => {
      // Show preloader if queries are still fetching
      if (isFetching > fetchThreshold) {
        showPreloader();
      }
    };

    // Delay showing preloader to avoid flicker on fast transitions
    const delayTimer = setTimeout(checkAndShowPreloader, delayMs);

    return () => {
      clearTimeout(delayTimer);
    };
  }, [location, show, hide, delayMs, minVisibleMs, fetchThreshold]);

  // Hide preloader when fetching is complete
  useEffect(() => {
    if (isFetching <= fetchThreshold && currentPreloaderId) {
      // Ensure minimum visible time has passed since route change
      const elapsed = Date.now() - routeChangeTimeRef.current;
      const remainingMinTime = Math.max(0, minVisibleMs - elapsed);

      setTimeout(() => {
        hide(currentPreloaderId);
        setCurrentPreloaderId(null);
      }, remainingMinTime);
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