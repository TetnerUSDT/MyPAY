import type { ReactNode } from "react";

const LOGO_LAYERS = [
  { src: "/uploads/assets/logo-1.webp", alt: "SwiftX", className: "animate-glitch-logo1" },
  { src: "/uploads/assets/logo-2.webp", alt: "", className: "animate-spin-cw-85" },
  { src: "/uploads/assets/logo-3.webp", alt: "", className: "animate-spin-ccw" },
];

export type UnifiedPreloaderSize = "sm" | "md" | "lg";

interface UnifiedPreloaderProps {
  label?: string;
  size?: UnifiedPreloaderSize;
  fullscreen?: boolean;
  className?: string;
  children?: ReactNode;
}

const sizeClasses: Record<UnifiedPreloaderSize, string> = {
  sm: "swiftx-preloader-mark--sm",
  md: "swiftx-preloader-mark--md",
  lg: "swiftx-preloader-mark--lg",
};

/**
 * The single loading visual used by boot, auth checks, lazy pages, and page data.
 * Keep the layered logo here so all loading states share the same motion language.
 */
export function UnifiedPreloader({
  label,
  size = "md",
  fullscreen = true,
  className = "",
  children,
}: UnifiedPreloaderProps) {
  const content = (
    <div
      className={`swiftx-preloader ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label || "Загрузка"}
      data-testid="unified-preloader"
    >
      <div className={`swiftx-preloader-mark ${sizeClasses[size]}`} aria-hidden="true">
        {LOGO_LAYERS.map((layer) => (
          <img
            key={layer.src}
            src={layer.src}
            alt={layer.alt}
            className={`swiftx-preloader-layer ${layer.className}`}
          />
        ))}
      </div>
      {label && <p className="swiftx-preloader-label">{label}</p>}
      {children}
    </div>
  );

  if (!fullscreen) return content;

  return <div className="swiftx-preloader-screen">{content}</div>;
}

export interface PreloaderSlotProps {
  isLoading: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
  size?: UnifiedPreloaderSize;
}

export function PreloaderSlot({
  isLoading,
  className = "",
  children,
  label,
  size = "sm",
}: PreloaderSlotProps) {
  if (!isLoading) return children ? <>{children}</> : null;

  return (
    <UnifiedPreloader
      fullscreen={false}
      size={size}
      label={label}
      className={`swiftx-preloader-slot ${className}`}
    />
  );
}