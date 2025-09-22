import { useState, useEffect } from 'react';
import { LottieAnimation } from './LottieAnimation';
import reloadAnimation from '@/assets/reload.json';

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
        <LottieAnimation
          animationData={reloadAnimation}
          width={200}
          height={200}
          loop={true}
          autoplay={true}
          className="mb-4"
          data-testid="animation-preload"
        />
      </div>
    </div>
  );
};