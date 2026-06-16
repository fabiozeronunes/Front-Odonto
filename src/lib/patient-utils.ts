/**
 * Generates a consistent 8-digit numeric ID from a string (usually the Firestore document ID).
 */
export function generatePatientDisplayId(id: string): string {
  if (!id) return '---';
  const hash = Math.abs(id.split('').reduce((a: number, b: string) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a | 0;
  }, 0));
  // Ensure it's exactly 8 digits by taking the first 8 or padding if shorter
  const str = hash.toString();
  return str.length >= 8 ? str.slice(0, 8) : str.padStart(8, '0');
}

export function getPatientId(patient: any): string {
  if (!patient) return '---';
  const storedId = patient.numeroRegistro;
  // If it's NOT exactly 8 digits or contains non-numeric characters, it's "legacy" or "dirty"
  if (!storedId || !/^\d{8}$/.test(storedId)) {
    return generatePatientDisplayId(patient.id);
  }
  return storedId;
}
