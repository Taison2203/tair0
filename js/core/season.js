// Calendar boundaries in Kazakhstan (UTC+05:00).
const winterStart = Date.parse('2026-12-01T00:00:00+05:00');
const holidayEnd = Date.parse('2027-01-15T00:00:00+05:00');
const winterEnd = Date.parse('2027-03-01T00:00:00+05:00');

export function getSeason(now, location) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = local && new URLSearchParams(location.search).get('season');
  if (preview === 'default') return 'default';
  if (preview === 'winter' || preview === 'holiday') return preview;
  if (now < winterStart || now >= winterEnd) return 'default';
  return now < holidayEnd ? 'holiday' : 'winter';
}
