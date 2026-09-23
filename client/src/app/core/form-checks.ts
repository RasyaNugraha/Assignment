// Client-side form checks (the server checks the same things again).

export const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // 8+ chars and 1 uppercase (R23)
const EMAIL_RULE = /^\S+@\S+\.\S+$/;

export interface RegistrationForm {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
}

// Returns the first problem with the register / bootstrap form, or null if it's ok.
export function checkRegistration(f: RegistrationForm, today = new Date()): string | null {
  if (!f.firstName.trim() || !f.lastName.trim()) return 'First and last name are required.';
  if (!EMAIL_RULE.test(f.email.trim())) return 'Please enter a valid email.';
  const dob = new Date(f.dateOfBirth);
  if (!f.dateOfBirth || Number.isNaN(dob.getTime())) return 'Please enter your date of birth.';
  if (dob > today) return 'Date of birth cannot be in the future.';
  if (!PASSWORD_RULE.test(f.password)) return 'Password must be at least 8 characters and include an uppercase letter.';
  if (f.password !== f.confirmPassword) return 'Passwords do not match.';
  return null;
}
