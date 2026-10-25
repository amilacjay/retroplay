import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { createPool, Database } from './database';
import { GoogleService } from './google.service';
import { ProfileController } from './profile.controller';
import { SessionService } from './session.service';
import { SharesController } from './shares.controller';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';

@Module({
  // SpotifyController declares `api/playlists/mine` before `api/playlists/:id`; keep that order inside it.
  controllers: [AuthController, ProfileController, SharesController, SpotifyController],
  providers: [{ provide: Database, useFactory: async () => { const db = new Database(createPool()); await db.migrate(); return db; } }, SessionService, GoogleService, SpotifyService],
})
export class AppModule {}
