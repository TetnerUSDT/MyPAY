/**
 * Preloader Animation Registry
 * 
 * Manages dynamic imports of Lottie animations for the preloader system.
 * Supports future extensibility by allowing registration of new animations.
 */

// Known animation keys for type safety and autocomplete
export const RESERVED_ANIMATION_KEYS = {
  default: 'default',
  success: 'success', 
  processing: 'processing',
  error: 'error'
} as const;

export type PreloaderAnimationKey = string;

export interface PreloaderAnimation {
  key: PreloaderAnimationKey;
  data: any;
  duration?: number;
  loop?: boolean;
}

// Dynamic import map for code splitting
const animationImports: Record<string, () => Promise<any>> = {
  [RESERVED_ANIMATION_KEYS.default]: () => import('@/assets/preload-default.json'),
  [RESERVED_ANIMATION_KEYS.success]: () => import('@/assets/payment-success.json'),
  [RESERVED_ANIMATION_KEYS.processing]: () => import('@/assets/preload-default.json'),
  [RESERVED_ANIMATION_KEYS.error]: () => import('@/assets/preload-default.json'),
};

// Animation cache to avoid repeated imports
const animationCache = new Map<PreloaderAnimationKey, any>();

/**
 * Load and cache a Lottie animation by key
 */
export const loadAnimation = async (key: PreloaderAnimationKey): Promise<any> => {
  // Return cached animation if available
  if (animationCache.has(key)) {
    return animationCache.get(key);
  }

  try {
    const importFn = animationImports[key];
    if (!importFn) {
      console.warn(`[PreloaderRegistry] Animation '${key}' not found, falling back to 'default'`);
      return await loadAnimation(RESERVED_ANIMATION_KEYS.default);
    }

    const animationModule = await importFn();
    const animationData = animationModule.default || animationModule;
    
    // Cache the loaded animation
    animationCache.set(key, animationData);
    
    return animationData;
  } catch (error) {
    console.error(`[PreloaderRegistry] Failed to load animation '${key}':`, error);
    
    // If default animation also fails, return null (component will show skeleton)
    if (key === RESERVED_ANIMATION_KEYS.default) {
      return null;
    }
    
    // Fallback to default animation
    return await loadAnimation(RESERVED_ANIMATION_KEYS.default);
  }
};

/**
 * Register a new animation for future use
 * Useful for dynamically adding animations at runtime
 */
export const registerAnimation = (
  key: string, 
  importFn: () => Promise<any>
): void => {
  animationImports[key] = importFn;
  // Clear cache for this key to force reload
  animationCache.delete(key);
};

/**
 * Get available animation keys
 */
export const getAvailableKeys = (): string[] => {
  return Object.keys(animationImports);
};

/**
 * Preload multiple animations for better performance
 */
export const preloadAnimations = async (keys: string[]): Promise<void> => {
  const promises = keys.map(key => loadAnimation(key));
  await Promise.allSettled(promises);
};

// Preload essential animations on module load for better UX
export const preloadEssentialAnimations = async (): Promise<void> => {
  await preloadAnimations([RESERVED_ANIMATION_KEYS.default, RESERVED_ANIMATION_KEYS.success]);
};

/**
 * Clear animation cache (useful for development/testing)
 */
export const clearCache = (): void => {
  animationCache.clear();
};