# Fabulari — Code Walkthrough (Talking Points)

Plain-English explanations for the parts of the codebase that go slightly beyond
what's been covered in lectures so far, or that could get a "why did you do it
that way?" question in a workshop or the Phase 1 demo. Written so you can
rehearse the answer in your own words — read a section, then try explaining it
out loud without looking, the way you'd say it to Allan.

Each section: **what it does**, **why**, and a short **TL;DR** for quick recall.

---

## 1. Password hashing with bcrypt (`server/routes/auth.js`)

**What it does:** When someone registers or bootstraps, the server never stores
their password as typed. It runs `bcrypt.hash(password, 10)` and stores the
result (`passwordHash`) instead. On login, it doesn't "decrypt" anything — it
runs `bcrypt.compare(typedPassword, storedHash)`, which re-hashes the typed
password the same way and checks if the two hashes match.

**Why:** REQUIREMENTS.md R22 says passwords must never be stored in plain
text. bcrypt is a **one-way hashing function**, not encryption — there's no key
that turns a hash back into the original password, by design. It also
automatically generates a random "salt" per password before hashing, so two
users with the same password get completely different stored hashes, and
precomputed lookup tables (rainbow tables) don't work against it. The `10` is
the "cost factor" — how many rounds of hashing it does, which controls how
slow (and therefore how brute-force-resistant) it is.

**If asked "how would someone recover a forgotten password":** they can't —
that's why REQUIREMENTS.md explicitly has no forgot-password flow (R24). The
only account recovery is registering a new account.

**TL;DR:** Password disimpen dalam bentuk hash (bukan dienkripsi), nggak bisa
dibalikin ke teks asli. Login = hash ulang input, bandingin, bukan "buka" hash lama.

---

## 2. Sessions instead of JWT (`server/server.js`, `express-session`)

**What it does:** After login, the server calls `req.session.userId = user.id`.
The `express-session` middleware turns that into a cookie sent to the browser
(`connect.sid`). Every following request from that browser automatically
includes the cookie, so the server can look up `req.session.userId` and know
who's asking.

**Why:** REQUIREMENTS.md R20 explicitly rules out JWT and says a "basic
session/cookie mechanism" is enough for Phase 1. Sessions are simpler to
reason about for a project this size — the server holds the source of truth
in memory, the client just carries a cookie, no token parsing/signing needed
on the client.

**TL;DR:** Abis login, server kasih cookie ke browser. Browser kirim balik
cookie itu tiap request, server cek cookie itu punya siapa.

---

## 3. JSON file persistence (`server/services/dbService.js`)

**What it does:** All data (users, groups, rooms, requests, admin logs,
messages) lives in one file, `server/data/db.json`, shaped like
`{ users: [], groups: [], ... }`. `dbService.js` wraps every read/write to
that file behind functions like `getAll()`, `insert()`, `update()`, `remove()`
— route handlers (`auth.js` etc.) never touch the filesystem directly, they
only call these functions.

**Why:** REQUIREMENTS.md R36: Phase 1 uses a JSON file because MongoDB isn't
taught until Week 8. But Phase 2 needs to swap to MongoDB without rewriting
every route. By putting **all** file access behind this one module, Phase 2
just needs to rewrite `dbService.js` to use Mongoose models instead — the
routes calling `db.findById('users', id)` don't change at all.

**TL;DR:** Semua akses ke db.json lewat satu file abstraksi ini, biar pas
Phase 2 pindah ke MongoDB, tinggal ganti isi file ini doang, route lain nggak perlu diubah.

---

## 4. `dateOfBirth` instead of a raw `age` number

**What it does:** Registration asks for a birthdate (`<input type="date">`),
not an age number. The server computes age from it fresh on every response
(`computeAge()` in `auth.js`), rather than trusting a stored number.

**Why:** REQUIREMENTS.md R25 needs age for Room age-gating, but a stored
`age: 21` becomes wrong the moment that person has a birthday — nobody's
going to update it. Storing the birthdate and computing age on read means it's
always correct.

**TL;DR:** Age itu selalu dihitung ulang dari tanggal lahir, bukan disimpen
sebagai angka tetap, biar nggak basi.

---

## 5. Angular `AuthService` and `.subscribe()` (`client/src/app/core/auth.service.ts`)

**What it does:** `HttpClient` methods (`http.post`, `http.get`) return an
**Observable**, not the response directly — same "subscribe to a newsletter"
idea from the Week 4 lecture: you don't get data the instant you call the
method, you subscribe and get notified when the response arrives. This
service has one small helper, `toPromise()`, that does exactly that
`.subscribe({ next, error })` call and turns it into a Promise, so the rest
of the app can `await this.auth.login(...)` instead of nesting a
`.subscribe()` callback inside every single component that needs to log in.

**Why:** Same mechanism as taught in class, just written once as a helper
instead of repeating the same subscribe block in five different methods
(`login`, `register`, `bootstrap`, `logout`, `me`).

**TL;DR:** HttpClient balikin Observable, bukan data langsung — makanya harus
`.subscribe()`. Cuma di sini `.subscribe()`-nya dibungkus jadi Promise sekali di satu tempat, biar nggak nulis ulang tiap fungsi.

---

## 6. `inject()` instead of constructor injection

**What it does:** Instead of `constructor(private auth: AuthService) {}`,
components/services do `private auth = inject(AuthService);` as a class field.

**Why:** This is literally what was demoed in the Week 4 lecture — Angular's
moved away from constructor-based DI to the `inject()` function. Functionally
identical, just the modern syntax.

**TL;DR:** Cara baru buat "minta" instance dari sebuah service, ganti dari
constructor ke `inject()`, persis kayak yang didemoin di kelas.

---

## 7. `route.paramMap.subscribe()` instead of `route.snapshot.paramMap.get()`

**What it does:** `GroupViewComponent` and `RoomComponent` read the
`:groupId`/`:roomId` from the URL by subscribing to `route.paramMap`, not by
reading `route.snapshot.paramMap.get(...)` once.

**Why:** This is the exact bug the Week 4 lecture walked through: a snapshot
read only happens once, when the component is first created. If Angular
**reuses** the same component instance because you navigate from one
`/groups/:groupId` to a different `:groupId` (same route, different param),
a snapshot-based read would stay stuck on the very first value. Subscribing
keeps it in sync for as long as the component is alive, and the subscription
is cleaned up in `ngOnDestroy` so it doesn't leak.

**TL;DR:** Snapshot cuma kebaca sekali pas komponen dibikin. Kalo komponennya
di-reuse pas ganti group/room, snapshot nggak update. Subscribe biar selalu ke-update.

---

## 8. Standalone components (no `NgModule`)

**What it does:** Every component has `standalone: true` and its own
`imports: [...]` array (e.g. `CommonModule`, `FormsModule`), instead of being
declared inside an `NgModule`.

**Why:** This is the default Angular has moved to (and what the Week 4 lecture
and `app.config.ts` — `provideRouter`, `provideHttpClient` — already assume).
Each component explicitly lists what it needs, so there's no hidden module
wiring to explain.

**TL;DR:** Angular versi sekarang emang defaultnya gini, tiap komponen bawa
dependency-nya sendiri, bukan didaftarin di NgModule terpisah.

---

## Quick self-test

Before a workshop or the Phase 1 demo, try answering these out loud without
looking back at the code:

1. If I show you a bcrypt hash, can you get the original password back? Why not?
2. What happens on the server the moment someone hits "Log In"?
3. Why is `age` never stored directly in `db.json`?
4. Why does `dbService.js` exist instead of routes reading `db.json` directly?
5. What's the difference between `route.snapshot.paramMap` and
   `route.paramMap.subscribe(...)`, and which bug does the second one avoid?
