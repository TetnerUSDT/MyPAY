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
