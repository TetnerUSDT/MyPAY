import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

interface StyledQRCodeProps {
  value: string;
  size?: number;
  balanceId?: number;
}

export default function StyledQRCodeComponent({
  value,
  size = 256,
  balanceId,
}: StyledQRCodeProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const logoPath = balanceId ? `/uploads/balances/${balanceId}.png` : undefined;

    const qrCode = new QRCodeStyling({
      width: size,
      height: size,
      data: value,
      margin: 5,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "H"
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.4,
        margin: 5
      },
      dotsOptions: {
        color: "#000000",
        type: "rounded"
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        color: "#000000",
        type: "extra-rounded"
      },
      cornersDotOptions: {
        color: "#000000",
        type: "dot"
      },
      image: logoPath
    });

    canvasRef.current.innerHTML = '';
    qrCode.append(canvasRef.current);
    qrCodeRef.current = qrCode;

    return () => {
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, [value, size, balanceId]);

  return (
    <div
      ref={canvasRef}
      className="flex justify-center items-center"
      data-testid="styled-qr-code-container"
    />
  );
}
