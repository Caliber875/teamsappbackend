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
    const token = cookies.auth_token;

    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    try {
        const decoded = AuthService.verifyToken(token);

        if (!decoded) {
            return next(new Error('Authentication error: Invalid token'));
        }

        authSocket.user = decoded;
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};
