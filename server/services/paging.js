// Helpers for search + pagination (Week 8: skip/limit).

const MAX_PAGE_SIZE = 50;

// Read ?page=&pageSize= from the query. Returns null when no page was asked for.
function parsePaging(query = {}, defaultSize = 12) {
  if (query.page === undefined) return null;
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const size = Number.parseInt(query.pageSize, 10) || defaultSize;
  return { page, pageSize: Math.min(Math.max(1, size), MAX_PAGE_SIZE) };
}

// Escape regex characters so a search like "a+b" is matched as plain text.
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mongo filter for the group list: title/description search, max min-age, my groups only.
function buildGroupFilter({ search, maxAge, mine } = {}, currentUser = null) {
  const filter = {};
  if (search && String(search).trim()) {
    const pattern = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  const age = Number.parseInt(maxAge, 10);
  if (!Number.isNaN(age) && age >= 0) filter.minAge = { $lte: age };
  if (mine === 'true' || mine === '1') filter.memberIds = currentUser ? currentUser.id : '__nobody__';
  return filter;
}

module.exports = { MAX_PAGE_SIZE, parsePaging, escapeRegex, buildGroupFilter };
