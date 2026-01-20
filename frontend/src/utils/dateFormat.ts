/**
 * Format a date/datetime string to day/month/year format (non-American).
 * @param dateStr - ISO date string or Date object
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string like "15/01/2025" or "15/01/2025, 14:30"
 */
export function formatDate(dateStr: string | Date, includeTime = false): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  if (!includeTime) {
    return `${day}/${month}/${year}`;
  }
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Format a date to show weekday + date + time.
 * @param dateStr - ISO date string
 * @returns Formatted string like "Sun 15/01/2025, 14:30"
 */
export function formatEventDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays[date.getDay()];
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${weekday} ${day}/${month}/${year}, ${hours}:${minutes}`;
}
