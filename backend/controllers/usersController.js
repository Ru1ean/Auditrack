const fs = require('fs');
const path = require('path');
const db = require('../db');
const { recordLog } = require('./logsController');
const loginRateLimiter = require('../middleware/loginRateLimiter');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createNotifications } = require('../utils/notificationService');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const COMPANY_EMAIL_DOMAIN = '@lccbonline.edu.ph';
const isCompanyEmail = (email) => normalizeEmail(email).endsWith(COMPANY_EMAIL_DOMAIN);
const pendingRegistrationStore = new Map();
const pendingPasswordChangeStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000;
const INVITE_TTL_MS = 10 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || 'MY_SECRET_KEY';
const INVITE_TOKEN_SECRET = process.env.INVITE_TOKEN_SECRET || JWT_SECRET;

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const cleanExpiredPasswordChangeRequests = () => {
  const now = Date.now();
  for (const [userid, entry] of pendingPasswordChangeStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      pendingPasswordChangeStore.delete(userid);
    }
  }
};

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
};

const verifyInviteTokenPayload = (token) => {
  if (!token) {
    return { success: false, status: 400, message: 'Invite token is required' };
  }

  try {
    const decoded = jwt.verify(token, INVITE_TOKEN_SECRET);
    if (decoded?.type !== 'registration_invite') {
      return { success: false, status: 400, message: 'Invalid invite link' };
    }

    const roleid = Number.parseInt(decoded.roleid, 10) || 2;
    return {
      success: true,
      invite: {
        email: decoded.email ? normalizeEmail(decoded.email) : null,
        roleid,
        allowAnyEmail: Boolean(decoded.allowAnyEmail),
        expiresAt: decoded.exp ? decoded.exp * 1000 : Date.now() + INVITE_TTL_MS,
      },
    };
  } catch (error) {
    const isExpired = error?.name === 'TokenExpiredError';
    return {
      success: false,
      status: isExpired ? 410 : 400,
      message: isExpired ? 'Invite link expired' : 'Invalid invite link',
    };
  }
};

const cleanExpiredPendingRegistrations = () => {
  const now = Date.now();
  for (const [email, entry] of pendingRegistrationStore.entries()) {
    if (!entry || entry.expiresAt <= now) pendingRegistrationStore.delete(email);
  }
};

const createPendingRegistration = async (registrationData) => {
  const firstname = String(registrationData.firstname || '').trim();
  const middleinitial = String(registrationData.middleinitial || '').trim();
  const lastname = String(registrationData.lastname || '').trim();
  const password = String(registrationData.password || '');
  const email = normalizeEmail(registrationData.email);
  const inviteToken = String(registrationData.inviteToken || '').trim();
  let roleid = Number.parseInt(registrationData.roleid, 10) || 2;
  let allowAnyEmail = false;

  if (inviteToken) {
    const inviteResult = verifyInviteTokenPayload(inviteToken);
    if (!inviteResult.success) return inviteResult;

    const invite = inviteResult.invite;
    if (invite.email && invite.email !== email) {
      return { success: false, status: 403, message: 'This invite link is for a different email address' };
    }

    roleid = invite.roleid;
    if (invite.allowAnyEmail) allowAnyEmail = true;
  }

  if (!firstname || !lastname || !email || !password) {
    return { success: false, status: 400, message: 'First name, last name, email, and password are required' };
  }

  const isAuditor = Number(roleid) === 4;
  if (!isCompanyEmail(email) && !isAuditor && !allowAnyEmail) {
    return { success: false, status: 400, message: `Only ${COMPANY_EMAIL_DOMAIN} email addresses can register` };
  }

  const [existingUsers] = await db.query('SELECT userid FROM users WHERE Email = ?', [email]);
  if (existingUsers.length > 0) {
    return { success: false, status: 400, message: 'Email already registered' };
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  pendingRegistrationStore.set(email, {
    registrationData: {
      firstname,
      middleinitial: middleinitial || null,
      lastname,
      email,
      passwordhash: crypto.createHash('md5').update(password).digest('hex'),
      roleid,
      inviteToken: inviteToken || null,
    },
    otpHash: hashValue(otp),
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  return { success: true, email, otp, roleid };
};

const generateOtpEmailHtml = (otp) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Auditrack Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.07); border: 1px solid #e2e8f0; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 30px 24px 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <img src="cid:auditrack-logo" alt="Auditrack Logo" width="58" height="58" style="display: block; margin: 0 auto; border-radius: 12px; object-fit: contain;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e40af; letter-spacing: -0.3px;">Auditrack</h1>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">Compliance & Accreditation Portal</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: center;">
                Account Verification Code
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
                Thank you for registering on <strong>Auditrack</strong>. Use the 6-digit verification code below to verify your email and complete your setup.
              </p>

              <!-- Emphasized OTP Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 100%; max-width: 360px; background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%); border: 2px dashed #93c5fd; border-radius: 14px; padding: 18px 12px; text-align: center;">
                      <div style="font-family: 'Courier New', Consolas, Menlo, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #1e40af; padding: 4px 0; margin-left: 10px;">
                        ${otp}
                      </div>
                      <div style="margin-top: 10px; display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px;">
                        &#9201; Valid for 10 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border-left: 3px solid #3b82f6; padding: 12px 14px; margin-bottom: 22px;">
                <tr>
                  <td style="font-size: 12px; color: #475569; line-height: 1.5;">
                    <strong style="color: #1e293b;">Security Reminder:</strong> Never share your verification PIN with anyone. Auditrack will never ask for your PIN or password.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
                If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 3px 0; font-size: 11px; color: #64748b; font-weight: 600;">
                Auditrack Compliance Management System
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                La Consolacion College Bacolod • Automated System Message
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const generatePasswordChangeOtpEmailHtml = (otp, userName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auditrack - Password Change Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.07); border: 1px solid #e2e8f0; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 30px 24px 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <img src="cid:auditrack-logo" alt="Auditrack Logo" width="58" height="58" style="display: block; margin: 0 auto; border-radius: 12px; object-fit: contain;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e40af; letter-spacing: -0.3px;">Auditrack</h1>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">Account Security</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: center;">
                Password Change Verification
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
                Hello${userName ? ` <strong>${userName}</strong>` : ''}, we received a request to change your account password. Enter the 6-digit one-time PIN below to verify your identity.
              </p>

              <!-- Emphasized OTP Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 100%; max-width: 360px; background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%); border: 2px dashed #93c5fd; border-radius: 14px; padding: 18px 12px; text-align: center;">
                      <div style="font-family: 'Courier New', Consolas, Menlo, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #1e40af; padding: 4px 0; margin-left: 10px;">
                        ${otp}
                      </div>
                      <div style="margin-top: 10px; display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px;">
                        &#9201; Valid for 10 minutes
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-radius: 10px; border-left: 3px solid #ef4444; padding: 12px 14px; margin-bottom: 22px;">
                <tr>
                  <td style="font-size: 12px; color: #991b1b; line-height: 1.5;">
                    <strong style="color: #7f1d1d;">Security Warning:</strong> If you did NOT request to change your password, please ignore this email or notify your system administrator immediately.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
                Never share this verification code with anyone. Auditrack staff will never ask for your code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 3px 0; font-size: 11px; color: #64748b; font-weight: 600;">
                Auditrack Compliance Management System
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                La Consolacion College Bacolod • Automated Security Message
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const sendOtpEmail = async (email, otp, customSubject, customHtml, customText) => {
  const subject = customSubject || `${otp} is your Auditrack verification code`;
  const text = customText || `Your Auditrack registration one-time PIN is ${otp}. It expires in 10 minutes.`;
  const rawHtml = customHtml || generateOtpEmailHtml(otp);

  const logoCandidates = [
    path.join(__dirname, '../assets/logo.png'),
    path.join(__dirname, '../../frontend/public/logo.png'),
    path.join(__dirname, '../../../Compliance-audit-mobile/assets/images/logo.png'),
  ];
  const logoPath = logoCandidates.find((p) => fs.existsSync(p));
  const publicBackendUrl = (process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'https://compliance-audit.onrender.com').replace(/\/$/, '');
  const htmlWithPublicLogo = rawHtml.replace(/cid:auditrack-logo/g, `${publicBackendUrl}/assets/logo.png`);

  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || user || 'noreply@auditrack.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Auditrack Compliance';

  // 1. Google Apps Script Gmail Webhook (works on Render Free Tier over HTTPS port 443 using your Gmail)
  const gmailWebhookUrl = String(process.env.GMAIL_WEBHOOK_URL || process.env.GAS_WEBHOOK_URL || '').trim();
  if (gmailWebhookUrl) {
    try {
      const logoBase64 = logoPath ? fs.readFileSync(logoPath).toString('base64') : null;
      const response = await fetch(gmailWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          to: email,
          subject,
          text,
          html: logoBase64 ? rawHtml : htmlWithPublicLogo,
          senderName,
          logoBase64,
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      const respText = await response.text();
      let parsed = null;
      try {
        parsed = JSON.parse(respText);
      } catch {}

      if (!response.ok || (parsed && parsed.sent === false)) {
        const errDetail = parsed?.error || respText || `HTTP ${response.status}`;
        console.warn(`[OTP] Gmail Webhook send failed for ${email}:`, errDetail);
        return { sent: false, reason: `Gmail Webhook error: ${errDetail}` };
      }

      return { sent: true };
    } catch (error) {
      const errorMsg = error?.message || String(error);
      console.warn(`[OTP] Gmail Webhook request failed for ${email}:`, errorMsg);
      return { sent: false, reason: `Gmail Webhook request failed: ${errorMsg}` };
    }
  }

  // 2. Brevo HTTP API (works on Render Free Tier over HTTPS port 443)
  const brevoApiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject,
          textContent: text,
          htmlContent: htmlWithPublicLogo,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[OTP] Brevo API send failed (${response.status}) for ${email}:`, errBody);
        return { sent: false, reason: `Brevo API error (${response.status}): ${errBody}` };
      }

      return { sent: true };
    } catch (error) {
      const errorMsg = error?.message || String(error);
      console.warn(`[OTP] Brevo API request failed for ${email}:`, errorMsg);
      return { sent: false, reason: `Brevo API request failed: ${errorMsg}` };
    }
  }

  // 2. Resend HTTP API (works on Render Free Tier over HTTPS port 443)
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey) {
    try {
      const resendFrom = process.env.RESEND_FROM || `${senderName} <onboarding@resend.dev>`;
      const attachments = [];
      if (logoPath) {
        attachments.push({
          filename: 'logo.png',
          content: fs.readFileSync(logoPath).toString('base64'),
          content_id: 'auditrack-logo',
        });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject,
          text,
          html: attachments.length > 0 ? rawHtml : htmlWithPublicLogo,
          ...(attachments.length > 0 ? { attachments } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[OTP] Resend API send failed (${response.status}) for ${email}:`, errBody);
        return { sent: false, reason: `Resend API error (${response.status}): ${errBody}` };
      }

      return { sent: true };
    } catch (error) {
      const errorMsg = error?.message || String(error);
      console.warn(`[OTP] Resend API request failed for ${email}:`, errorMsg);
      return { sent: false, reason: `Resend API request failed: ${errorMsg}` };
    }
  }

  // 3. Fallback: Nodemailer SMTP (for local development or paid hosting with open SMTP ports)
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    console.warn('[OTP] nodemailer is not installed');
    return { sent: false, reason: 'nodemailer missing' };
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const pass = String(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    return { sent: false, reason: 'Email service is not configured (set GMAIL_WEBHOOK_URL, BREVO_API_KEY, RESEND_API_KEY, or SMTP credentials)' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  const attachments = [];
  if (logoPath) {
    attachments.push({
      filename: 'logo.png',
      path: logoPath,
      cid: 'auditrack-logo',
    });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Auditrack Compliance" <${user}>`,
      to: email,
      subject,
      text,
      html: rawHtml,
      attachments,
    });
    return { sent: true };
  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.warn(`[OTP] Email send failed for ${email}:`, errorMsg);

    if (errorMsg.includes('534-5.7.9') || errorMsg.includes('Invalid login') || errorMsg.includes('WebLoginRequired')) {
      return {
        sent: false,
        reason: 'Gmail SMTP Authentication Failed (534-5.7.9). Please update the GMAIL_APP_PASSWORD in backend/.env with a valid 16-character Google App Password.',
      };
    }

    if (error?.code === 'ETIMEDOUT' || errorMsg.toLowerCase().includes('timeout')) {
      return {
        sent: false,
        reason: 'SMTP connection timed out (Render Free Tier blocks SMTP ports 465/587). Add GMAIL_WEBHOOK_URL to your Render environment variables.',
      };
    }

    return { sent: false, reason: errorMsg || 'Failed to send email' };
  }
};

exports.sendRegistrationOtp = async (req, res) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const hasRegistrationPayload = Boolean(body.firstname || body.lastname || body.password);

    cleanExpiredPendingRegistrations();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const inviteToken = String(body.inviteToken || '').trim();
    let allowAnyEmail = false;
    if (inviteToken) {
      const inviteResult = verifyInviteTokenPayload(inviteToken);
      if (inviteResult.success && inviteResult.invite?.allowAnyEmail) {
        allowAnyEmail = true;
      }
    }

    const isAuditor = Number(body.roleid) === 4;
    if (!isCompanyEmail(email) && !isAuditor && !allowAnyEmail && !pendingRegistrationStore.has(email)) {
      return res.status(400).json({
        success: false,
        message: `Only ${COMPANY_EMAIL_DOMAIN} email addresses can register`,
      });
    }

    if (hasRegistrationPayload) {
      const result = await createPendingRegistration(body);
      if (!result.success) {
        return res.status(result.status || 400).json({ success: false, message: result.message });
      }

      const otpResult = await sendOtpEmail(email, result.otp);
      if (!otpResult.sent) {
        pendingRegistrationStore.delete(email);
        return res.status(502).json({
          success: false,
          message: otpResult.reason ? `Failed to send OTP email: ${otpResult.reason}` : 'Failed to send OTP email.',
          email,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'OTP sent to your email.',
        email,
        emailDelivery: 'sent',
      });
    }

    const pending = pendingRegistrationStore.get(email);
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'Registration data not found. Please submit the form again.',
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    pending.otpHash = hashValue(otp);
    pending.attempts = 0;
    pending.expiresAt = Date.now() + OTP_TTL_MS;
    pendingRegistrationStore.set(email, pending);

    const otpResult = await sendOtpEmail(email, otp);
    if (!otpResult.sent) {
      pendingRegistrationStore.delete(email);
      return res.status(502).json({
        success: false,
        message: otpResult.reason ? `Failed to send OTP email: ${otpResult.reason}` : 'Failed to send OTP email.',
        email,
      });
    }

    res.status(201).json({
      success: true,
      email,
      message: 'OTP sent to your email.',
      emailDelivery: 'sent',
    });

  } catch (error) {
    console.error('Send registration OTP error:', error?.stack || error);
    res.status(500).json({
      success: false,
      message: error?.message || String(error) || 'Failed to send one-time PIN',
    });
  }
};

exports.verifyRegistrationOtp = async (req, res) => {
  try {
    cleanExpiredPendingRegistrations();
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const otp = String(body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and one-time PIN are required' });
    }

    const pending = pendingRegistrationStore.get(email);
    if (!pending || pending.expiresAt <= Date.now()) {
      pendingRegistrationStore.delete(email);
      return res.status(400).json({ success: false, message: 'One-time PIN expired. Please request a new one.' });
    }

    if (pending.attempts >= 5) {
      pendingRegistrationStore.delete(email);
      return res.status(429).json({ success: false, message: 'Too many wrong OTP attempts. Please request a new one.' });
    }

    if (pending.otpHash !== hashValue(otp)) {
      pending.attempts += 1;
      pendingRegistrationStore.set(email, pending);
      return res.status(400).json({ success: false, message: 'Wrong OTP. Please check your email and try again.' });
    }

    const registrationData = pending.registrationData;
    if (registrationData.inviteToken) {
      const inviteResult = verifyInviteTokenPayload(registrationData.inviteToken);
      if (!inviteResult.success) {
        pendingRegistrationStore.delete(email);
        return res.status(inviteResult.status || 400).json({
          success: false,
          message: inviteResult.message || 'Invite link expired or invalid',
        });
      }

      const invite = inviteResult.invite;
      if (invite.email && invite.email !== email) {
        pendingRegistrationStore.delete(email);
        return res.status(403).json({ success: false, message: 'This invite link is for a different email address' });
      }
    }

    const [existingUsers] = await db.query('SELECT userid FROM users WHERE Email = ?', [email]);
    if (existingUsers.length > 0) {
      pendingRegistrationStore.delete(email);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const isInvited = Boolean(registrationData.inviteToken);
    const initialApprovalStatus = isInvited ? 'approved' : 'pending';

    const roleid = Number(registrationData.roleid) || 2;
    const [result] = await db.query(
      'INSERT INTO users (firstname, middleinitial, lastname, Email, passwordhash, roleid, approvalstatus) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        registrationData.firstname,
        registrationData.middleinitial || null,
        registrationData.lastname,
        registrationData.email,
        registrationData.passwordhash,
        roleid,
        initialApprovalStatus,
      ]
    );

    const insertedUserId = result.insertId;

    // If registered as Personnel (roleid 3) and approved, auto-create headofoffice entry
    if (roleid === 3 && initialApprovalStatus === 'approved') {
      try {
        const [existingHead] = await db.query('SELECT headid FROM headofoffice WHERE userid = ? LIMIT 1', [insertedUserId]);
        if (existingHead.length === 0) {
          await db.query('INSERT INTO headofoffice (userid, Position) VALUES (?, ?)', [insertedUserId, 'Personnel']);
        }
      } catch (headErr) {
        console.error('Failed to create headofoffice entry for new personnel:', headErr);
      }
    }

    pendingRegistrationStore.delete(email);

    try { recordLog(insertedUserId, 'UserRegistered', `User registered after OTP: ${email} (status: ${initialApprovalStatus})`); } catch (e) {}

    return res.json({
      success: true,
      isApproved: isInvited,
      message: isInvited
        ? 'Account registered and verified successfully. You can now log in.'
        : 'Email verified. Your account is pending approval.',
      userid: result.insertId,
      email,
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error?.stack || error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to verify one-time PIN' });
  }
};

// ===============================
// CHANGE PASSWORD WITH OTP
// ===============================
exports.sendChangePasswordOtp = async (req, res) => {
  try {
    cleanExpiredPasswordChangeRequests();
    const userid = req.user?.userid;
    if (!userid) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { currentPassword } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your current password to verify your identity before requesting an OTP code.',
      });
    }

    const [users] = await db.query(
      'SELECT userid, firstname, lastname, email, passwordhash FROM users WHERE userid = ?',
      [userid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    const currentHash = crypto.createHash('md5').update(String(currentPassword)).digest('hex');
    const dbHash = String(user.passwordhash || user.PasswordHash || '');
    if (dbHash !== currentHash) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect. Please enter your valid current password.',
      });
    }

    const email = normalizeEmail(user.Email || user.email);
    if (!email) {
      return res.status(400).json({ success: false, message: 'No registered email address found for this account' });
    }

    // Cooldown check: prevent requesting more than once every 45 seconds
    const existing = pendingPasswordChangeStore.get(userid);
    if (existing && existing.requestedAt && (Date.now() - existing.requestedAt < 45000)) {
      const waitSeconds = Math.ceil((45000 - (Date.now() - existing.requestedAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting a new verification code.`,
        waitSeconds,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'User';

    pendingPasswordChangeStore.set(userid, {
      otpHash: hashValue(otp),
      email,
      attempts: 0,
      requestedAt: Date.now(),
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    const subject = `${otp} is your Auditrack password change verification code`;
    const htmlContent = generatePasswordChangeOtpEmailHtml(otp, fullName);
    const textContent = `Your Auditrack password change verification code is ${otp}. It expires in 10 minutes.`;

    const otpResult = await sendOtpEmail(email, otp, subject, htmlContent, textContent);
    if (!otpResult.sent) {
      pendingPasswordChangeStore.delete(userid);
      return res.status(502).json({
        success: false,
        message: otpResult.reason ? `Failed to send verification email: ${otpResult.reason}` : 'Failed to send verification code email.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${maskEmail(email)}.`,
      maskedEmail: maskEmail(email),
      cooldownSeconds: 45,
    });
  } catch (error) {
    console.error('Send change password OTP error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to send verification code',
    });
  }
};

exports.verifyAndChangePassword = async (req, res) => {
  try {
    cleanExpiredPasswordChangeRequests();
    const userid = req.user?.userid;
    if (!userid) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { currentPassword, newPassword, otp } = req.body || {};

    if (!currentPassword || !newPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and verification code are required.',
      });
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be 6 digits.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password.',
      });
    }

    // 1. Verify OTP
    const pending = pendingPasswordChangeStore.get(userid);
    if (!pending || pending.expiresAt <= Date.now()) {
      pendingPasswordChangeStore.delete(userid);
      return res.status(400).json({
        success: false,
        message: 'Verification code expired or not requested. Please request a new code.',
      });
    }

    if (pending.attempts >= 5) {
      pendingPasswordChangeStore.delete(userid);
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect verification attempts. Please request a new code.',
      });
    }

    if (pending.otpHash !== hashValue(cleanOtp)) {
      pending.attempts += 1;
      pendingPasswordChangeStore.set(userid, pending);
      return res.status(400).json({
        success: false,
        message: 'Incorrect verification code. Please check your email and try again.',
      });
    }

    // 2. Verify current password
    const [users] = await db.query(
      'SELECT userid, passwordhash, Email FROM users WHERE userid = ?',
      [userid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const currentHash = crypto.createHash('md5').update(currentPassword).digest('hex');
    if (users[0].passwordhash !== currentHash) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // 3. Update password in database
    const newHash = crypto.createHash('md5').update(newPassword).digest('hex');
    await db.query('UPDATE users SET passwordhash = ? WHERE userid = ?', [newHash, userid]);

    // 4. Remove OTP store entry
    pendingPasswordChangeStore.delete(userid);

    // 5. Audit log
    try {
      recordLog(userid, 'PasswordChanged', 'User changed account password with OTP verification');
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Password successfully updated! You can use your new password next time you sign in.',
    });
  } catch (error) {
    console.error('Verify and change password error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update password.',
    });
  }
};

exports.registerUser = async (req, res) => {
  return exports.sendRegistrationOtp(req, res);
};

exports.createRegistrationInvite = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const roleid = Number.parseInt(req.body?.roleid, 10) || 3;
    const allowAnyEmail = Boolean(req.body?.allowAnyEmail);

    if (email && !isCompanyEmail(email) && roleid !== 4 && !allowAnyEmail) {
      return res.status(400).json({
        success: false,
        message: `Only ${COMPANY_EMAIL_DOMAIN} email addresses can register`,
      });
    }

    const payload = {
      type: 'registration_invite',
      roleid,
      allowAnyEmail,
      createdBy: req.user?.userid || null,
    };

    if (email) payload.email = email;

    const token = jwt.sign(payload, INVITE_TOKEN_SECRET, { expiresIn: '10m' });
    const decoded = jwt.decode(token) || {};
    const requestOrigin = req.get('origin');
    const fallbackFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const frontendUrl = String(requestOrigin || fallbackFrontendUrl).replace(/\/$/, '');
    const registerPath = roleid === 4 ? '/register-auditor' : '/register';
    const inviteUrl = `${frontendUrl}${registerPath}?invite=${encodeURIComponent(token)}`;

    res.json({
      success: true,
      inviteUrl,
      token,
      allowAnyEmail,
      expiresAt: decoded.exp ? decoded.exp * 1000 : Date.now() + INVITE_TTL_MS,
      roleid,
      email: email || null,
    });
  } catch (error) {
    console.error('Create registration invite error:', error);
    res.status(500).json({ success: false, message: 'Failed to create invite link' });
  }
};

exports.validateRegistrationInvite = async (req, res) => {
  try {
    const token = String(req.params.token || req.query.token || '').trim();
    const inviteResult = verifyInviteTokenPayload(token);

    if (!inviteResult.success) {
      return res.status(inviteResult.status || 400).json({
        success: false,
        message: inviteResult.message || 'Invite link expired or invalid',
      });
    }

    res.json({
      success: true,
      invite: inviteResult.invite,
    });
  } catch (error) {
    console.error('Validate registration invite error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate invite link' });
  }
};

// ===============================
// LOGIN USER (WITH JWT TOKEN)
// ===============================
exports.loginUser = async (req, res) => {
  try {
    console.log("Login attempt:", req.body);
    const { email, password } = req.body;

    const remainingMs = loginRateLimiter.getRemainingMs(email, req.ip);
    if (remainingMs && remainingMs > 0) {
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const mmss = `${mins}:${String(secs).padStart(2, '0')}`;
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please wait ${mmss} before retrying.`,
        remainingMs
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const hashedPassword = crypto
      .createHash("md5")
      .update(password)
      .digest("hex");

    const [users] = await db.query(
      "SELECT userid, firstname, middleinitial, lastname, Email, roleid, profilepic, approvalstatus FROM users WHERE Email = ? AND passwordhash = ?",
      [email, hashedPassword]
    );

    if (users.length === 0) {
      const result = loginRateLimiter.recordFailure(email, req.ip);
      if (result.blocked) {
        const totalSeconds = Math.ceil(result.remainingMs / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const mmss = `${mins}:${String(secs).padStart(2, '0')}`;
        return res.status(429).json({
          success: false,
          message: `Too many failed login attempts. Please wait ${mmss} before retrying.`,
          remainingMs: result.remainingMs
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    if (user.approvalstatus === 'pending') {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin approval.",
        approvalstatus: 'pending'
      });
    }

    if (user.approvalstatus === 'denied') {
      return res.status(403).json({
        success: false,
        message: "Your account has been denied. Please contact the administrator.",
        approvalstatus: 'denied'
      });
    }

    const token = jwt.sign(
      { userid: user.userid, roleid: user.roleid },
      "MY_SECRET_KEY",
      { expiresIn: "8h" }
    );

    if (user && user.userid) {
      try { recordLog(user.userid, 'Login', `User ${user.Email} logged in`); } catch (e) {}
    }

    try { loginRateLimiter.reset(email, req.ip); } catch (e) {}

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const userid = req.user?.userid || null;
    if (userid) {
      try { recordLog(userid, 'Logout', `User ${userid} logged out`); } catch (e) {}
    }
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

exports.loginStatus = async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) {
      return res.json({ success: true, remainingMs: 0 });
    }

    const remainingMs = loginRateLimiter.getRemainingMs(email, req.ip) || 0;
    if (remainingMs && remainingMs > 0) {
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const mmss = `${mins}:${String(secs).padStart(2, '0')}`;
      return res.json({
        success: true,
        remainingMs,
        message: `Too many failed login attempts. Please wait ${mmss} before retrying.`
      });
    }

    return res.json({ success: true, remainingMs: 0 });
  } catch (error) {
    console.error('loginStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check login status' });
  }
};


// ===============================
// GET USER BY EMAIL
// ===============================
exports.getCurrentUser = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const [users] = await db.query(
      "SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.roleid, u.profilepic, u.approvalstatus, r.rolename FROM users u LEFT JOIN roles r ON u.roleid = r.roleid WHERE u.Email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];
    const userWithFullName = {
      ...user,
      FullName: `${user.firstname}${user.middleinitial ? " " + user.middleinitial + "." : ""} ${user.lastname}`,
    };

    res.json({
      success: true,
      user: userWithFullName,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
    });
  }
};

// ===============================
// GET ALL USERS
// ===============================
exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT
         u.userid,
         u.firstname,
         u.middleinitial,
         u.lastname,
         u.Email,
         u.roleid,
         u.profilepic,
         u.approvalstatus,
         r.rolename,
         reqOff.AssignedOffices AS RequirementAssignedOffices,
         perOff.AssignedOffices AS PersonnelAssignedOffices,
         audAreas.AssignedAreas AS assignedArea
       FROM users u
       LEFT JOIN roles r ON u.roleid = r.roleid
       LEFT JOIN (
         SELECT
           rua.userid,
           string_agg(DISTINCT o.officename, '||' ORDER BY o.officename) AS AssignedOffices
         FROM requirementuserassignments rua
         LEFT JOIN offices o ON o.officeid = rua.officeid
         GROUP BY rua.userid
       ) reqOff ON reqOff.userid = u.userid
       LEFT JOIN (
         SELECT
           h.userid,
           string_agg(DISTINCT o.officename, '||' ORDER BY o.officename) AS AssignedOffices
         FROM headofoffice h
         LEFT JOIN officeheadassignments oha ON oha.headid = h.headid
         LEFT JOIN offices o ON o.officeid = oha.officeid
         GROUP BY h.userid
       ) perOff ON perOff.userid = u.userid
       LEFT JOIN (
         SELECT
           aaa.auditoruserid AS userid,
           string_agg(DISTINCT CONCAT(ar.areacode, ': ', ar.areaname), ', ' ORDER BY CONCAT(ar.areacode, ': ', ar.areaname)) AS AssignedAreas
         FROM auditorareaassignments aaa
         JOIN areas ar ON aaa.areaid = ar.areaid
         GROUP BY aaa.auditoruserid
       ) audAreas ON audAreas.userid = u.userid`
    );

    const usersWithFullName = users.map((user) => {
      const first = user.firstname || user.firstname || '';
      const middle = user.middleinitial || user.middleinitial ? ` ${user.middleinitial || user.middleinitial}.` : '';
      const last = user.lastname || user.lastname || '';
      const area = user.assignedArea || user.assignedarea || user.AssignedAreas || user.assignedareas || null;

      return {
        ...user,
        userid: user.userid ?? user.userid ?? user.id,
        firstname: first,
        middleinitial: user.middleinitial || user.middleinitial || null,
        lastname: last,
        FullName: `${first}${middle} ${last}`.trim() || 'Unknown',
        assignedArea: area,
        AssignedOffices: Array.from(
          new Set([
            ...String(user.RequirementAssignedOffices || user.requirementassignedoffices || '').split('||').filter(Boolean),
            ...String(user.PersonnelAssignedOffices || user.personnelassignedoffices || '').split('||').filter(Boolean),
          ])
        ),
      };
    });

    res.json({
      success: true,
      users: usersWithFullName,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users",
    });
  }
};

exports.getLoggedInUser = async (req, res) => {
  try {
    const userid = req.user.userid; // from decoded token

    const [rows] = await db.query(
      `SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.roleid, u.profilepic, u.approvalstatus, r.rolename,
              audAreas.AssignedAreas AS assignedArea
       FROM users u
       LEFT JOIN roles r ON u.roleid = r.roleid
       LEFT JOIN (
         SELECT
           aaa.auditoruserid AS userid,
           string_agg(DISTINCT CONCAT(ar.areacode, ': ', ar.areaname), ', ' ORDER BY CONCAT(ar.areacode, ': ', ar.areaname)) AS AssignedAreas
         FROM auditorareaassignments aaa
         JOIN areas ar ON aaa.areaid = ar.areaid
         GROUP BY aaa.auditoruserid
       ) audAreas ON audAreas.userid = u.userid
       WHERE u.userid = ?`,
      [userid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const row = rows[0];
    const userEmail = row.Email || row.email || '';
    const userObj = {
      ...row,
      userid: row.userid ?? row.userid ?? row.id,
      firstname: row.firstname || row.firstname || '',
      middleinitial: row.middleinitial || row.middleinitial || null,
      lastname: row.lastname || row.lastname || '',
      Email: userEmail,
      email: userEmail,
      assignedArea: row.assignedArea || row.assignedarea || row.AssignedAreas || row.assignedareas || null,
    };

    res.json({
      success: true,
      user: userObj,
    });

  } catch (error) {
    console.error("getLoggedInUser error:", error);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

// ===============================
// UPDATE USER
// ===============================
exports.updateUser = async (req, res) => {
  try {
    const userid = req.params.id;
    const tokenUserId = req.user.userid;
    const isAdmin = Number(req.user?.roleid) === 1;

    if (parseInt(userid) !== tokenUserId && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [existing] = await db.query(
      "SELECT firstname, middleinitial, lastname, Email, profilepic FROM users WHERE userid = ?",
      [userid]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const current = existing[0];

    const nextFirstName = req.body.firstname !== undefined && req.body.firstname !== '' ? req.body.firstname : current.firstname;
    const nextMiddleInitial = req.body.middleinitial !== undefined ? req.body.middleinitial : current.middleinitial;
    const nextLastName = req.body.lastname !== undefined && req.body.lastname !== '' ? req.body.lastname : current.lastname;
    const nextEmail = req.body.Email || req.body.email || current.Email;
    const nextProfilePic = req.file
      ? req.file.filename
      : (req.body.profilepic !== undefined ? req.body.profilepic : current.profilepic);

    if (req.file) {
      try {
        const { uploadToSupabaseBucket } = require('../utils/supabaseStorage');
        await uploadToSupabaseBucket(req.file.path, req.file.filename, req.file.mimetype, 'profile-pics');
      } catch (sErr) {
        console.warn('Profile pic cloud upload notice:', sErr.message);
      }
    }

    // Delete old profile picture if it was replaced or cleared
    if (current.profilepic && current.profilepic !== nextProfilePic) {
      try {
        const { deleteProfilePicFile } = require('../utils/supabaseStorage');
        await deleteProfilePicFile(current.profilepic);
      } catch (delErr) {
        console.warn('Old profile pic delete warning:', delErr.message);
      }
    }

    const [result] = await db.query(
      `UPDATE users SET firstname = ?, middleinitial = ?, lastname = ?, Email = ?, profilepic = ? WHERE userid = ?`,
      [nextFirstName, nextMiddleInitial || null, nextLastName, nextEmail, nextProfilePic, userid]
    );

    const [rows] = await db.query(
      "SELECT userid, firstname, middleinitial, lastname, Email, roleid, profilepic, approvalstatus FROM users WHERE userid = ?",
      [userid]
    );

    res.json({ success: true, user: rows[0] });
    try { recordLog(tokenUserId, 'UserUpdated', `User profile updated: ${tokenUserId}`); } catch (e) {}
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Error updating user" });
  }
};

// ===============================
// UPDATE USER APPROVAL STATUS
// ===============================
exports.updateApprovalStatus = async (req, res) => {
  try {
    const userid = req.params.id;
    const { approvalstatus } = req.body;

    // Validate approvalstatus
    if (!['approved', 'pending', 'denied'].includes(approvalstatus)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid approval status. Must be 'approved', 'pending', or 'denied'" 
      });
    }

    const [result] = await db.query(
      "UPDATE users SET approvalstatus = ? WHERE userid = ?",
      [approvalstatus, userid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [rows] = await db.query(
      "SELECT userid, firstname, middleinitial, lastname, Email, roleid, profilepic, approvalstatus FROM users WHERE userid = ?",
      [userid]
    );
    // If the user was denied, remove their related records and delete the user
    if (approvalstatus === 'denied') {
      try {
        if (rows[0]?.profilepic) {
          const { deleteProfilePicFile } = require('../utils/supabaseStorage');
          await deleteProfilePicFile(rows[0].profilepic).catch(() => {});
        }
        // cleanup assignments and headofoffice entries
        await db.query('DELETE FROM requirementuserassignments WHERE userid = ?', [userid]);
        await db.query('DELETE FROM headofoffice WHERE userid = ?', [userid]);
        const [delResult] = await db.query('DELETE FROM users WHERE userid = ?', [userid]);
        try { recordLog(req.user.userid, 'UserDeniedDeleted', `User ${userid} denied and deleted`); } catch (e) {}
        return res.json({ success: true, message: `User denied and deleted`, deletedRows: delResult.affectedRows });
      } catch (cleanupErr) {
        console.error('Failed to cleanup/delete denied user:', cleanupErr);
        return res.status(500).json({ success: false, message: 'Failed to delete denied user' });
      }
    }

    res.json({ 
      success: true, 
      message: `User approval status updated to ${approvalstatus}`,
      user: rows[0] 
    });
    if (req.user && req.user.userid) {
      try { recordLog(req.user.userid, 'UserApprovalUpdated', `User ${userid} approval set to ${approvalstatus}`); } catch (e) {}
    }
  } catch (error) {
    console.error("Update approval status error:", error);
    res.status(500).json({ success: false, message: "Error updating approval status" });
  }
};

// ===============================
// UPDATE USER ROLE
// ===============================
exports.updateUserRole = async (req, res) => {
  try {
    const userid = req.params.id;
    const { roleid } = req.body;

    if (!userid) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    if (!roleid || ![1, 2].includes(parseInt(roleid))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid role ID. Must be 1 (Admin) or 2 (User)" 
      });
    }

    const [[existingUser]] = await db.query(
      `SELECT u.userid, u.firstname, u.lastname, u.roleid, r.rolename
       FROM users u
       LEFT JOIN roles r ON r.roleid = u.roleid
       WHERE u.userid = ?
       LIMIT 1`,
      [userid]
    );

    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [result] = await db.query(
      "UPDATE users SET roleid = ? WHERE userid = ?",
      [roleid, userid]
    );

    const [rows] = await db.query(
      `SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.roleid, u.profilepic, u.approvalstatus, r.rolename
       FROM users u
       LEFT JOIN roles r ON r.roleid = u.roleid
       WHERE u.userid = ?`,
      [userid]
    );

    const updatedUser = rows[0];
    const oldRoleLabel = existingUser.rolename || (Number(existingUser.roleid) === 1 ? 'Admin' : 'User');
    const newRoleLabel = updatedUser?.rolename || (Number(updatedUser?.roleid) === 1 ? 'Admin' : 'User');

    if (req.user && req.user.userid && Number(existingUser.roleid) !== Number(roleid)) {
      try {
        await createNotifications({
          userIds: [Number(userid)],
          adminid: req.user.userid,
          title: 'Role Updated',
          message: `Your role was changed from ${oldRoleLabel} to ${newRoleLabel}.`,
          type: 'announcement',
          relatedtable: 'users_role',
          relatedid: Number(userid),
        });
      } catch (notifError) {
        console.error('Failed to create role change notification:', notifError);
      }
    }

    res.json({ 
      success: true, 
      message: `User role updated to ${roleid === 1 ? 'Admin' : 'User'}`,
      user: updatedUser 
    });
    if (req.user && req.user.userid) {
      try { recordLog(req.user.userid, 'UserRoleUpdated', `User ${userid} role set to ${roleid}`); } catch (e) {}
    }
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ success: false, message: "Error updating user role" });
  }
};

// ===============================
// DELETE USERS (bulk)
// ===============================
exports.deleteUsers = async (req, res) => {
  try {
    const adminid = req.user && req.user.userid;
    if (!adminid) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Verify admin
    const [[adminRow]] = await db.query('SELECT roleid FROM users WHERE userid = ?', [adminid]);
    if (!adminRow || Number(adminRow.roleid) !== 1) {
      return res.status(403).json({ success: false, message: 'Only admins can delete users' });
    }

    const ids = Array.isArray(req.body.ids) ? req.body.ids.map((v) => Number(v)) : [];
    if (!ids || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No user IDs provided' });
    }

    // Prevent deleting the requesting admin
    if (ids.includes(adminid)) {
      return res.status(400).json({ success: false, message: 'Cannot delete the currently authenticated user' });
    }

    const placeholders = ids.map(() => '?').join(',');

    // Delete profile pictures of users being deleted
    try {
      const [usersToDelete] = await db.query(`SELECT profilepic FROM users WHERE userid IN (${placeholders})`, ids);
      if (Array.isArray(usersToDelete) && usersToDelete.length > 0) {
        const { deleteProfilePicFile } = require('../utils/supabaseStorage');
        for (const u of usersToDelete) {
          if (u?.profilepic) {
            await deleteProfilePicFile(u.profilepic).catch(() => {});
          }
        }
      }
    } catch (picErr) {
      console.warn('Error deleting user profile pics during bulk delete:', picErr.message);
    }

    // Remove assignments and related records referencing these users
    await db.query(`DELETE FROM requirementuserassignments WHERE userid IN (${placeholders})`, ids);
    await db.query(`DELETE FROM headofoffice WHERE userid IN (${placeholders})`, ids);

    // Finally delete from users
    const [result] = await db.query(`DELETE FROM users WHERE userid IN (${placeholders})`, ids);

    try { recordLog(adminid, 'DeleteUsers', `Deleted users: ${ids.join(',')}`); } catch (e) {}

    res.json({ success: true, message: `Deleted ${result.affectedRows} user(s)` });
  } catch (error) {
    console.error('deleteUsers error:', error);
    res.status(500).json({ success: false, message: 'Error deleting users' });
  }
};
