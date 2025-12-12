/**
 * Universal Preloader System
 * 
 * Provides configurable Lottie-based preloaders for page-level and component-level loading states.
 * Supports future extensibility with animation registry and theme integration.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LottieAnimation } from './LottieAnimation';
import { loadAnimation, type PreloaderAnimationKey } from '@/lib/preloaderRegistry';

// Types
export type PreloaderScope = 'page' | 'component';
export type PreloaderBgVariant = 'solid' | 'gradient' | 'transparent';

export interface PreloaderConfig {
  key: PreloaderAnimationKey;
  loop?: boolean;
  autoplay?: boolean;
  width?: number | string;
  height?: number | string;
  bgVariant?: PreloaderBgVariant;
  delayMs?: number;
  minVisibleMs?: number;
  respectReducedMotion?: boolean;
}

export interface PreloaderShowOptions extends Partial<PreloaderConfig> {
  scope?: PreloaderScope;
  id?: string; // For managing multiple loaders
}

interface PreloaderState {
  id: string;
  scope: PreloaderScope;
  config: PreloaderConfig;
  isVisible: boolean;
  startTime: number;
  delayTimeout?: number;
}

interface PreloaderContextValue {
  show: (options?: PreloaderShowOptions) => string;
  hide: (id?: string) => void;
  isLoading: (scope?: PreloaderScope) => boolean;
  states: Record<string, PreloaderState>;
}

// Default configuration
const DEFAULT_CONFIG: PreloaderConfig = {
  key: 'default',
  loop: true,
  autoplay: true,
  width: 120,
  height: 120,
  bgVariant: 'gradient',
  delayMs: 200,
  minVisibleMs: 400,
  respectReducedMotion: true,
};

const PreloaderContext = createContext<PreloaderContextValue | undefined>(undefined);

// Reduced motion helper functions
const shouldUseReducedMotion = (config: PreloaderConfig): boolean => {
  if (!config.respectReducedMotion) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const getReducedMotionLoop = (config: PreloaderConfig): boolean => {
  return shouldUseReducedMotion(config) ? false : (config.loop ?? true);
};

const getReducedMotionAutoplay = (config: PreloaderConfig): boolean => {
  return shouldUseReducedMotion(config) ? false : (config.autoplay ?? true);
};

// Provider Component
export const PreloaderProvider = ({ children }: { children: ReactNode }) => {
  const [states, setStates] = useState<Record<string, PreloaderState>>({});
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const show = useCallback((options: PreloaderShowOptions = {}): string => {
    const id = options.id || `preloader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const config = { ...DEFAULT_CONFIG, ...options };
    const scope = options.scope || 'page';

    // If delay is configured, wait before showing
    const showAfterDelay = () => {
      setStates(prev => ({
        ...prev,
        [id]: {
          id,
          scope,
          config,
          isVisible: true,
          startTime: Date.now(),
        }
      }));
      // Clear the timeout as it has fired
      timeoutsRef.current.delete(id);
    };

    if (config.delayMs && config.delayMs > 0) {
      const timeoutId = window.setTimeout(showAfterDelay, config.delayMs);
      timeoutsRef.current.set(id, timeoutId);
    } else {
      showAfterDelay();
    }

    return id;
  }, []);

  const hide = useCallback((id?: string) => {
    if (id) {
      // Cancel any pending delay for this preloader
      const pendingTimeout = timeoutsRef.current.get(id);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        timeoutsRef.current.delete(id);
      }

      // Hide specific preloader
      setStates(prev => {
        const state = prev[id];
        if (!state) return prev;

        const elapsed = Date.now() - state.startTime;
        const minVisible = state.config.minVisibleMs || 0;

        if (state.isVisible && elapsed < minVisible) {
          // Wait for minimum visible time
          setTimeout(() => {
            setStates(current => {
              const { [id]: removed, ...rest } = current;
              return rest;
            });
          }, minVisible - elapsed);
        } else {
          // Remove immediately
          const { [id]: removed, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    } else {
      // Hide all preloaders
      Object.keys(states).forEach(stateId => hide(stateId));
    }
  }, [states]);

  const isLoading = useCallback((scope?: PreloaderScope): boolean => {
    const visibleStates = Object.values(states).filter(state => state.isVisible);
    if (scope) {
      return visibleStates.some(state => state.scope === scope);
    }
    return visibleStates.length > 0;
  }, [states]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId: number) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  const value: PreloaderContextValue = {
    show,
    hide,
    isLoading,
    states,
  };

  return (
    <PreloaderContext.Provider value={value}>
      {children}
      <PreloaderOverlay />
    </PreloaderContext.Provider>
  );
};

// Hook
export const usePreloader = () => {
  const context = useContext(PreloaderContext);
  if (context === undefined) {
    throw new Error('usePreloader must be used within a PreloaderProvider');
  }
  return context;
};

// Preloader Overlay (Full-screen)
const PreloaderOverlay = () => {
  const { t } = useTranslation();
  const { states } = usePreloader();
  const [animationData, setAnimationData] = useState<any>(null);
  const [isAnimationLoading, setIsAnimationLoading] = useState(false);
  
  // Find active page-level preloader
  const pagePreloader = Object.values(states).find(
    state => state.scope === 'page' && state.isVisible
  );

  useEffect(() => {
    if (pagePreloader) {
      setIsAnimationLoading(true);
      loadAnimation(pagePreloader.config.key)
        .then(data => {
          setAnimationData(data);
          setIsAnimationLoading(false);
        })
        .catch(() => {
          setAnimationData(null);
          setIsAnimationLoading(false);
        });
    } else {
      setAnimationData(null);
      setIsAnimationLoading(false);
    }
  }, [pagePreloader?.config.key]);

  if (!pagePreloader) return null;

  const { config } = pagePreloader;
  
  // Background variant styles
  const bgStyles = {
    solid: 'bg-background',
    gradient: 'gradient-bg',
    transparent: 'bg-transparent backdrop-blur-sm',
  };

  const bgClass = bgStyles[config.bgVariant || 'gradient'];

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${bgClass} animate-fadeIn`}
      role="status"
      aria-busy="true"
      aria-label={t('splash.loading')}
      data-testid="overlay-preloader"
    >
      {/* Prevent scroll on body when overlay is active */}
      <style>{`body { overflow: hidden !important; }`}</style>
      
      <div className="flex flex-col items-center gap-4 animate-scaleIn">
        {/* Animation or Skeleton */}
        {isAnimationLoading || !animationData || shouldUseReducedMotion(config) ? (
          <PreloaderSkeleton config={config} />
        ) : (
          <LottieAnimation
            animationData={animationData}
            width={config.width}
            height={config.height}
            loop={getReducedMotionLoop(config)}
            autoplay={getReducedMotionAutoplay(config)}
            className="drop-shadow-lg"
            data-testid="overlay-preloader-animation"
          />
        )}
        
        {/* Optional loading text */}
        <div className="text-foreground/80 text-sm font-medium animate-pulse">
          {t('splash.loading')}
        </div>
      </div>
    </div>,
    document.body
  );
};

// Preloader Slot (Inline/Component-level)
export interface PreloaderSlotProps {
  isLoading: boolean;
  config?: Partial<PreloaderConfig>;
  className?: string;
  children?: ReactNode;
}

export const PreloaderSlot = ({ 
  isLoading, 
  config: customConfig = {}, 
  className = '', 
  children 
}: PreloaderSlotProps) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [isAnimationLoading, setIsAnimationLoading] = useState(false);
  
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  useEffect(() => {
    if (isLoading) {
      setIsAnimationLoading(true);
      loadAnimation(config.key)
        .then(data => {
          setAnimationData(data);
          setIsAnimationLoading(false);
        })
        .catch(() => {
          setAnimationData(null);
          setIsAnimationLoading(false);
        });
    }
  }, [isLoading, config.key]);

  if (!isLoading) {
    return children ? <>{children}</> : null;
  }

  return (
    <div 
      className={`flex items-center justify-center pointer-events-none ${className}`}
      role="status"
      aria-busy="true"
      aria-label="Loading"
      data-testid="slot-preloader"
    >
      {isAnimationLoading || !animationData || shouldUseReducedMotion(config) ? (
        <PreloaderSkeleton config={config} />
      ) : (
        <LottieAnimation
          animationData={animationData}
          width={config.width}
          height={config.height}
          loop={getReducedMotionLoop(config)}
          autoplay={getReducedMotionAutoplay(config)}
          className="drop-shadow-sm"
          data-testid="slot-preloader-animation"
        />
      )}
    </div>
  );
};

// Skeleton fallback for reduced motion or loading states
const PreloaderSkeleton = ({ config }: { config: PreloaderConfig }) => {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  return (
    <div
      className={`rounded-full border-4 border-accent/20 border-l-accent ${
        prefersReducedMotion ? '' : 'animate-spin'
      }`}
      style={{ 
        width: config.width, 
        height: config.height 
      }}
      data-testid="preloader-skeleton"
    />
  );
};