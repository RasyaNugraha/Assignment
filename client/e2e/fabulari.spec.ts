// E2E: whole app in a real browser (Playwright).
import { expect, test } from '@playwright/test';
import { buildWorld, loginAs, World } from './helpers';

test.describe.configure({ mode: 'serial' }); // tests share one database, run in order

let world: World;

test.beforeAll(async () => {
  world = await buildWorld();
});

test('login form: wrong password shows an error, right password opens the groups page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('alice@e2e.com');
  await page.getByLabel('Password').fill('WrongPass1');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();

  await page.getByLabel('Password').fill('Password1');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('heading', { name: 'My Groups' })).toBeVisible();
});

test('register form checks the password before sending it', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('First name').fill('Weak');
  await page.getByLabel('Last name').fill('Pass');
  await page.getByLabel('Email').fill('weak@e2e.com');
  await page.getByLabel('Date of birth').fill('2000-01-01');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password').fill('short');
  await page.getByRole('button', { name: /create account|register|sign up/i }).click();
  await expect(page.getByText(/at least 8 characters/)).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('three users chat live; the one who leaves stops getting messages', async ({ browser }) => {
  const roomUrl = `/groups/${world.groupId}/rooms/${world.roomId}`;
  const alice = await loginAs(browser, 'alice');
  const bob = await loginAs(browser, 'bob');
  const carol = await loginAs(browser, 'carol');

  for (const page of [alice, bob, carol]) {
    await page.goto(roomUrl);
    await expect(page.getByRole('heading', { name: '#general' })).toBeVisible();
  }
  await expect(alice.locator('.room__online')).toContainText('Online (3)');

  // Alice sends, both others see it.
  await alice.getByLabel('Message', { exact: true }).fill('Hello everyone');
  await alice.getByLabel('Message', { exact: true }).press('Enter');
  await expect(bob.getByText('Hello everyone')).toBeVisible();
  await expect(carol.getByText('Hello everyone')).toBeVisible();

  // Carol leaves: the others get a popup, and she no longer receives messages.
  await carol.getByRole('button', { name: 'Leave Room' }).click();
  await expect(alice.getByText('carol E2E left the room')).toBeVisible();
  await bob.getByLabel('Message', { exact: true }).fill('Carol cannot see this');
  await bob.getByLabel('Message', { exact: true }).press('Enter');
  await expect(alice.getByText('Carol cannot see this')).toBeVisible();
  await carol.waitForTimeout(500);
  await carol.goto(`/groups/${world.groupId}`);
  await expect(carol.getByText('Carol cannot see this')).toHaveCount(0);

  // Carol comes back and gets the last messages (max 5) from the server.
  await carol.goto(roomUrl);
  await expect(carol.getByText('Carol cannot see this')).toBeVisible();

  // Bob deletes his message, it disappears for everyone.
  await bob.locator('article.message--mine', { hasText: 'Carol cannot see this' }).getByRole('button', { name: /delete/i }).click();
  await expect(alice.getByText('Carol cannot see this')).toHaveCount(0);
  await expect(carol.getByText('Carol cannot see this')).toHaveCount(0);
});

test('a user who is too young is blocked from joining the group', async ({ browser }) => {
  // Alice raises the group age limit, then the 10-year-old tries to join.
  const alice = await loginAs(browser, 'alice');
  await alice.request.patch(`/api/groups/${world.groupId}`, { data: { minAge: 13 } });
  const kid = await loginAs(browser, 'kid');
  await kid.getByRole('button', { name: 'Request to Join' }).first().click();
  await expect(kid.getByRole('alert')).toContainText('You must be at least 13');
});

test('group search finds groups by title', async ({ browser }) => {
  const bob = await loginAs(browser, 'bob');
  await bob.getByLabel('Search').fill('nothing-matches-this');
  await bob.getByRole('button', { name: 'Search' }).click();
  await expect(bob.getByText('No groups found.')).toBeVisible();
  await bob.getByLabel('Search').fill('e2e');
  await bob.getByRole('button', { name: 'Search' }).click();
  await expect(bob.locator('.group-card')).toHaveCount(1);
});
