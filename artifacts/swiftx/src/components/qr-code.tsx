import { useEffect, useRef } from "react";
import QRCode from "qrcode";

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
    if (!canvasRef.current || !value) return;

    const canvas = canvasRef.current;

    // Generate QR code using the qrcode library
    QRCode.toCanvas(canvas, value, {
      width: size,
      color: {
        dark: fgColor,
        light: bgColor,
      },
      margin: 2,
      errorCorrectionLevel: 'M',
    }).catch((error) => {
      console.error("Failed to generate QR code:", error);
    });
  }, [value, size, bgColor, fgColor]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-gray-200 rounded"
      data-testid="qr-code-canvas"
    />
  );
}