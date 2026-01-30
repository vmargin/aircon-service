import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../types';

/**
 * AUTHENTICATION MIDDLEWARE
 * 
 * Verifies JWT and attaches the typed user payload to the request.
 * Using TypeScript's declaration merging for 'req.user' is a pro-level signal.
 */
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access denied: No token" });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("JWT_SECRET environment variable is not set!");
        return res.status(500).json({ error: "Server configuration error" });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Invalid session" });
        }

        // Explicitly casting the decoded token to our AuthUser type
        req.user = decoded as AuthUser;
        next();
    });
};

export default authenticate;
