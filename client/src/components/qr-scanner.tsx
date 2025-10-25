import { useState } from "react";
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

          {/* Scanner - Full Screen */}
          <div className="absolute inset-0">
            <Scanner
              onScan={handleScan}
              onError={handleError}
              constraints={{
                facingMode: "environment",
                aspectRatio: { 
                  ideal: typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 0.75, 
                  min: 0.75, 
                  max: 1.5 
                }
              }}
              styles={{
                container: {
                  width: "100vw",
                  height: "100vh",
                  overflow: "hidden",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                },
                video: {
                  width: "100%",
                  height: "auto",
                  minHeight: "100%",
                  objectFit: "cover",
                  transform: "translateZ(0)"
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

          {/* Error Message */}
          {error && (
            <div className="absolute bottom-20 left-0 right-0 z-20 mx-4">
              <div className="bg-red-500 text-white px-4 py-3 rounded-lg text-center font-medium" data-testid="text-scanner-error">
                {error}
              </div>
            </div>
          )}

          {/* Camera Icon Indicator */}
          <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full flex items-center gap-2">
              <Camera className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium">Наведите на QR-код</span>
            </div>
          </div>
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
