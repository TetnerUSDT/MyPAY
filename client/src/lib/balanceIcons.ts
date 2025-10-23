/**
 * Get balance icon URL by balance ID
 * Icons are stored in /uploads/balances/ directory with filename pattern: {id}.png
 * 
 * @param balanceId - The ID of the balance from the database
 * @returns URL path to the balance icon
 * 
 * @example
 * // For balance with id=3 (TRC20)
 * getBalanceIcon(3) // Returns: "/uploads/balances/3.png"
 */
export function getBalanceIcon(balanceId: number): string {
  return `/uploads/balances/${balanceId}.png`;
}

/**
 * Get balance icon URL with fallback
 * Returns a default icon if the balance ID is not provided
 * 
 * @param balanceId - The ID of the balance from the database
 * @param fallback - Optional fallback icon URL
 * @returns URL path to the balance icon or fallback
 */
export function getBalanceIconWithFallback(
  balanceId?: number | null, 
  fallback: string = '/uploads/icons/cryptocurrency/tron.png'
): string {
  if (!balanceId) return fallback;
  return getBalanceIcon(balanceId);
}
