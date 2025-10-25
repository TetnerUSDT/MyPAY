import { useState, useEffect } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  validate?: (data: string) => boolean;
  errorMessage?: string;
}

export default function QRScanner({
  open,
  onClose,
  onScan,
  title = "Сканирование QR-кода",
  validate,
  errorMessage = "Неверный формат QR-кода"
}: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsReady(false);
      setHasPermission(null);
      setError(null);
      return;
    }

    // Request camera permission first
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: "environment",
        width: { ideal: 1280, min: 640, max: 1920 },
        height: { ideal: 960, min: 480, max: 1440 }
      } 
    })
      .then((stream) => {
        // Stop the stream immediately - we just needed to get permission
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        // Small delay for iOS to properly initialize
        setTimeout(() => setIsReady(true), 100);
      })
      .catch((err) => {
        console.error("Camera permission error:", err);
        setHasPermission(false);
        setError("Необходим доступ к камере");
      });
  }, [open]);

  // Apply iOS-specific video attributes and hide tracker after component mounts
  useEffect(() => {
    if (!isReady || !open) return;

    const timer = setTimeout(() => {
      // Find all video elements and ensure they have iOS-required attributes
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
      });

      // Find and hide the scanner's tracking overlay SVG
      const scannerDialog = document.querySelector('[data-testid="dialog-qr-scanner"]');
      if (scannerDialog) {
        const allSvgs = scannerDialog.querySelectorAll('svg');
        allSvgs.forEach((svg) => {
          // Check if this is NOT a Lucide icon
          const isLucideIcon = svg.classList.contains('lucide') || 
                               svg.closest('.lucide') || 
                               svg.parentElement?.tagName === 'BUTTON';
          
          if (!isLucideIcon) {
            // This is the tracker SVG - hide it
            svg.style.opacity = '0';
            svg.style.pointerEvents = 'none';
            svg.style.visibility = 'hidden';
          }
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isReady, open]);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;

    const scannedData = detectedCodes[0]?.rawValue;
    if (!scannedData) return;

    // If validation function is provided, validate the scanned data
    if (validate && !validate(scannedData)) {
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Clear error and call onScan callback
    setError(null);
    onScan(scannedData);
  };

  const handleError = (error: unknown) => {
    console.error("QR Scanner Error:", error);
    const err = error as Error;
    if (err?.name === 'NotAllowedError') {
      setError("Доступ к камере запрещен");
      setHasPermission(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content 
          className="fixed inset-0 z-50 bg-black overflow-hidden"
          data-testid="dialog-qr-scanner"
        >
          {/* Header with Close Button */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <h2 className="text-white text-lg font-semibold" data-testid="text-scanner-title">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full"
              data-testid="button-close-scanner"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Permission Loading State */}
          {hasPermission === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                <p>Запрос доступа к камере...</p>
              </div>
            </div>
          )}

          {/* Permission Denied State */}
          {hasPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-white text-center space-y-4">
                <X className="w-12 h-12 mx-auto text-red-500" />
                <p className="text-lg font-semibold">Доступ к камере запрещен</p>
                <p className="text-sm text-gray-300">
                  Разрешите доступ к камере в настройках браузера и попробуйте снова
                </p>
                <Button
                  onClick={onClose}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          )}

          {/* Scanner - Full Screen */}
          {hasPermission === true && isReady && (
            <div className="absolute inset-0">
              <Scanner
                onScan={handleScan}
                onError={handleError}
                scanDelay={200}
                constraints={{
                  facingMode: "environment",
                  width: { ideal: 1920, min: 1280, max: 3840 },
                  height: { ideal: 1440, min: 960, max: 2160 },
                  frameRate: { ideal: 60, min: 30 }
                }}
                styles={{
                  container: {
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    position: "relative"
                  },
                  video: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "contrast(1.1) brightness(1.05)"
                  }
                }}
              />

              {/* Scanning Overlay - Corner Brackets */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="relative w-64 h-64">
                  {/* Top-Left Corner */}
                  <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  {/* Top-Right Corner */}
                  <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  {/* Bottom-Left Corner */}
                  <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  {/* Bottom-Right Corner */}
                  <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white rounded-br-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute bottom-20 left-0 right-0 z-20 mx-4">
              <div className="bg-red-500 text-white px-4 py-3 rounded-lg text-center font-medium" data-testid="text-scanner-error">
                {error}
              </div>
            </div>
          )}

          {/* Camera Icon Indicator */}
          {hasPermission === true && isReady && (
            <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
              <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full flex items-center gap-2">
                <Camera className="w-5 h-5 text-white" />
                <span className="text-white text-sm font-medium">Наведите на QR-код</span>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface QRScannerButtonProps {
  onClick: () => void;
  className?: string;
}

export function QRScannerButton({ onClick, className }: QRScannerButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className={`rounded-full w-10 h-10 ${className || ''}`}
      data-testid="button-open-scanner"
    >
      <Camera className="w-5 h-5" />
    </Button>
  );
}
