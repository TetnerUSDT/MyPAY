import Lottie from 'lottie-react';
import { useRef, useEffect } from 'react';

interface LottieAnimationProps {
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
  onComplete
}: LottieAnimationProps) => {
  const lottieRef = useRef<any>(null);

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

  return (
    <div 
      className={`inline-block ${className}`}
      style={{ width, height }}
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
};