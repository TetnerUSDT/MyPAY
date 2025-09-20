import { useEffect, useRef } from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

export default function QRCodeComponent({
  value,
  size = 256,
  bgColor = "#ffffff",
  fgColor = "#000000",
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    // Clear canvas with background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Simple QR code pattern generation (mock implementation)
    // In a real app, you'd use a proper QR code library like qrcode
    const moduleSize = size / 25; // 25x25 grid
    ctx.fillStyle = fgColor;

    // Create a mock QR code pattern based on the value
    const createPattern = (str: string) => {
      const hash = Array.from(str).reduce((a, b) => {
        a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
        return a < 0 ? a + 0x100000000 : a;
      }, 0);

      const pattern = [];
      for (let i = 0; i < 625; i++) { // 25x25 = 625
        pattern.push((hash * (i + 1)) % 2 === 0);
      }
      return pattern;
    };

    const pattern = createPattern(value);

    // Draw the pattern
    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        const index = row * 25 + col;
        if (pattern[index]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    // Add finder patterns (the three squares in corners)
    const drawFinderPattern = (x: number, y: number) => {
      // Outer square
      ctx.fillRect(x, y, moduleSize * 7, moduleSize * 7);
      ctx.fillStyle = bgColor;
      ctx.fillRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5);
      ctx.fillStyle = fgColor;
      ctx.fillRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize * 3, moduleSize * 3);
    };

    drawFinderPattern(0, 0); // Top-left
    drawFinderPattern(0, 18 * moduleSize); // Bottom-left
    drawFinderPattern(18 * moduleSize, 0); // Top-right
  }, [value, size, bgColor, fgColor]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-gray-200 rounded"
      data-testid="qr-code-canvas"
    />
  );
}
