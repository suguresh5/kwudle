# Kwudle Horizontal Scaling & ClickHouse Sharding Runbook

This document details the current clustering topology of Kwudle, clarifies the operational boundaries between replication and sharding, and provides a production runbook for scaling out to multiple shards.

---

## 1. Current Cluster Topology (1-Shard, 2-Replica)

Kwudle currently operates with a **single shard, two-node replica pair**:

```
                 ┌────────────────────────────────┐
                 │       Keeper Consensus         │
                 │   (sentinel-keeper: 9181)      │
                 └───────▲────────────────▲───────┘
                         │                │
            Replication  │                │  Replication
            Coordination │                │  Coordination
                         ▼                ▼
             ┌────────────────┐     ┌────────────────┐
             │ clickhouse-01  │◄───►│ clickhouse-02  │
             │   (Shard 01,   │     │   (Shard 01,   │
             │   Replica 01)  │     │   Replica 02)  │
             └────────────────┘     └────────────────┘
```

### Macro Definitions
- Node 1 (`config/clickhouse-01/macros.xml`):
  ```xml
  <macros>
      <cluster>sentinel_cluster</cluster>
      <shard>01</shard>
      <replica>sentinel-clickhouse-01</replica>
  </macros>
  ```
- Node 2 (`config/clickhouse-02/macros.xml`):
  ```xml
  <macros>
      <cluster>sentinel_cluster</cluster>
      <shard>01</shard>
      <replica>sentinel-clickhouse-02</replica>
  </macros>
  ```

### Replication vs. Sharding
- **Replication (HA & Read Scaling)**: Both nodes contain identical, synchronized copies of all data. If Node 01 fails, Node 02 serves queries seamlessly. Read traffic can be load balanced between them.
- **Sharding (Write Scaling & Storage Scale-out)**: Splits datasets across distinct nodes. Each shard holds a disjoint partition of the data (e.g. hashed by `tenant_id` or `user_id`). Sharding increases aggregate disk throughput and write ingestion limits.

---

## 2. Deciding When to Add Shards

Do **not** add shards prematurely. Ingest benchmarks demonstrate that a single ClickHouse replica pair handles **50,000+ raw events/second** (over 4.3 billion events per day) with proper block batching.

Add Shard 02 only when:
1. Aggregate write throughput exceeds the hardware disk IOPS/bandwidth of a single replica pair.
2. Total storage exceeds disk limits on individual storage volumes (> 20 TB).
3. Heavy analytical aggregations require distributed computation across more CPU cores.

---

## 3. Step-by-Step Runbook: Adding Shard 02

### Step 0: Pre-flight — Storage Policy Check
Before provisioning new nodes, verify that `config/storage.xml` applies the correct tiered storage policy on **all nodes** (existing and new). Without this, Shard 02 nodes will use the default single-disk policy and miss hot/cold TTL moves.

```xml
<!-- config/storage.xml — must exist on every ClickHouse node -->
<storage_configuration>
    <disks>
        <hot>  <path>/var/lib/clickhouse/</path> </hot>
        <cold> <path>/mnt/cold-storage/</path>   </cold>
    </disks>
    <policies>
        <tiered>
            <volumes>
                <hot_vol>  <disk>hot</disk>  <max_data_part_size_bytes>10737418240</max_data_part_size_bytes> </hot_vol>
                <cold_vol> <disk>cold</disk> </cold_vol>
            </volumes>
        </tiered>
    </policies>
</storage_configuration>
```

> [!NOTE]
> If you are using a single-disk setup (no cold tier), this step can be skipped. However, ensure the TTL expressions in `scripts/clickhouse_ddl.sql` reference `TO DISK 'hot'` correctly.

### Step 1: Provision Nodes for Shard 02
Add two new container or VM instances:
- `sentinel-clickhouse-03` (Shard 02, Replica 01)
- `sentinel-clickhouse-04` (Shard 02, Replica 02)

### Step 2: Configure Macros for Shard 02
On `sentinel-clickhouse-03`:
```xml
<yandex>
    <macros>
        <cluster>sentinel_cluster</cluster>
        <shard>02</shard>
        <replica>sentinel-clickhouse-03</replica>
    </macros>
</yandex>
```

On `sentinel-clickhouse-04`:
```xml
<yandex>
    <macros>
        <cluster>sentinel_cluster</cluster>
        <shard>02</shard>
        <replica>sentinel-clickhouse-04</replica>
    </macros>
</yandex>
```

### Step 3: Update Cluster Topology in `config.xml`
Update the `<remote_servers>` section across all ClickHouse nodes:

```xml
<remote_servers>
    <sentinel_cluster>
        <!-- Shard 01 -->
        <shard>
            <internal_replication>true</internal_replication>
            <replica>
                <host>sentinel-clickhouse-01</host>
                <port>9000</port>
                <user>sentinel_user</user>
                <password>sentinel_password</password>
            </replica>
            <replica>
                <host>sentinel-clickhouse-02</host>
                <port>9000</port>
                <user>sentinel_user</user>
                <password>sentinel_password</password>
            </replica>
        </shard>

        <!-- Shard 02 -->
        <shard>
            <internal_replication>true</internal_replication>
            <replica>
                <host>sentinel-clickhouse-03</host>
                <port>9000</port>
                <user>sentinel_user</user>
                <password>sentinel_password</password>
            </replica>
            <replica>
                <host>sentinel-clickhouse-04</host>
                <port>9000</port>
                <user>sentinel_user</user>
                <password>sentinel_password</password>
            </replica>
        </shard>
    </sentinel_cluster>
</remote_servers>
```

### Step 4: Materialize Tables on New Shard
Because existing tables were created with `ON CLUSTER '{cluster}'` using ZooKeeper/Keeper paths containing `{shard}`, executing:
```sql
CREATE DATABASE IF NOT EXISTS sentinel ON CLUSTER '{cluster}';
```
And re-running `scripts/clickhouse_ddl.sql` with `ON CLUSTER '{cluster}'` will automatically instantiate empty replica tables on Shard 02 pointing to Keeper path `/clickhouse/tables/02/...`.

### Step 5: Distributed Table Setup
To query and write transparently across all shards, define Distributed tables:

```sql
CREATE TABLE IF NOT EXISTS sentinel.dist_events ON CLUSTER '{cluster}'
AS sentinel.events
ENGINE = Distributed(
    'sentinel_cluster',
    'sentinel',
    'events',
    cityHash64(tenant_id)
);
```

### Step 6: Critical Warning Regarding Historical Data
> [!WARNING]
> **ClickHouse does NOT automatically rebalance existing partitions or data to new shards!**
> Data already written to Shard 01 remains on Shard 01.
> - New writes sent through `sentinel.dist_events` will hash on `cityHash64(tenant_id)` and distribute evenly across Shard 01 and Shard 02.
> - Queries against `sentinel.dist_events` automatically scatter-gather across both shards.
> - If historical data must be rebalanced, use `INSERT INTO sentinel.dist_events SELECT * FROM sentinel.events WHERE ...` across specific time partitions, or let older partitions age out via TTL.

### Step 7: Verify Shard 02 Replication Health
After completing Steps 1–5, run the following queries to confirm both shards and all replicas are healthy:

```sql
-- Confirm all replicas are seen by the cluster
SELECT cluster, shard_num, replica_num, host_name, is_local
FROM system.clusters
WHERE cluster = 'sentinel_cluster'
ORDER BY shard_num, replica_num;

-- Confirm replication is active on Shard 02 (run on sentinel-clickhouse-03 or 04)
SELECT
    table,
    is_leader,
    is_readonly,
    total_replicas,
    active_replicas,
    queue_size,
    last_queue_update
FROM system.replicas
WHERE database = 'sentinel'
ORDER BY table;
```

Expected output:
- `is_leader = 1` on exactly one replica per table
- `is_readonly = 0` on all replicas
- `active_replicas = total_replicas` (all replicas in sync)
- `queue_size = 0` (no pending replication tasks)

---

## 4. Capacity & Cost Model

Use this model to estimate hardware requirements before adding a shard.

| Metric | Per Shard (2-replica pair) | Notes |
|--------|---------------------------|-------|
| **Max write throughput** | ~50,000 events/sec | With 10K batch size, LZ4 compression |
| **Max storage (hot)** | ~10–20 TB | Depends on schema & compression ratio (~5–10x) |
| **Recommended RAM** | 32–64 GB per node | For merge operations + query buffers |
| **Recommended CPU** | 16–32 cores per node | ClickHouse is CPU-bound for heavy aggregations |
| **Network** | 10 Gbps minimum | Inter-shard scatter-gather + replication traffic |

### Breakeven points for adding Shard 02:
1. **Write saturation**: > 40,000 events/sec sustained over 5 minutes
2. **Storage**: > 15 TB on a single replica node (leaving < 25% free)
3. **Query CPU**: P99 analytical query latency > 500ms on the Distributed table

> [!TIP]
> Monitor `system.metrics` and `system.asynchronous_metrics` on each node. Key metrics: `ReplicasMaxRelativeDelay`, `BackgroundMergesAndMutationsPoolTask`, `DiskSpaceAvailableBytes`.
