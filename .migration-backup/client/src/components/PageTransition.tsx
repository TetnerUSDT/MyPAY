import { useEffect, useState, useRef, useCallback } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
  className?: string;
}

export default function PageTransition({ children, routeKey, className = "" }: PageTransitionProps) {
  const [displayedChild, setDisplayedChild] = useState(children);
  const [animationClass, setAnimationClass] = useState("");
  const [isInitialMount, setIsInitialMount] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextChildrenRef = useRef<React.ReactNode>(children);
  const prevRouteRef = useRef<string>(routeKey);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Clear timeout helper
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  // Handle animation end events
  const handleAnimationEnd = useCallback((event: AnimationEvent) => {
    if (event.target !== wrapperRef.current) return;
    
    clearPendingTimeout(); // Clear any fallback timers
    
    const target = event.target as HTMLElement;
    if (target.classList.contains('animate-page-out')) {
      // Exit animation finished, show new content with enter animation
      setDisplayedChild(nextChildrenRef.current);
      setAnimationClass("animate-page-in");
    } else if (target.classList.contains('animate-page-in')) {
      // Enter animation finished, clear animation class
      setAnimationClass("");
    }
  }, [clearPendingTimeout]);

  // Set up animation end listener
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.addEventListener('animationend', handleAnimationEnd);
    return () => {
      wrapper.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [handleAnimationEnd]);

  // Handle route changes based on routeKey
  useEffect(() => {
    if (isInitialMount) {
      // First mount - show with enter animation or immediately if reduced motion
      setIsInitialMount(false);
      if (!prefersReducedMotion) {
        setAnimationClass("animate-page-in");
      }
      return;
    }

    if (routeKey !== prevRouteRef.current) {
      // Route changed
      prevRouteRef.current = routeKey;
      nextChildrenRef.current = children;
      
      clearPendingTimeout(); // Clear any existing timers
      
      if (prefersReducedMotion) {
        // No animation - immediate swap
        setDisplayedChild(children);
        return;
      }

      // Start exit animation
      setAnimationClass("animate-page-out");
      
      // Fallback timeout in case animationend doesn't fire
      timeoutRef.current = setTimeout(() => {
        setDisplayedChild(nextChildrenRef.current);
        setAnimationClass("animate-page-in");
        
        timeoutRef.current = setTimeout(() => {
          setAnimationClass("");
          timeoutRef.current = null;
        }, 500);
      }, 500);
    }
  }, [routeKey, children, isInitialMount, prefersReducedMotion, clearPendingTimeout]);

  return (
    <div 
      ref={wrapperRef}
      className={`page-transition ${animationClass} ${className}`}
      style={{
        minHeight: "100vh"
      }}
    >
      {displayedChild}
    </div>
  );
}