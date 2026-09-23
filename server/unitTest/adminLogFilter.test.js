const assert = require('assert');
const { buildLogFilter } = require('../routes/adminLogs');

describe('adminLogs #buildLogFilter()', () => {
  it('returns an empty filter (match everything) when no query is given', () => {
    assert.deepStrictEqual(buildLogFilter({}), {});
  });
  it('filters by action type', () => {
    assert.deepStrictEqual(buildLogFilter({ action: 'group_created' }), { action: 'group_created' });
  });
  it('builds a timestamp range from/to as ISO strings', () => {
    const filter = buildLogFilter({ from: '2026-09-01', to: '2026-09-30' });
    assert.deepStrictEqual(filter, {
      timestamp: { $gte: '2026-09-01T00:00:00.000Z', $lte: '2026-09-30T00:00:00.000Z' },
    });
  });
  it('ignores invalid dates instead of failing', () => {
    assert.deepStrictEqual(buildLogFilter({ from: 'garbage' }), {});
  });
});
