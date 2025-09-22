import { useState, useEffect } from 'react';

interface PreloadAnimationProps {
  onComplete: () => void;
}

export const PreloadAnimation = ({ onComplete }: PreloadAnimationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Minimum display time for the preload animation
    const minDisplayTime = setTimeout(() => {
      setIsVisible(false);
      // Add a small delay for fade out animation
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 2000); // Show for at least 2 seconds

    return () => clearTimeout(minDisplayTime);
  }, [onComplete]);

  if (!isVisible) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 opacity-0"
        style={{ background: 'var(--gradient-primary)' }}
      />
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500"
      style={{ background: 'var(--gradient-primary)' }}
      data-testid="preload-animation"
    >
      <div className="flex flex-col items-center justify-center">
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-white border-opacity-20"></div>
          {/* Inner spinning dots */}
          <div className="absolute inset-0 animate-spin rounded-full h-20 w-20 border-4 border-transparent border-t-primary" style={{ animationDuration: '1s' }}></div>
          <div className="absolute inset-2 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-r-accent" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-4 animate-pulse rounded-full h-12 w-12 bg-primary bg-opacity-30"></div>
        </div>
      </div>
    </div>
  );
};