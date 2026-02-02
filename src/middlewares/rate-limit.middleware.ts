import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login endpoint
 * 5 requests per minute per IP
 */
export const loginRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per window
    message: {
        status: 'error',
        message: 'Too many login attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
    // Removed custom keyGenerator - use default (which handles IPv6 properly)
});

/**
 * Rate limiter for user creation endpoint
 * 10 requests per minute per IP
 */
export const userCreationRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10,
    message: {
        status: 'error',
        message: 'Too many user creation requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
    // Removed custom keyGenerator - use default (which handles IPv6 properly)
});

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const generalRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: {
        status: 'error',
        message: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
    // Removed custom keyGenerator - use default (which handles IPv6 properly)
});
