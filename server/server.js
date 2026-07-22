const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Placeholder health/status route — real API routes (auth, users, groups,
// rooms, requests, admin logs) land here as they're built out per
// Phase1.md section 6.
app.get('/api/status', (req, res) => {
  res.json({ ok: true, app: 'fabulari-server', phase: 1 });
});

app.listen(PORT, () => {
  console.log(`Fabulari server listening on http://localhost:${PORT}`);
});
