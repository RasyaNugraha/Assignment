// Small helper functions for users.

const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // R23: min 8 chars + 1 uppercase
const EMAIL_RULE = /^\S+@\S+\.\S+$/;

// Work out age from date of birth (R25).
function computeAge(dateOfBirth, today = new Date()) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return NaN;
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// Remove the password hash and add age before sending a user to the client.
function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, _id, ...publicUser } = user;
  return { ...publicUser, age: computeAge(user.dateOfBirth) };
}

// 8+ chars and 1 uppercase.
function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_RULE.test(password);
}

// Check register fields, returns a list of errors (empty = ok).
function validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth } = {}) {
  const errors = [];
  if (typeof email !== 'string' || !EMAIL_RULE.test(email)) errors.push('A valid email is required.');
  if (typeof firstName !== 'string' || !firstName.trim()) errors.push('First name is required.');
  if (typeof lastName !== 'string' || !lastName.trim()) errors.push('Last name is required.');

  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : null;
  if (!dob || Number.isNaN(dob.getTime())) {
    errors.push('A valid date of birth is required.');
  } else if (dob > new Date()) {
    errors.push('Date of birth cannot be in the future.');
  }

  if (!isValidPassword(password)) {
    errors.push('Password must be at least 8 characters and include an uppercase letter.');
  }
  return errors;
}

module.exports = {
  PASSWORD_RULE,
  computeAge,
  toPublicUser,
  isValidPassword,
  validateRegistrationFields,
};
