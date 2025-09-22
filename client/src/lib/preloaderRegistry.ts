/**
 * Preloader Animation Registry
 * 
 * Manages dynamic imports of Lottie animations for the preloader system.
 * Supports future extensibility by allowing registration of new animations.
 */

export type PreloaderAnimationKey = 'default' | 'success' | 'processing' | 'error';

export interface PreloaderAnimation {
  key: PreloaderAnimationKey;
  data: any;
  duration?: number;
  loop?: boolean;
}

// Dynamic import map for code splitting
const animationImports: Record<PreloaderAnimationKey, () => Promise<any>> = {
  default: () => import('@/assets/preload-default.json'),
  success: () => import('@/assets/payment-success.json'), // existing success animation
  processing: () => import('@/assets/preload-default.json'), // fallback to default for now
  error: () => import('@/assets/preload-default.json'), // fallback to default for now
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
      return await loadAnimation('default');
    }

    const animationModule = await importFn();
    const animationData = animationModule.default || animationModule;
    
    // Cache the loaded animation
    animationCache.set(key, animationData);
    
    return animationData;
  } catch (error) {
    console.error(`[PreloaderRegistry] Failed to load animation '${key}':`, error);
    
    // If default animation also fails, return null (component will show skeleton)
    if (key === 'default') {
      return null;
    }
    
    // Fallback to default animation
    return await loadAnimation('default');
  }
};

/**
 * Register a new animation for future use
 * Useful for dynamically adding animations at runtime
 */
export const registerAnimation = (
  key: PreloaderAnimationKey, 
  importFn: () => Promise<any>
): void => {
  animationImports[key] = importFn;
  // Clear cache for this key to force reload
  animationCache.delete(key);
};

/**
 * Get available animation keys
 */
export const getAvailableKeys = (): PreloaderAnimationKey[] => {
  return Object.keys(animationImports) as PreloaderAnimationKey[];
};

/**
 * Preload multiple animations for better performance
 */
export const preloadAnimations = async (keys: PreloaderAnimationKey[]): Promise<void> => {
  const promises = keys.map(key => loadAnimation(key));
  await Promise.allSettled(promises);
};

/**
 * Clear animation cache (useful for development/testing)
 */
export const clearCache = (): void => {
  animationCache.clear();
};