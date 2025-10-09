import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, length: number = 8): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatAmount(amount: string | number, decimals: number = 6): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toFixed(decimals);
}

export function generateOrderId(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "absolute";
    textArea.style.left = "-999999px";
    document.body.prepend(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    } finally {
      textArea.remove();
    }
    
    return Promise.resolve();
  }
}

// Format order amounts - round to 2 decimals (100.00000000 -> 100.00)
export function formatOrderAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
}

// Format balance - smart trimming:
// - 1.00005000 -> 1.00005 (trim trailing zeros, keep significant digits)
// - 10.00000000 -> 10.00 (if all zeros after 2nd decimal, show only 2 decimals)
export function formatBalance(balance: string | number): string {
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0";
  
  // Format with 8 decimal places
  const formatted = num.toFixed(8);
  
  // Split into integer and decimal parts
  const [intPart, decPart] = formatted.split('.');
  
  if (!decPart) return intPart;
  
  // Check if there are any non-zero digits after 2nd decimal place
  const afterSecondDecimal = decPart.substring(2);
  const hasSignificantDigits = /[1-9]/.test(afterSecondDecimal);
  
  if (!hasSignificantDigits) {
    // Only zeros after 2nd decimal - show 2 decimals
    return `${intPart}.${decPart.substring(0, 2)}`;
  }
  
  // Has significant digits - trim trailing zeros
  const trimmed = decPart.replace(/0+$/, '');
  return `${intPart}.${trimmed}`;
}
