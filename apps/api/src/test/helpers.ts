import { newDb } from 'pg-mem';
import { Database } from '../database';
import { SessionService, SID } from '../session.service';
import { SpotifyService } from '../spotify.service';

process.env.APP_SECRET ??= 'test-secret-test-secret-test-secret-0123';

/** A migrated database on an in-memory Postgres (pg-mem). */
export async function memoryDatabase() {
  const { Pool } = newDb().adapters.createPg();
  const db = new Database(new Pool());
  await db.migrate();
  return db;
}

/** An in-memory database with one signed-in user, optionally connected to Spotify. */
export async function testApp({ spotify = true }: { spotify?: boolean } = {}) {
  const db = await memoryDatabase();
  const sessions = new SessionService(db);
  const spotifyService = new SpotifyService(db);
  const user = await db.upsertGoogleUser({ sub: 'google-1', email: 'listener@example.com', name: 'Listener', picture: null });
  const sessionId = await sessions.create(user.id);
  const req = { cookies: { [SID]: sessionId }, query: {} } as any;
  const csrf = (await sessions.current(req))!.csrf;
  if (spotify) await db.putSpotifyLink({ userId: user.id, spotifyUserId: 'sp-1', spotifyName: 'Listener', accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 10 * 60_000 });
  return { db, sessions, spotify: spotifyService, user, sessionId, req, csrf };
}

/** A second signed-in user in the same database. */
export async function signIn(db: Database, sessions: SessionService, sub: string, name: string) {
  const user = await db.upsertGoogleUser({ sub, email: `${sub}@example.com`, name, picture: null });
  const sessionId = await sessions.create(user.id);
  const req = { cookies: { [SID]: sessionId }, query: {} } as any;
  return { user, req, csrf: (await sessions.current(req))!.csrf };
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
