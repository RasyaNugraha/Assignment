// Unit tests (Week 10): pure functions, Node's built-in `assert`, no DB.
const assert = require('assert');
const { computeAge, toPublicUser, isValidPassword, validateRegistrationFields } = require('../services/userUtils');

describe('userUtils', () => {
  describe('#computeAge()', () => {
    const today = new Date(2026, 8, 23); // 23 Sep 2026 (month is 0-based)

    it('returns the full age when the birthday has already passed this year', () => {
      assert.equal(computeAge('2000-01-15', today), 26);
    });
    it('subtracts one when the birthday has not happened yet this year', () => {
      assert.equal(computeAge('2000-12-01', today), 25);
    });
    it('counts the birthday itself as already had', () => {
      assert.equal(computeAge('2010-09-23', today), 16);
    });
    it('returns NaN for an invalid date', () => {
      assert.ok(Number.isNaN(computeAge('not-a-date', today)));
    });
  });

  describe('#toPublicUser()', () => {
    it('removes the password hash and Mongo _id, and adds a computed age', () => {
      const user = { id: 'u1', _id: 'x', email: 'a@b.com', passwordHash: 'secret', dateOfBirth: '1990-01-01' };
      const result = toPublicUser(user);
      assert.equal(result.passwordHash, undefined);
      assert.equal(result._id, undefined);
      assert.equal(result.email, 'a@b.com');
      assert.equal(typeof result.age, 'number');
    });
    it('returns null for a missing user', () => {
      assert.equal(toPublicUser(null), null);
    });
  });

  describe('#isValidPassword()', () => {
    it('accepts 8+ characters with an uppercase letter', () => {
      assert.equal(isValidPassword('Password1'), true);
    });
    it('rejects a password without an uppercase letter', () => {
      assert.equal(isValidPassword('password1'), false);
    });
    it('rejects a password shorter than 8 characters', () => {
      assert.equal(isValidPassword('Pass1'), false);
    });
  });

  describe('#validateRegistrationFields()', () => {
    const valid = {
      email: 'user@test.com',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '2000-01-01',
    };
    it('returns no errors for valid fields', () => {
      assert.deepStrictEqual(validateRegistrationFields(valid), []);
    });
    it('reports a bad email', () => {
      assert.equal(validateRegistrationFields({ ...valid, email: 'nope' }).length, 1);
    });
    it('reports a date of birth in the future', () => {
      const errors = validateRegistrationFields({ ...valid, dateOfBirth: '2999-01-01' });
      assert.ok(errors.includes('Date of birth cannot be in the future.'));
    });
    it('reports every missing field at once', () => {
      assert.equal(validateRegistrationFields({}).length, 5);
    });
  });
});
