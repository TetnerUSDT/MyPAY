/**
 * Route Change Preloader
 * 
 * Automatically shows/hides preloader during route transitions
 * Integrates with wouter routing and TanStack Query for smooth UX
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const currentPreloaderIdRef = useRef<string | null>(null);
  const previousLocationRef = useRef<string>(location);
  const routeChangeTimeRef = useRef<number>(0);
  const activeMinVisibleMsRef = useRef<number>(minVisibleMs);
  const [isInitialRender, setIsInitialRender] = useState<boolean>(true);
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show preloader immediately on initial load (before paint)
  useLayoutEffect(() => {
    if (isInitialRender) {
      // Show preloader immediately for initial load
      setIsInitialRender(false);
      routeChangeTimeRef.current = Date.now();
      activeMinVisibleMsRef.current = 3000; // Track 3 seconds for initial load
      
      const preloaderId = show({
        scope: 'page',
        key: 'default',
        delayMs: 0,
        minVisibleMs: 3000, // 3 seconds for initial load
        bgVariant: 'gradient',
      });
      
      setCurrentPreloaderId(preloaderId);
      currentPreloaderIdRef.current = preloaderId;
    }
  }, [show, isInitialRender]);

  // Handle route changes after initial load
  useEffect(() => {
    if (!isInitialRender) {
      const previousLocation = previousLocationRef.current;
      const currentLocation = location;
      
      // Check if route actually changed
      if (previousLocation !== currentLocation) {
        previousLocationRef.current = currentLocation;

        // Clear any pending timer
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }

        // Check if initial 3s preloader is still active and should not be interrupted
        const elapsed = Date.now() - routeChangeTimeRef.current;
        const initialStillActive = elapsed < activeMinVisibleMsRef.current && currentPreloaderId;

        if (initialStillActive) {
          // Don't interrupt initial preloader, schedule route preloader for later
          const remainingInitialTime = activeMinVisibleMsRef.current - elapsed;
          pendingTimerRef.current = setTimeout(() => {
            // Show route preloader after initial preloader finishes
            const showRoutePreloader = () => {
              if (currentPreloaderId) {
                hide(currentPreloaderId);
              }
              
              routeChangeTimeRef.current = Date.now();
              activeMinVisibleMsRef.current = minVisibleMs;
              
              const preloaderId = show({
                scope: 'page',
                key: 'default',
                delayMs: 0,
                minVisibleMs,
                bgVariant: 'gradient',
              });
              
              setCurrentPreloaderId(preloaderId);
              currentPreloaderIdRef.current = preloaderId;
            };

            setTimeout(showRoutePreloader, delayMs);
          }, remainingInitialTime);
        } else {
          // Normal route change - show preloader immediately
          // Record route change time
          routeChangeTimeRef.current = Date.now();

          // Function to show preloader
          const showPreloader = () => {
            if (currentPreloaderId) {
              hide(currentPreloaderId);
            }
            
            activeMinVisibleMsRef.current = minVisibleMs; // Track normal duration for route changes
            
            const preloaderId = show({
              scope: 'page',
              key: 'default',
              delayMs: 0,
              minVisibleMs, // Normal duration for route changes
              bgVariant: 'gradient',
            });
            
            setCurrentPreloaderId(preloaderId);
            currentPreloaderIdRef.current = preloaderId;
          };

          // Delay showing preloader to avoid flicker on fast transitions
          pendingTimerRef.current = setTimeout(showPreloader, delayMs);
        }

        return () => {
          if (pendingTimerRef.current) {
            clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
          }
        };
      }
    }
  }, [location, show, hide, delayMs, minVisibleMs, isInitialRender, currentPreloaderId]);

  // Hide preloader after minimum visible time or when fetching is complete
  useEffect(() => {
    if (currentPreloaderId) {
      // Ensure minimum visible time has passed since route change
      const elapsed = Date.now() - routeChangeTimeRef.current;
      const remainingMinTime = Math.max(0, activeMinVisibleMsRef.current - elapsed);

      // Hide preloader either after min time or when no more fetching (whichever is longer)
      const shouldHideImmediately = isFetching <= fetchThreshold;
      const hideDelay = shouldHideImmediately ? remainingMinTime : Math.max(remainingMinTime, 100);

      const hideTimer = setTimeout(() => {
        hide(currentPreloaderId);
        setCurrentPreloaderId(null);
      }, hideDelay);

      return () => clearTimeout(hideTimer);
    }
  }, [isFetching, currentPreloaderId, hide, fetchThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPreloaderIdRef.current) {
        hide(currentPreloaderIdRef.current);
      }
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, [hide]);

  return null; // This component doesn't render anything
};