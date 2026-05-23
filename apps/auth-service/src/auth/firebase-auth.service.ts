import { Injectable, Logger, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FirebaseGoogleProfile {
  uid: string;
  email: string;
  displayName: string;
  picture?: string;
}

@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase Admin not configured — POST /auth/firebase will be unavailable');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    this.initialized = true;
    this.logger.log('Firebase Admin initialized');
  }

  async verifyIdToken(idToken: string): Promise<FirebaseGoogleProfile> {
    if (!this.initialized) {
      throw new UnauthorizedException('Google sign-in is not configured on the server');
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded.email) {
        throw new UnauthorizedException('Google account must have an email');
      }
      return {
        uid: decoded.uid,
        email: decoded.email,
        displayName: decoded.name || decoded.email.split('@')[0],
        picture: decoded.picture,
      };
    } catch (err: any) {
      this.logger.warn(`Firebase token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid Google sign-in token');
    }
  }
}
