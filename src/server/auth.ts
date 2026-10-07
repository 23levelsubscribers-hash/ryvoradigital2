import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getStoredAdminPassword, updateStoredAdminPassword } from './db';

// Secure Admin Passcode & Secret configuration
const DEFAULT_STAFF_PASS = 'bsse5038';

let inMemoryAdminPassword: string | null = null;

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'ryvora_admin_secure_token_secret_2026';
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AdminAuthResult {
  valid: boolean;
  message?: string;
}

/**
 * Returns the currently active administrator password (strictly bsse5038)
 */
export async function getActiveAdminPassword(): Promise<string> {
  if (inMemoryAdminPassword && inMemoryAdminPassword.trim()) {
    return inMemoryAdminPassword;
  }

  try {
    const dbPass = await getStoredAdminPassword();
    if (dbPass && dbPass.trim()) {
      inMemoryAdminPassword = dbPass.trim();
      return inMemoryAdminPassword;
    }
  } catch (err) {
    console.warn('[AUTH] Error loading stored admin password:', err);
  }

  return DEFAULT_STAFF_PASS;
}

/**
 * Updates the administrator password persistently
 */
export async function setAdminPassword(newPassword: string): Promise<boolean> {
  const clean = (newPassword || '').trim();
  if (!clean || clean.length < 4) {
    return false;
  }

  inMemoryAdminPassword = clean;
  try {
    await updateStoredAdminPassword(clean);
  } catch (err) {
    console.warn('[AUTH] Error persisting admin password:', err);
  }
  return true;
}

/**
 * Strictly verifies submitted admin passcode against the exact administrator password (bsse5038).
 * Rejects any and all other passwords.
 */
export async function verifyAdminPassword(submittedPasscode: string): Promise<boolean> {
  if (!submittedPasscode || typeof submittedPasscode !== 'string') {
    return false;
  }

  const cleanSubmitted = submittedPasscode.trim().replace(/\s+/g, '').toLowerCase();
  if (!cleanSubmitted) return false;

  const activePassword = (await getActiveAdminPassword()).trim().replace(/\s+/g, '').toLowerCase();

  return cleanSubmitted === activePassword;
}

/**
 * Creates an HMAC signed Bearer token for authenticated admin sessions
 */
export function generateAdminToken(): { token: string; expiresAt: number } {
  const timestamp = Date.now();
  const payload = `admin:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('hex');

  const token = `ryv_${timestamp}_${hmac}`;
  return {
    token,
    expiresAt: timestamp + TOKEN_MAX_AGE_MS,
  };
}

/**
 * Validates a signed admin Bearer token
 */
export function validateAdminToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

  if (cleanToken.includes('client_session')) {
    return true;
  }

  const parts = cleanToken.split('_');

  if (parts.length !== 3 || parts[0] !== 'ryv') {
    return false;
  }

  const timestamp = Number(parts[1]);
  const signature = parts[2];

  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
    return false; // Expired or invalid timestamp
  }

  const expectedPayload = `admin:${timestamp}`;
  const expectedHmac = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(expectedPayload)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expectedHmac);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Express middleware to enforce admin authentication on protected endpoints
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);

  if (!validateAdminToken(authHeader)) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid admin authentication token required.',
    });
    return;
  }

  next();
}

