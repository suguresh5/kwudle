import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from '../config';

let client: ClickHouseClient;

export function getClickHouseClient(): ClickHouseClient {
  if (!client) {
    client = createClient({
      host: config.clickhouse.host,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: config.clickhouse.database,
      clickhouse_settings: {
        max_execution_time: 60,
        enable_http_compression: 1,
      },
    });
  }
  return client;
}

// Execute a parameterized query — never use string concatenation
export async function queryRows<T>(
  sql: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const ch = getClickHouseClient();
  const result = await ch.query({ query: sql, query_params: params, format: 'JSONEachRow' });
  return result.json<T>();
}
