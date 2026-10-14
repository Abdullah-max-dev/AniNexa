const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const loadApi = (name) => import(`${pathToFileURL(path.resolve(__dirname, "../../frontend/src/api.js")).href}?test=${name}`);

test("frontend keeps the access token in memory, sends bearer requests and replaces it after automatic refresh", async (t) => {
    const calls = [];
    const responses = [
        new Response(JSON.stringify({ accessToken: "login-token", user: {} })),
        new Response(JSON.stringify({ user: {} }), { headers: { "X-Access-Token": "renewed-token" } }),
        new Response(JSON.stringify({ user: {} })),
        new Response(JSON.stringify({ success: true })),
        new Response(JSON.stringify({ user: {} })),
    ];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push({ url, options });
        return responses.shift();
    });
    const { authApi } = await loadApi("lifecycle");
    await authApi.login({ email: "test@example.com", password: "Password123" });
    await authApi.me();
    await authApi.me();
    await authApi.logout();
    await authApi.me();
    assert.equal(calls[0].options.headers.get("Authorization"), null);
    assert.equal(calls[1].options.headers.get("Authorization"), "Bearer login-token");
    assert.equal(calls[2].options.headers.get("Authorization"), "Bearer renewed-token");
    assert.equal(calls[3].options.headers.get("Authorization"), "Bearer renewed-token");
    assert.equal(calls[4].options.headers.get("Authorization"), null);
    for (const { options } of calls) {
        assert.equal(options.credentials, "include");
        assert.equal(options.cache, "no-store");
    }
});

test("frontend clears its memory token after logout-all or a 401", async (t) => {
    const calls = [];
    const responses = [
        new Response(JSON.stringify({ accessToken: "first-token" })),
        new Response(JSON.stringify({ success: true })),
        new Response(JSON.stringify({ accessToken: "second-token" })),
        new Response(JSON.stringify({ message: "Session revoked" }), { status: 401 }),
        new Response(JSON.stringify({ user: {} })),
    ];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push(options.headers.get("Authorization"));
        return responses.shift();
    });
    const { authApi } = await loadApi("revocation");
    await authApi.login({});
    await authApi.logoutAll();
    await authApi.login({});
    await assert.rejects(authApi.me(), (error) => error.status === 401);
    await authApi.me();
    assert.deepEqual(calls, [null, "Bearer first-token", null, "Bearer second-token", null]);
});

test("fresh frontend memory restores authentication from a regular request's response header", async (t) => {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push(options.headers.get("Authorization"));
        return new Response(JSON.stringify({ user: {} }), { headers: { "X-Access-Token": "restored-token" } });
    });
    const { authApi } = await loadApi("reload");
    await authApi.me();
    await authApi.me();
    assert.deepEqual(calls, [null, "Bearer restored-token"]);
});
