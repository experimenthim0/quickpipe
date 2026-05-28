import express from 'express';
import crypto from 'crypto';
import { Resend } from 'resend';
import User from '../models/User.js';

const router = express.Router();

const MAX_OTP_ATTEMPTS = 5; // Max verification attempts per OTP session

/**
 * @route   POST /api/auth/request-otp
 * @desc    Request a 6-digit magic OTP code for passwordless onboarding/login
 * @access  Public
 */
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Format & validate email input
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Generate cryptographically secure 6-digit OTP code (between 100000 and 999999)
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Check if user exists.
    // If new user: we prepare the user record (which generates their unique permanent syncKey)
    // If existing user: we update their active OTP details.
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Provision user profile with OTP
      user = new User({
        email: normalizedEmail,
        activeOtp: { code, expiresAt, attempts: 0 }
      });
      await user.save();
    } else {
      user.activeOtp = { code, expiresAt, attempts: 0 };
      await user.save();
    }

    // Output OTP token to standard console for local development fallback
    console.log(`\n======================================================`);
    console.log(`[QuickPipe OTP Server] OTP request for: ${normalizedEmail}`);
    console.log(`CODE: ${code} (Expires in 5 minutes)`);
    console.log(`======================================================\n`);

    // Dispatch email notification via Resend if API key is active
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      try {
        await resend.emails.send({
          from: 'QuickPipe <quickpipe@nikhim.me>',
          to: normalizedEmail,
          subject: 'Your QuickPipe Verification Code',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 20px; text-align: center; letter-spacing: -0.5px;">🔗 QuickPipe</div>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">Use the verification code below to authorize your device. This code will expire in <strong>5 minutes</strong>:</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 10px; text-align: center; margin: 28px 0;">
                <span style="font-size: 34px; font-weight: 800; letter-spacing: 5px; color: #3b82f6; font-family: monospace;">${code}</span>
              </div>
              <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </div>
          `
        });
        console.log(`[QuickPipe OTP Server] Resend email successfully dispatched to: ${normalizedEmail}`);
      } catch (emailError) {
        console.error('[QuickPipe OTP Server] Resend email dispatch failed:', emailError.message);
        // Don't fail the request — OTP is also logged to console
      }
    }

    return res.status(200).json({ 
      message: 'OTP sent successfully. Please check your mailbox/console logs.' 
    });
  } catch (error) {
    console.error('[QuickPipe] Error in request-otp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and return the permanent unique syncKey
 * @access  Public
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.activeOtp || !user.activeOtp.code) {
      return res.status(400).json({ error: 'No active OTP session found for this email' });
    }

    // Validate OTP expiration
    const now = new Date();
    if (now > user.activeOtp.expiresAt) {
      // Clear expired OTP
      user.activeOtp = { code: null, expiresAt: null, attempts: 0 };
      await user.save();
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Check attempt limit to prevent brute-force within a single OTP session
    if (user.activeOtp.attempts >= MAX_OTP_ATTEMPTS) {
      user.activeOtp = { code: null, expiresAt: null, attempts: 0 };
      await user.save();
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Match OTP code
    if (user.activeOtp.code !== code.trim()) {
      // Increment attempt counter
      user.activeOtp.attempts = (user.activeOtp.attempts || 0) + 1;
      await user.save();
      
      const remaining = MAX_OTP_ATTEMPTS - user.activeOtp.attempts;
      return res.status(400).json({ 
        error: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
      });
    }

    // Code is correct and valid: Clear active OTP
    user.activeOtp = { code: null, expiresAt: null, attempts: 0 };
    await user.save();

    // Return the user's permanent unique syncKey
    return res.status(200).json({
      message: 'Verification successful',
      syncKey: user.syncKey
    });
  } catch (error) {
    console.error('[QuickPipe] Error in verify-otp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
