// Shared E2E setup: create users, a group and a room through the API.
import { APIRequestContext, Browser, Page, request } from '@playwright/test';

export const PASSWORD = 'Password1';
const BASE = 'http://localhost:4300';

// Register form fields for a test user.
export function userFields(name: string, dateOfBirth = '1995-05-05') {
  return { email: `${name}@e2e.com`, password: PASSWORD, firstName: name, lastName: 'E2E', dateOfBirth };
}

// A logged-in API client for one user.
async function apiAs(path: string, body: object): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  const res = await ctx.post(path, { data: body });
  if (!res.ok()) throw new Error(`${path} failed: ${res.status()} ${await res.text()}`);
  return ctx;
}

export interface World {
  groupId: string;
  roomId: string;
}

// Super admin + alice (group admin) + bob & carol (members) + one room "general".
export async function buildWorld(): Promise<World> {
  const superAdmin = await apiAs('/api/bootstrap', userFields('super'));
  const alice = await apiAs('/api/auth/register', userFields('alice'));
  const bob = await apiAs('/api/auth/register', userFields('bob'));
  const carol = await apiAs('/api/auth/register', userFields('carol'));
  await apiAs('/api/auth/register', userFields('kid', new Date(Date.now() - 10 * 365 * 864e5).toISOString().slice(0, 10)));

  const groupReq = await (await alice.post('/api/groups/requests', { data: { title: 'E2E Group', description: 'end to end', minAge: 0 } })).json();
  await superAdmin.post(`/api/requests/${groupReq.id}/approve`);
  const group = (await (await alice.get('/api/groups')).json()).find((g: { title: string }) => g.title === 'E2E Group');

  for (const member of [bob, carol]) {
    const join = await (await member.post(`/api/groups/${group.id}/join`)).json();
    await alice.post(`/api/requests/${join.id}/approve`);
  }
  const roomReq = await (await alice.post(`/api/groups/${group.id}/rooms/requests`, { data: { name: 'general', minAge: 0 } })).json();
  await alice.post(`/api/requests/${roomReq.id}/approve`);
  const detail = await (await alice.get(`/api/groups/${group.id}`)).json();

  await Promise.all([superAdmin, alice, bob, carol].map((c) => c.dispose()));
  return { groupId: group.id, roomId: detail.rooms[0].id };
}

// Open a new browser window and log in through the real login form.
export async function loginAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${name}@e2e.com`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL('**/groups');
  return page;
}
