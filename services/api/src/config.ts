export const config = {
  port: parseInt(process.env.PORT || '3001'),
  clickhouse: {
    host: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || 8123}`,
    username: process.env.CLICKHOUSE_USER || 'sentinel_user',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'sentinel',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
  },
  cache: {
    ttlRecentS: parseInt(process.env.CACHE_TTL_RECENT_S || '30'),
    ttlHistoricalS: parseInt(process.env.CACHE_TTL_HISTORICAL_S || '300'),
  },
  serviceName: process.env.SERVICE_NAME || 'sentinel-api',
} as const;
