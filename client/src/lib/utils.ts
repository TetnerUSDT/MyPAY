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

// Check if string is a crypto wallet address
export function isCryptoAddress(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  
  // Ethereum/Polygon/BSC addresses: 0x + 40 hex chars = 42 total
  if (/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) return true;
  
  // TRON addresses: T + 33 base58 chars = 34 total
  if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) return true;
  
  // TON addresses: EQ/UQ + base64 or raw format
  if (/^(EQ|UQ)[a-zA-Z0-9_-]{46}$/i.test(trimmed)) return true;
  if (/^0:[a-fA-F0-9]{64}$/i.test(trimmed)) return true;
  
  return false;
}

// Format crypto wallet address: show first 10 and last 6 chars
export function formatCryptoAddress(address: string): string {
  if (!address || address.length < 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

// Format bank card number: add spaces every 4 digits
export function formatCardNumber(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  return formatted.substring(0, 23); // Max 19 digits + 4 spaces
}

// Universal format for recipient address: detects crypto vs card
export function formatRecipientAddress(value: string): string {
  if (!value) return '';
  
  if (isCryptoAddress(value)) {
    return formatCryptoAddress(value);
  }
  
  // Default to card formatting for numeric-only strings
  return formatCardNumber(value);
}

// Get label key for recipient address field (returns i18n key)
export function getRecipientLabelKey(value: string): string {
  if (!value) return 'common.toCardNumber';
  
  if (isCryptoAddress(value)) {
    return 'common.toWalletAddress';
  }
  
  return 'common.toCardNumber';
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
