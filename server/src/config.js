require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) {
    console.error(`\x1b[31m[ERROR] Missing required environment variable: ${key}\x1b[0m`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

// Check optional keys and print red KNP flags if missing
const checkOptionalKey = (key, serviceName) => {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    console.warn(`\x1b[31m[KNP] ${key} is not present. ${serviceName} will run in mock/fallback mode.\x1b[0m`);
    return null;
  }
  return val;
};

// Log start of checks
console.log('\x1b[36m--- Environment Variable Verification ---\x1b[0m');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001'),
  mediaPort: parseInt(process.env.MEDIA_PORT || '3002'),
  publicUrl: required('PUBLIC_URL'),
  clientUrl: process.env.CLIENT_URL || required('PUBLIC_URL').replace(':3001', ':5173'),

  jwt: {
    secret: required('JWT_SECRET'),
    inviteSecret: required('JWT_INVITE_SECRET'),
    inviteExpiry: parseInt(process.env.JWT_INVITE_EXPIRY || '1800'),
  },

  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432'),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },

  redis: {
    host: required('REDIS_HOST'),
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: required('REDIS_PASSWORD'),
  },

  mediasoup: {
    announcedIp: required('MEDIASOUP_ANNOUNCED_IP'),
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '40100'),
    numWorkers: parseInt(process.env.MEDIASOUP_NUM_WORKERS || '2'),
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: checkOptionalKey('SMTP_USER', 'Email Dispatch (SMTP)'),
    pass: checkOptionalKey('SMTP_PASS', 'Email Dispatch (SMTP)'),
    fromName: process.env.SMTP_FROM_NAME || 'Support Team',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
  },

  telegram: {
    token: checkOptionalKey('TELEGRAM_BOT_TOKEN', 'Telegram Invite Dispatch'),
  },

  gemini: {
    apiKey: checkOptionalKey('GEMINI_API_KEY', 'Gemini Session Intelligence'),
  },

  twilio: {
    accountSid: checkOptionalKey('TWILIO_ACCOUNT_SID', 'Twilio SMS Invite Dispatch'),
    authToken: checkOptionalKey('TWILIO_AUTH_TOKEN', 'Twilio SMS Invite Dispatch'),
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    recordingDir: process.env.RECORDING_DIR || './recordings',
  },

  reconnectGraceSeconds: parseInt(process.env.RECONNECT_GRACE_SECONDS || '30'),
};
if (config.mediasoup.rtcMaxPort - config.mediasoup.rtcMinPort < 20) {
  console.warn(`\x1b[33m[KNP] mediasoup UDP port range is too small: ${config.mediasoup.rtcMinPort}-${config.mediasoup.rtcMaxPort}. Use at least 50 ports to avoid port exhaustion.\x1b[0m`);
}
console.log('\x1b[36m-----------------------------------------\x1b[0m');

module.exports = config;
