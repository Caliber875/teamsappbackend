import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../services/auth.service';

const setupPassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID || '',
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback',
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0].value;
                    if (!email) {
                        return done(new Error('No email found in Google profile'));
                    }

                    const domain = email.split('@')[1];

                    // 1. Find or Create the user using our AuthService
                    const user = await AuthService.findOrCreateGoogleUser({
                        id: profile.id,
                        email: email,
                        name: profile.displayName,
                        avatarUrl: profile.photos?.[0].value || '',
                        domain: domain
                    });

                    return done(null, user);
                } catch (error) {
                    return done(error as Error);
                }
            }
        )
    );

    // Note: We don't use serializeUser/deserializeUser because we are using JWT 
    // and session: false in the login paths.
};

export default setupPassport;
