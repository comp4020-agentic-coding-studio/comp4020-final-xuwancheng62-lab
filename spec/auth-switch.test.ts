import {JSDOM} from 'jsdom';
import {expect,inject,it} from 'vitest';

// Someone sent to /login without an account (every signed-in page redirects
// there) can reach registration, and back, from the page itself.
const baseUrl = inject('baseUrl');
const url = (path: string) => new URL(path, baseUrl);
const page = async (res: Response) => new JSDOM(await res.text()).window.document;

it('links login and registration to each other, including after a failed attempt', async () => {
  expect((await page(await fetch(url('/login')))).querySelector('.auth-switch a[href="/register"]')).not.toBeNull();
  expect((await page(await fetch(url('/register')))).querySelector('.auth-switch a[href="/login"]')).not.toBeNull();
  const failed = await fetch(url('/login'), {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({username:'spec_nobody', password:'not a real password'})});
  expect(failed.status).toBe(401);
  expect((await page(failed)).querySelector('.auth-switch a[href="/register"]')).not.toBeNull();
  // a signed-in page sends a stranger to the login page that has the link
  expect((await fetch(url('/world'), {redirect:'manual'})).headers.get('location')).toBe('/login');
});
