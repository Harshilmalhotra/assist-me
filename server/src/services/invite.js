const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

// Nodemailer transporter initialization (with check for credentials)
let transporter = null;
if (config.smtp.user && config.smtp.pass) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

// Telegram bot initialization
let telegramBot = null;
if (config.telegram.token) {
  telegramBot = new TelegramBot(config.telegram.token, { polling: false });
}

async function sendEmailInvite({ customerEmail, customerName, agentName, joinUrl }) {
  const subject = `${agentName} is ready for your support call`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e4;">
    <div style="padding:24px 32px;border-bottom:1px solid #e5e5e4;">
      <p style="margin:0;font-size:13px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Support Call</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#171717;">Your agent is ready</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#404040;line-height:1.6;">
        Hi ${customerName},
      </p>
      <p style="margin:0 0 24px;color:#404040;line-height:1.6;">
        <strong>${agentName}</strong> from our support team has started a video call session for you.
        Click the button below to join — no account or app required.
      </p>
      <a href="${joinUrl}"
         style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;
                padding:12px 24px;border-radius:6px;font-size:15px;font-weight:500;">
        Join Video Call
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#737373;line-height:1.6;">
        Or copy this link into your browser:<br>
        <span style="color:#404040;word-break:break-all;">${joinUrl}</span>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#a3a3a3;">
        This link expires in 30 minutes.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (transporter) {
    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
      to: customerEmail,
      subject,
      html,
    });
    console.log(`Email invite sent to ${customerEmail}`);
  } else {
    console.log('\x1b[33m%s\x1b[0m', `[SMTP MOCK] Email would be sent to ${customerEmail}:`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Join Link: ${joinUrl}`);
  }
}

async function sendTelegramInvite({ customerTelegram, customerName, agentName, joinUrl }) {
  // Remove @ if user included it
  const chatId = customerTelegram.startsWith('@')
    ? customerTelegram
    : `@${customerTelegram}`;

  const message =
    `*Support Call Ready*\n\n` +
    `Hi ${customerName}, your support agent *${agentName}* is waiting for you.\n\n` +
    `Tap the button below or copy the link to join the video call:\n\n` +
    `${joinUrl}\n\n` +
    `_This link expires in 30 minutes. No account required._`;

  if (telegramBot) {
    await telegramBot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Join Video Call', url: joinUrl },
        ]],
      },
    });
    console.log(`Telegram invite sent to ${customerTelegram}`);
  } else {
    console.log('\x1b[33m%s\x1b[0m', `[TELEGRAM MOCK] Telegram message would be sent to ${chatId}:`);
    console.log(`  Content: ${message.replace(/\n/g, '  ')}`);
  }
}

async function sendInvite({ session, joinUrl, customerEmail, customerTelegram, customerName }) {
  const agentName = 'Support Agent'; // Fallback name
  const errors = [];

  if (customerEmail) {
    try {
      await sendEmailInvite({ customerEmail, customerName, agentName, joinUrl });
    } catch (err) {
      errors.push(`Email failed: ${err.message}`);
      console.error('Email invite error:', err.message);
    }
  }

  if (customerTelegram) {
    try {
      await sendTelegramInvite({ customerTelegram, customerName, agentName, joinUrl });
    } catch (err) {
      errors.push(`Telegram failed: ${err.message}`);
      console.error('Telegram invite error:', err.message);
    }
  }

  if (errors.length > 0) {
    console.warn('Some invites failed:', errors);
  }
}

module.exports = { sendInvite };
