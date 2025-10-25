import { useEffect, useRef } from "react";
import QRCodeStyling, { DotType, CornerSquareType, CornerDotType } from "qr-code-styling";

type QRColorConfig = 
  | { type: 'single', color: string } 
  | { type: 'gradient', colors: [string, string] };

interface StyledQRCodeProps {
  value: string;
  size?: number;
  balanceId?: number;
  qrColor?: QRColorConfig;
  qrStyle?: 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
}

export default function StyledQRCodeComponent({
  value,
  size = 256,
  balanceId,
  qrColor,
  qrStyle = 'rounded',
}: StyledQRCodeProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const logoPath = balanceId ? `/uploads/balances/${balanceId}.png` : undefined;

    // Generate at 2x resolution for better quality, then scale down
    const highResSize = size * 2;

    // Determine dot color configuration
    const gradientConfig = qrColor?.type === 'gradient' ? {
      type: 'linear',
      rotation: Math.PI / 4, // 45 degrees
      colorStops: [
        { offset: 0, color: qrColor.colors[0] },
        { offset: 1, color: qrColor.colors[1] }
      ]
    } : undefined;

    const singleColor = qrColor?.type === 'single' ? qrColor.color : '#000000';

    const qrCode = new QRCodeStyling({
      width: highResSize,
      height: highResSize,
      data: value,
      margin: 10,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H"
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.35,
        margin: 8,
        crossOrigin: "anonymous"
      },
      dotsOptions: {
        ...(gradientConfig ? { gradient: gradientConfig } : { color: singleColor }),
        type: qrStyle as DotType
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        ...(gradientConfig ? { gradient: gradientConfig } : { color: singleColor }),
        type: (qrStyle === 'extra-rounded' ? 'extra-rounded' : 'square') as CornerSquareType
      },
      cornersDotOptions: {
        ...(gradientConfig ? { gradient: gradientConfig } : { color: singleColor }),
        type: (qrStyle === 'dots' ? 'dot' : 'square') as CornerDotType
      },
      image: logoPath
    });

    canvasRef.current.innerHTML = '';
    qrCode.append(canvasRef.current);
    qrCodeRef.current = qrCode;

    // Scale down the generated element to the desired size
    const generatedElement = canvasRef.current.querySelector('canvas, svg');
    if (generatedElement) {
      (generatedElement as HTMLElement).style.width = `${size}px`;
      (generatedElement as HTMLElement).style.height = `${size}px`;
      (generatedElement as HTMLElement).style.borderRadius = '30px';
    }

    return () => {
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, [value, size, balanceId, qrColor, qrStyle]);

  return (
    <div
      ref={canvasRef}
      className="flex justify-center items-center"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`
      }}
      data-testid="styled-qr-code-container"
    />
  );
}
