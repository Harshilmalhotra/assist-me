const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: false,
});

redis.on('connect', () => console.log('Redis connected successfully'));
redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redis;
