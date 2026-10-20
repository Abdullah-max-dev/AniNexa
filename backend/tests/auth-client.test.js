const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const clientUrl = pathToFileURL(path.resolve(__dirname, '../../frontend/src/features/auth/authApi.js')).href;

test('auth requests send the in-memory bearer token and accept a renewed token header', async (t) => {
    const { requestAuth } = await import(clientUrl);
    let sent;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        sent = { url, options };
        return new Response(JSON.stringify({ user: { id: '1' } }), {
            headers: { 'Content-Type': 'application/json', 'X-Access-Token': 'renewed-token' },
        });
    });

    const result = await requestAuth('/auth/me', { token: 'access-token' });
    assert.equal(sent.url, '/api/auth/me');
    assert.equal(sent.options.headers.get('Authorization'), 'Bearer access-token');
    assert.equal(sent.options.credentials, 'include');
    assert.equal(sent.options.cache, 'no-store');
    assert.equal(result.renewedAccessToken, 'renewed-token');
    assert.equal(result.data.user.id, '1');
});

test('login sends JSON without a bearer token and preserves backend errors', async (t) => {
    const { requestAuth } = await import(clientUrl);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/auth/login');
        assert.equal(options.headers.get('Authorization'), null);
        assert.equal(options.headers.get('Content-Type'), 'application/json');
        assert.deepEqual(JSON.parse(options.body), { email: 'test@example.com', password: 'password' });
        return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 });
    });

    await assert.rejects(
        requestAuth('/auth/login', { method: 'POST', body: { email: 'test@example.com', password: 'password' } }),
        (error) => error.status === 401 && error.message === 'Invalid credentials',
    );
});
