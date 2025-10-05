/**
 * Simple module registry controlled by env var MODULES.
 * Example: MODULES=intake,scheduling
 * Default: all known modules enabled (back-compat).
 */
const raw = (process.env.MODULES || '').trim();
const listed = raw ? new Set(raw.split(',').map((s) => s.trim())) : null;

function on(name: string): boolean {
  // Backwards compatible default: enabled if not explicitly configured
  if (!listed) return true;
  return listed.has(name);
}

export const modules = {
  intake: on('intake'),
  apprequest: on('apprequest'),
  invoicing: on('invoicing'),
  // Future modules
  scheduling: on('scheduling'),
  emergency: on('emergency'),
};
