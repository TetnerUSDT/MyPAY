import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Clock, ArrowDown, Copy, Check } from "lucide-react";
import { formatCountdown, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type WaitState = "checking" | "processing" | "success";

export default function WaitScreen() {
  const [currentState, setCurrentState] = useState<WaitState>("checking");
  const [countdown, setCountdown] = useState(900); // 15:00 in seconds
  const [txHash] = useState("0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2bfknjafs7621sd");
  const [cardNumber] = useState("4373 8349 9348 7328");
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const confettiRef = useRef<HTMLCanvasElement>(null);

  // State transition logic
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setCurrentState("processing");
    }, 3000); // 3 seconds to show processing state

    const timer2 = setTimeout(() => {
      setCurrentState("success");
    }, 8000); // 5 more seconds to show success state

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCopyTxHash = async () => {
    try {
      await copyToClipboard(txHash);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Transaction hash copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy transaction hash",
        variant: "destructive",
      });
    }
  };

  const handleBackToHome = () => {
    setLocation("/home");
  };

  // Confetti animation
  useEffect(() => {
    if (currentState === "success" && confettiRef.current) {
      const canvas = confettiRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const particles: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        color: string;
        size: number;
        rotation: number;
        rotationSpeed: number;
      }> = [];

      const colors = ['#a5fe7c', '#ffeb3b', '#ff5722', '#2196f3', '#e91e63', '#00bcd4'];

      // Create particles
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: -10,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 6 + 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10
        });
      }

      let animationId: number;

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle, index) => {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.vy += 0.1; // gravity
          particle.rotation += particle.rotationSpeed;

          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.rotate((particle.rotation * Math.PI) / 180);
          ctx.fillStyle = particle.color;
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
          ctx.restore();

          // Remove particles that are off screen
          if (particle.y > canvas.height + 10) {
            particles.splice(index, 1);
          }
        });

        if (particles.length > 0) {
          animationId = requestAnimationFrame(animate);
        }
      };

      animate();

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }
  }, [currentState]);

  // State 1: Checking payment
  if (currentState === "checking") {
    return (
      <div className="mobile-screen text-white relative overflow-hidden">
        
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
            Проверка платежа
          </h1>
          
          <div className="text-xl text-yellow-400 font-semibold mb-8" data-testid="text-status">
            ищем транзакцию
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary border border-yellow-400 rounded-lg px-4 py-2 mb-16">
            <Clock className="w-4 h-4 mr-2 text-yellow-400" />
            <span className="font-mono text-lg text-yellow-400" data-testid="text-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Hourglass Icon */}
          <div className="w-full max-w-md crypto-card flex items-center justify-center p-16">
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 24 24" 
              fill="#a5fe7c"
              className="animate-pulse"
              data-testid="icon-hourglass"
            >
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="m18 22-.01-6L14 12l3.99-4.01L18 2H6v6l4 4-4 3.99V22zM8 7.5V4h8v3.5l-4 4z"/>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Processing application
  if (currentState === "processing") {
    return (
      <div className="mobile-screen text-white">
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-2xl font-bold mb-4" data-testid="text-title">
            Выполнение заявки
          </h1>
          
          <div className="text-2xl text-yellow-400 font-bold mb-4" data-testid="text-application-number">
            872342833
          </div>
          
          {/* Timer */}
          <div className="inline-flex items-center bg-secondary border border-yellow-400 rounded-lg px-4 py-2 mb-8">
            <Clock className="w-4 h-4 mr-2 text-yellow-400" />
            <span className="font-mono text-lg text-yellow-400" data-testid="text-countdown">
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Transaction Found */}
          <div className="w-full max-w-md crypto-card mb-4">
            <div className="text-sm text-muted-foreground mb-2 text-left">Хеш транзакции найден</div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold">100.00</span>
              <span className="text-lg font-semibold text-yellow-400">USDT TRC20</span>
            </div>
            
            <div className="bg-secondary rounded-lg p-3 mb-2 relative">
              <div className="font-mono text-xs break-all text-left" data-testid="text-transaction-hash">
                {txHash}
              </div>
              <button 
                className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded"
                onClick={handleCopyTxHash}
                data-testid="button-copy-hash"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-accent" />
                )}
              </button>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center mb-4 border-[6px]" style={{borderColor: '#2a4c3b'}}>
            <ArrowDown className="w-5 h-5 text-accent-foreground" />
          </div>

          {/* Ready to Send */}
          <div className="w-full max-w-md crypto-card mb-8">
            <div className="text-sm text-muted-foreground mb-2 text-left">Готовим к отправке</div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold">8000.00</span>
              <span className="text-lg font-semibold text-yellow-400">РУБ</span>
            </div>
            
            <div className="text-sm text-muted-foreground mb-2 text-left">На номер карты</div>
            <div className="bg-secondary rounded-lg p-3">
              <span className="font-mono" data-testid="text-card-number">
                {cardNumber}
              </span>
            </div>
          </div>

          {/* Hourglass at bottom */}
          <div className="w-12 h-12 crypto-card flex items-center justify-center p-2">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="#a5fe7c"
              className="animate-pulse"
              data-testid="icon-hourglass-small"
            >
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="m18 22-.01-6L14 12l3.99-4.01L18 2H6v6l4 4-4 3.99V22zM8 7.5V4h8v3.5l-4 4z"/>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Success
  return (
    <div className="mobile-screen text-white relative">
      {/* Confetti Canvas */}
      <canvas
        ref={confettiRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ position: 'fixed', top: 0, left: 0 }}
      />
      
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative z-20">
        <h1 className="text-2xl font-bold mb-12" data-testid="text-title">
          Выполнена успешно
        </h1>
        
        {/* Success Icon */}
        <div className="w-32 h-32 mb-12 flex items-center justify-center">
          <svg 
            width="116" 
            height="116" 
            viewBox="0 0 24 24" 
            fill="#a5fe7c"
            className="animate-pulse"
            data-testid="icon-success"
          >
            <path fill="none" d="M0 0h24v24H0z"/>
            <path d="M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39z"/>
          </svg>
        </div>
        
        <p className="text-lg mb-16 px-4">
          Средства были отправлены на вашу карту,<br />
          обмен завершен с двух сторон!
        </p>
        
        <div className="w-full max-w-sm mb-8">
          <Link href="/support">
            <p className="text-sm text-yellow-400 text-center cursor-pointer hover:underline" data-testid="link-support">
              Что делать если вы не получили средства?
            </p>
          </Link>
        </div>
        
        <div className="w-full max-w-sm">
          <button 
            className="action-button"
            onClick={handleBackToHome}
            data-testid="button-back-home"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    </div>
  );
}