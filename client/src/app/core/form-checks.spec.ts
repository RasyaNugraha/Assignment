import { checkRegistration, RegistrationForm } from './form-checks';

const valid: RegistrationForm = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@test.com',
  dateOfBirth: '2000-01-01',
  password: 'Password1',
  confirmPassword: 'Password1',
};

describe('checkRegistration()', () => {
  it('returns null for a valid form', () => {
    expect(checkRegistration(valid)).toBeNull();
  });

  it('needs first and last name', () => {
    expect(checkRegistration({ ...valid, firstName: '  ' })).toBe('First and last name are required.');
  });

  it('checks the email', () => {
    expect(checkRegistration({ ...valid, email: 'nope' })).toBe('Please enter a valid email.');
  });

  it('rejects a date of birth in the future', () => {
    expect(checkRegistration({ ...valid, dateOfBirth: '2999-01-01' })).toBe('Date of birth cannot be in the future.');
  });

  it('checks password strength and that both passwords match', () => {
    expect(checkRegistration({ ...valid, password: 'weak', confirmPassword: 'weak' })).toContain('at least 8 characters');
    expect(checkRegistration({ ...valid, confirmPassword: 'Password2' })).toBe('Passwords do not match.');
  });
});
