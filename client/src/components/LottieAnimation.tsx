import Lottie from 'lottie-react';
import { useRef, useEffect, useState } from 'react';

interface LottieAnimationProps extends React.HTMLAttributes<HTMLDivElement> {
  animationData: any;
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onComplete?: () => void;
}

export const LottieAnimation = ({
  animationData,
  width = 200,
  height = 200,
  loop = false,
  autoplay = true,
  className = '',
  onComplete,
  ...rest
}: LottieAnimationProps) => {
  const lottieRef = useRef<any>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (lottieRef.current && onComplete) {
      const handleComplete = () => {
        onComplete();
      };

      lottieRef.current.addEventListener('complete', handleComplete);

      return () => {
        if (lottieRef.current) {
          lottieRef.current.removeEventListener('complete', handleComplete);
        }
      };
    }
  }, [onComplete]);

  // Validate animation data
  useEffect(() => {
    if (!animationData || typeof animationData !== 'object') {
      setHasError(true);
    }
  }, [animationData]);

  if (hasError) {
    return (
      <div 
        className={`inline-block flex items-center justify-center ${className}`}
        style={{ width, height }}
        {...rest}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  try {
    return (
      <div 
        className={`inline-block ${className}`}
        style={{ width, height }}
        {...rest}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={loop}
          autoplay={autoplay}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  } catch (error) {
    return (
      <div 
        className={`inline-block flex items-center justify-center ${className}`}
        style={{ width, height }}
        {...rest}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
};