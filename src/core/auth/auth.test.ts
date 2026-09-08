import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../app.js';
import { db, schema } from '../db/index.js';

async function registerUser(res: request.Agent | request.SuperTest<request.Test>) {
	return res.post('/api/auth/register').send({
		email: 'user@example.com',
		password: 'password123',
		username: 'user',
	});
}

describe('auth endpoints', () => {
	it('registers a user and returns a token + user', async () => {
		const resp = await registerUser(request(app));
		expect(resp.status).toBe(201);
		expect(resp.body.token_type).toBe('bearer');
		expect(resp.body.user.email).toBe('user@example.com');
		expect(resp.body.user.username).toBe('user');
	});

	it('does not store the password in plaintext', async () => {
		await registerUser(request(app));
		const users = await db.select().from(schema.users);
		expect(users).toHaveLength(1);
		const accounts = await db.select().from(schema.account);
		expect(accounts).toHaveLength(1);
		expect(accounts[0]?.password).toBeTruthy();
		expect(accounts[0]?.password).not.toBe('password123');
	});

	it('rejects duplicate email registration', async () => {
		const r = request(app);
		await registerUser(r);
		const second = await r.post('/api/auth/register').send({
			email: 'user@example.com',
			password: 'password123',
			username: 'otheruser',
		});
		expect(second.status).toBe(409);
	});

	it('rejects duplicate username registration', async () => {
		const r = request(app);
		await registerUser(r);
		const second = await r.post('/api/auth/register').send({
			email: 'other@example.com',
			password: 'password123',
			username: 'user',
		});
		expect(second.status).toBe(409);
	});

	it('rejects username with bad characters', async () => {
		for (const bad of ['has space', 'has/slash', 'UPPER', '', 'ab']) {
			const resp = await request(app).post('/api/auth/register').send({
				email: 'bad@example.com',
				password: 'password123',
				username: bad,
			});
			expect(resp.status).toBe(422);
		}
	});

	it('logs in successfully with username', async () => {
		await registerUser(request(app));
		const resp = await request(app).post('/api/auth/login').send({
			username: 'user',
			password: 'password123',
		});
		expect(resp.status).toBe(200);
		expect(resp.body.user.username).toBe('user');
	});

	it('fails login with invalid password', async () => {
		await registerUser(request(app));
		const resp = await request(app).post('/api/auth/login').send({
			username: 'user',
			password: 'wrong-password',
		});
		expect(resp.status).toBe(401);
	});

	it('blocks unauthenticated /me', async () => {
		const resp = await request(app).get('/api/auth/me');
		expect(resp.status).toBe(401);
	});

	it('rejects invalid token', async () => {
		const resp = await request(app)
			.get('/api/auth/me')
			.set('Authorization', 'Bearer not-a-real-token');
		expect(resp.status).toBe(401);
	});

	it('returns the registered user via /me with session cookie', async () => {
		const agent = request.agent(app);
		await agent.post('/api/auth/register').send({
			email: 'me@example.com',
			password: 'password123',
			username: 'meuser',
		});
		const resp = await agent.get('/api/auth/me');
		expect(resp.status).toBe(200);
		expect(resp.body.email).toBe('me@example.com');
		expect(resp.body.username).toBe('meuser');
	});

	it('rejects short password', async () => {
		const resp = await request(app).post('/api/auth/register').send({
			email: 'short@example.com',
			password: 'short',
			username: 'shortuser',
		});
		expect(resp.status).toBe(422);
	});

	it('rejects invalid email', async () => {
		const resp = await request(app).post('/api/auth/register').send({
			email: 'not-an-email',
			password: 'password123',
			username: 'bademail',
		});
		expect(resp.status).toBe(422);
	});

	it('rejects missing username', async () => {
		const resp = await request(app).post('/api/auth/register').send({
			email: 'nouser@example.com',
			password: 'password123',
		});
		expect(resp.status).toBe(422);
	});
});