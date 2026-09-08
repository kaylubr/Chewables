/**
 * Photo endpoint tests, ported from the Python/pytest suite.
 */
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../app.js';
import { db, schema } from '../db/schema.js';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function registerAgent(
	email: string,
	username: string,
): Promise<request.Agent> {
	const agent = request.agent(app);
	await agent.post('/api/auth/register').send({
		email,
		password: 'password123',
		username,
	});
	return agent;
}

function pngBytes(size = 64): Buffer {
	return Buffer.concat([PNG_HEADER, Buffer.alloc(size, 0x30)]);
}

function upload(
	agent: request.Agent,
	overrides: { frame?: string; contentType?: string; body?: Buffer; filename?: string } = {},
) {
	const frame = overrides.frame ?? 'FILM';
	const contentType = overrides.contentType ?? 'image/png';
	const body = overrides.body ?? pngBytes();
	const filename = overrides.filename ?? 'photo.png';
	return agent
		.post('/api/photos')
		.field('frame', frame)
		.attach('file', body, { filename, contentType });
}

describe('photo endpoints', () => {
	it('creates a photo and persists metadata', async () => {
		const agent = await registerAgent('owner@example.com', 'owneruser');
		const resp = await upload(agent);
		expect(resp.status).toBe(201);
		expect(resp.body.frame).toBe('FILM');
		expect(resp.body.storageKey).toMatch(/^users\/.+\.webp$/);
		expect(resp.body.id).toBeTruthy();

		const rows = await db.select().from(schema.photos);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.storageKey).toBe(resp.body.storageKey);
	});

	it('lists only the current users photos', async () => {
		const alice = await registerAgent('alice@example.com', 'aliceuser');
		await upload(alice);
		await upload(alice);

		const bob = await registerAgent('bob@example.com', 'bobuser');
		const bobList = await bob.get('/api/photos');
		expect(bobList.status).toBe(200);
		expect(bobList.body).toEqual([]);

		const aliceList = await alice.get('/api/photos');
		expect(aliceList.status).toBe(200);
		expect(aliceList.body).toHaveLength(2);
	});

	it('blocks fetching another users photo URL', async () => {
		const alice = await registerAgent('alice2@example.com', 'alice2user');
		const created = await upload(alice);
		const photoId = created.body.id;

		const bob = await registerAgent('bob2@example.com', 'bob2user');
		const resp = await bob.get(`/api/photos/${photoId}/url`);
		expect(resp.status).toBe(404);
	});

	it('blocks deleting another users photo', async () => {
		const alice = await registerAgent('alice3@example.com', 'alice3user');
		const bob = await registerAgent('bob3@example.com', 'bob3user');
		const created = await upload(alice);
		const photoId = created.body.id;

		const deleteResp = await bob.delete(`/api/photos/${photoId}`);
		expect(deleteResp.status).toBe(404);
	});

	it('owner can delete photo', async () => {
		const agent = await registerAgent('deleter@example.com', 'deleteruser');
		const created = await upload(agent);
		const photoId = created.body.id;

		const del = await agent.delete(`/api/photos/${photoId}`);
		expect(del.status).toBe(204);
		const listing = await agent.get('/api/photos');
		expect(listing.body).toEqual([]);
	});

	it('rejects invalid frame identifier', async () => {
		const agent = await registerAgent('badframe@example.com', 'badframeuser');
		const resp = await upload(agent, { frame: 'NOT-A-FRAME' });
		expect(resp.status).toBe(422);
	});

	it('rejects unsupported content type', async () => {
		const agent = await registerAgent('badtype@example.com', 'badtypeuser');
		const resp = await upload(agent, { contentType: 'text/plain' });
		expect(resp.status).toBe(422);
	});

	it('rejects empty upload', async () => {
		const agent = await registerAgent('empty@example.com', 'emptyuser');
		const resp = await upload(agent, { body: Buffer.alloc(0) });
		expect(resp.status).toBe(422);
	});

	it('rejects oversized upload', async () => {
		const agent = await registerAgent('big@example.com', 'biguser');
		// 21 MiB, over the 20 MiB limit
		const big = Buffer.alloc(21 * 1024 * 1024, 0x30);
		const resp = await upload(agent, { body: big });
		expect(resp.status).toBe(422);
	});

	it('rejects unauthenticated upload', async () => {
		const resp = await request(app)
			.post('/api/photos')
			.field('frame', 'FILM')
			.attach('file', pngBytes(), { filename: 'photo.png', contentType: 'image/png' });
		expect(resp.status).toBe(401);
	});
});