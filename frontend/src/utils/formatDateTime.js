export function formatDateTime(value) {
  if (!value) return 'Not set';

  // MySQL DATETIME strings come as "2026-08-05 01:13:39" — replace space with T to make them ISO-parseable
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Not set';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
