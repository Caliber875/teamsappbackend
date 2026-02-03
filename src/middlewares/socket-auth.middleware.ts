import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { AuthService } from '../services/auth.service';

export interface AuthSocket extends Socket {
    user?: any;
}

const parseCookies = (cookieString: string) => {
    const list: Record<string, string> = {};
    cookieString && cookieString.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const name = parts.shift()?.trim();
        if (name) {
            list[name] = decodeURIComponent(parts.join('='));
        }
    });
    return list;
};

export const socketAuthMiddleware = (socket: Socket, next: (err?: ExtendedError) => void) => {
    const authSocket = socket as AuthSocket;
    const cookieString = socket.request.headers.cookie || '';
    const cookies = parseCookies(cookieString);

    // Check for token in Cookies OR Handshake Auth (for Ticket-based auth)
    const token = cookies.auth_token || socket.handshake.auth?.token;

    console.log(`🔌 [Socket Auth] Checking connection for socket ${socket.id}`);
    console.log(`🔌 [Socket Auth] Cookies present: ${!!cookieString}`);
    console.log(`🔌 [Socket Auth] Handshake Auth Token present: ${!!socket.handshake.auth?.token}`);

    if (!token) {
        console.error('❌ [Socket Auth] No token found in cookies or handshake');
        return next(new Error('Authentication error: Token missing'));
    }

    try {
        const decoded = AuthService.verifyToken(token);

        if (!decoded) {
            console.error('❌ [Socket Auth] Token verification failed');
            return next(new Error('Authentication error: Invalid token'));
        }

        authSocket.user = decoded;
        console.log(`✅ [Socket Auth] Authenticated user: ${decoded.id}`);
        next();
    } catch (err) {
        console.error('❌ [Socket Auth] Exception during verify:', err);
        return next(new Error('Authentication error: Invalid token'));
    }
};
