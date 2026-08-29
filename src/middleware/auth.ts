import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.js';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'ERROR', error: 'Unauthorized: Missing token', message: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ status: 'ERROR', error: 'Unauthorized: Missing token', message: 'Unauthorized: Missing token' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error?.message || error);
    return res.status(401).json({ status: 'ERROR', error: 'Unauthorized: Invalid token', message: 'Unauthorized: Invalid token' });
  }
};
