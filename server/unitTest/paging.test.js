const assert = require('assert');
const { parsePaging, escapeRegex, buildGroupFilter, MAX_PAGE_SIZE } = require('../services/paging');

describe('paging helpers', () => {
  describe('#parsePaging()', () => {
    it('returns null when no page is asked for', () => {
      assert.equal(parsePaging({}), null);
    });
    it('reads page and pageSize', () => {
      assert.deepStrictEqual(parsePaging({ page: '2', pageSize: '5' }), { page: 2, pageSize: 5 });
    });
    it('uses the default size and fixes bad numbers', () => {
      assert.deepStrictEqual(parsePaging({ page: 'abc' }, 12), { page: 1, pageSize: 12 });
      assert.deepStrictEqual(parsePaging({ page: '-3', pageSize: '0' }, 12), { page: 1, pageSize: 12 });
    });
    it('caps the page size', () => {
      assert.equal(parsePaging({ page: '1', pageSize: '9999' }).pageSize, MAX_PAGE_SIZE);
    });
  });

  describe('#escapeRegex()', () => {
    it('escapes regex characters', () => {
      assert.equal(escapeRegex('a+b (c)'), 'a\\+b \\(c\\)');
    });
  });

  describe('#buildGroupFilter()', () => {
    it('returns an empty filter by default', () => {
      assert.deepStrictEqual(buildGroupFilter({}), {});
    });
    it('searches title and description, case-insensitive', () => {
      const f = buildGroupFilter({ search: ' chess ' });
      assert.deepStrictEqual(f.$or, [
        { title: { $regex: 'chess', $options: 'i' } },
        { description: { $regex: 'chess', $options: 'i' } },
      ]);
    });
    it('filters by max age', () => {
      assert.deepStrictEqual(buildGroupFilter({ maxAge: '16' }), { minAge: { $lte: 16 } });
    });
    it('filters to my groups', () => {
      assert.deepStrictEqual(buildGroupFilter({ mine: 'true' }, { id: 'u1' }), { memberIds: 'u1' });
    });
  });
});
