export function escapeHTML(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getIntervalText(hours: number): string {
  const days = Math.round(hours / 24);
  if (days === 1) return '1 день';
  if (days > 1 && days < 5) return `${days} дня`;
  if (days >= 5) return `${days} дней`;
  return `${hours} часов`;
}
