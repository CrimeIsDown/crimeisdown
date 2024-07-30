import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('YouTube cors proxy worker', () => {
	it('responds with YouTube page', async () => {
		const request = new Request('http://example.com/youtubelive/', {
			headers: {
				Origin: 'http://localhost',
			},
		});
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toContain('og:video:secure_url');
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost');
	});
});
