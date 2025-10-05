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

// Format balance - remove trailing zeros but keep significant digits (100.00001000 -> 100.00001)
export function formatBalance(balance: string | number): string {
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0";
  
  // Convert to string with full precision
  const str = num.toString();
  
  // If no decimal point, return as is
  if (!str.includes('.')) return str;
  
  // Remove trailing zeros after decimal point
  return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
