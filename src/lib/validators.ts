export function validateKenyaPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === "") return { valid: true }; // optional field

  const cleaned = phone.replace(/\s/g, "");

  // Kenya: +254XXXXXXXXX, 254XXXXXXXXX, 07XXXXXXXX, 01XXXXXXXX
  const kenyanRegex = /^(\+?254|0)(7|1)\d{8}$/;

  if (!kenyanRegex.test(cleaned)) {
    return {
      valid: false,
      error: "Enter a valid Kenyan phone number (e.g., +254712345678 or 0712345678)",
    };
  }

  return { valid: true };
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Validate student full name:
 * - At least 2 names (first + last)
 * - Only alphabetic characters and hyphens
 * - Trims and normalizes whitespace
 */
export function validateStudentName(name: string): { valid: boolean; error?: string; normalized?: string } {
  if (!name || name.trim() === "") {
    return { valid: false, error: "Full name is required" };
  }

  const normalized = name.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter(Boolean);

  if (parts.length < 2) {
    return { valid: false, error: "Please enter at least two names (e.g., First Name Last Name)" };
  }

  const nameRegex = /^[A-Za-z-]+$/;
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return { valid: false, error: `Name "${part}" contains invalid characters. Only letters and hyphens are allowed.` };
    }
    if (part.length < 2) {
      return { valid: false, error: `Each name must be at least 2 characters long.` };
    }
  }

  // Capitalize each part
  const formatted = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");

  return { valid: true, normalized: formatted };
}

/**
 * Validate registration number format: S13/XXXXX/YY
 * Returns the extracted digits for email generation.
 */
export function validateRegNumber(regNumber: string): { valid: boolean; error?: string; digits?: string } {
  if (!regNumber || regNumber.trim() === "") {
    return { valid: false, error: "Registration number is required" };
  }

  const cleaned = regNumber.trim().toUpperCase();

  // Pattern: Letter(s) + digits + / + digits + / + digits (e.g., S13/02928/23)
  const regRegex = /^[A-Z]\d{1,3}\/\d{3,6}\/\d{2}$/;

  if (!regRegex.test(cleaned)) {
    return { valid: false, error: "Invalid registration number format. Expected format: S13/XXXXX/YY (e.g., S13/02928/23)" };
  }

  // Extract digits: everything after the first slash, with second slash removed
  const parts = cleaned.split("/");
  const digits = parts[1] + parts[2]; // e.g., "02928" + "23" = "0292823"

  return { valid: true, digits };
}

/**
 * Generate institutional email from full name and registration number.
 * Format: lastname.registrationDigits@student.egerton.ac.ke
 */
export function generateStudentEmail(fullName: string, regNumber: string): { email?: string; error?: string } {
  const nameResult = validateStudentName(fullName);
  if (!nameResult.valid || !nameResult.normalized) {
    return { error: nameResult.error || "Invalid name" };
  }

  const regResult = validateRegNumber(regNumber);
  if (!regResult.valid || !regResult.digits) {
    return { error: regResult.error || "Invalid registration number" };
  }

  const nameParts = nameResult.normalized.split(" ");
  const lastName = nameParts[nameParts.length - 1].toLowerCase();
  const email = `${lastName}.${regResult.digits}@student.egerton.ac.ke`;

  return { email };
}
