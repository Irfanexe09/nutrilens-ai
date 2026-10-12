"""Email dispatching utility for transactional emails (e.g. Password Reset).

Supports standard SMTP with TLS/SSL using Python's built-in smtplib.
Fails safely if SMTP is unconfigured without leaking tokens or credentials.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("nutrilens.email")


def is_smtp_configured() -> bool:
    """Return True if host needed for SMTP is configured."""
    return bool(settings.SMTP_HOST and settings.SMTP_HOST.strip())


def send_password_reset_email(to_email: str, raw_reset_token: str) -> bool:
    """
    Dispatch a password reset email containing the secure one-time link.
    Returns True if sent successfully (or simulated in testing), False otherwise.

    NEVER logs raw_reset_token or SMTP passwords.
    """
    if settings.ENVIRONMENT == "testing":
        logger.info(f"[Email Service] Test environment active: Simulated password reset email for recipient.")
        return True

    frontend_base = settings.FRONTEND_URL.rstrip("/")
    reset_url = f"{frontend_base}/?reset_token={raw_reset_token}"

    if not is_smtp_configured():
        if settings.ENVIRONMENT != "production":
            logger.info(
                f"[Email Service] SMTP not configured. Development mode: Password reset requested for recipient. "
                f"Reset link: {reset_url}"
            )
        else:
            logger.warning(
                "[Email Service] SMTP not configured in production. Password reset email could not be delivered."
            )
        return False

    subject = "Reset your NutriLens password"
    sender = settings.EMAILS_FROM_EMAIL or "noreply@nutrilens.ai"

    # Plain text version
    text_content = f"""Hello,

We received a request to reset the password for your NutriLens account associated with {to_email}.

Please use the link below to set a new password. This link is single-use and will expire in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes:

{reset_url}

If you did not request a password reset, you can safely ignore this email. Your account remains secure.

Best regards,
The NutriLens Team
"""

    # HTML version matching NutriLens dark/lime brand
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your NutriLens password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Nutri<span style="color: #a3e635;">Lens</span></span>
    </div>
    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
      We received a request to reset your password for <strong>{to_email}</strong>. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{reset_url}" style="display: inline-block; background-color: #a3e635; color: #0b0f19; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(163, 230, 53, 0.25);">Reset Password</a>
    </div>
    <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-bottom: 8px;">
      This single-use link will expire in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes. If you did not make this request, you can safely ignore this email.
    </p>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f2937; font-size: 11px; color: #475569;">
      If the button above does not work, copy and paste this URL into your browser:<br>
      <a href="{reset_url}" style="color: #a3e635; word-break: break-all;">{reset_url}</a>
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.SMTP_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            if settings.SMTP_TLS:
                server.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(sender, [to_email], msg.as_string())
        server.quit()
        logger.info("[Email Service] Password reset email successfully sent to recipient.")
        return True
    except Exception as e:
        logger.error(f"[Email Service] Failed to send email via SMTP ({type(e).__name__}): {e}")
        return False
