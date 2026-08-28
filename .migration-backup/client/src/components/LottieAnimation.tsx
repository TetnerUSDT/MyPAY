import Lottie from 'lottie-react';
import { useRef, useEffect } from 'react';

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

  if (!animationData) {
    return (
      <div 
        className={`inline-block ${className}`}
        style={{ width, height }}
        {...rest}
      />
    );
  }

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
        rendererSettings={{
          preserveAspectRatio: 'xMidYMid slice'
        }}
      />
    </div>
  );
};