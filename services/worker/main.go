package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sentinel/worker/src/alerting"
	"github.com/sentinel/worker/src/config"
	"github.com/sentinel/worker/src/db"
	"github.com/sentinel/worker/src/dlq"
	"github.com/sentinel/worker/src/session"
	"github.com/sentinel/worker/src/suggestions"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ── ClickHouse client ────────────────────────────────────
	chClient, err := db.NewClickHouseClient(cfg)
	if err != nil {
		slog.Error("clickhouse init failed", "error", err)
		os.Exit(1)
	}
	defer chClient.Close()

	// ── DLQ replayer ─────────────────────────────────────────
	replayer := dlq.NewReplayer(cfg)

	// ── Alert worker ─────────────────────────────────────────
	alertWorker := alerting.NewWorker(chClient, cfg)
	alertWorker.SetDLQReader(replayer)

	// Seed default DLQ alert rule if not exists
	if err := chClient.SeedDLQAlertRule(ctx); err != nil {
		slog.Warn("failed to seed DLQ alert rule", "error", err)
	}

	go func() {
		ticker := time.NewTicker(time.Duration(cfg.AlertPollIntervalS) * time.Second)
		defer ticker.Stop()
		slog.Info("alert worker started", "poll_interval_s", cfg.AlertPollIntervalS)
		for {
			select {
			case <-ticker.C:
				if err := alertWorker.Evaluate(ctx); err != nil {
					slog.Error("alert evaluation error", "error", err)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// ── Session stitcher ─────────────────────────────────────────────────
	stitcher := session.NewStitcher(chClient, cfg)
	go stitcher.Start(ctx)

	// ── AI Suggestions job ────────────────────────────────────────────────
	suggJob := suggestions.NewJob(cfg, chClient)
	go suggJob.Start(ctx)

	// ── Auto-replay DLQ ticker ───────────────────────────────────────────
	go func() {
		interval := time.Duration(cfg.DLQAutoReplayIntervalS) * time.Second
		if interval <= 0 {
			interval = 5 * time.Minute
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		consecutiveFailures := 0
		maxRetries := cfg.DLQMaxAutoRetries
		if maxRetries <= 0 {
			maxRetries = 3
		}

		for {
			select {
			case <-ticker.C:
				depth := replayer.DLQDepth()
				if depth == 0 {
					consecutiveFailures = 0
					continue
				}
				if consecutiveFailures >= maxRetries {
					slog.Warn("DLQ auto-replay paused: max consecutive failures reached",
						"failures", consecutiveFailures, "max_retries", maxRetries)
					continue
				}
				slog.Info("DLQ auto-replay triggered", "current_depth", depth)
				succ, fail, err := replayer.Replay(ctx)
				if err != nil || fail > 0 {
					consecutiveFailures++
					backoffWait := time.Duration(1<<consecutiveFailures) * time.Minute
					slog.Warn("DLQ auto-replay had failures, backing off",
						"consecutive_failures", consecutiveFailures,
						"backoff_wait", backoffWait,
						"succeeded", succ,
						"failed", fail,
						"error", err)
					time.Sleep(backoffWait)
				} else {
					consecutiveFailures = 0
					slog.Info("DLQ auto-replay completed successfully", "succeeded", succ)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// ── HTTP: health + DLQ replay endpoint ───────────────────
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok","service":"sentinel-worker"}`)
	})

	mux.HandleFunc("/admin/dlq/replay", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		succeeded, failed, err := replayer.Replay(ctx)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			slog.Error("DLQ replay error", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error":%q}`, err.Error())
			return
		}
		fmt.Fprintf(w, `{"succeeded":%d,"failed":%d}`, succeeded, failed)
	})

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		dlqDepth := replayer.DLQDepth()
		oldestAge := replayer.OldestRecordAge()
		fmt.Fprintf(w,
			"# HELP sentinel_worker_up Worker health\n"+
				"# TYPE sentinel_worker_up gauge\n"+
				"sentinel_worker_up 1\n"+
				"# HELP sentinel_dlq_depth Number of records currently in the DLQ\n"+
				"# TYPE sentinel_dlq_depth gauge\n"+
				"sentinel_dlq_depth %d\n"+
				"# HELP sentinel_dlq_oldest_record_age_seconds Age of oldest record in DLQ in seconds\n"+
				"# TYPE sentinel_dlq_oldest_record_age_seconds gauge\n"+
				"sentinel_dlq_oldest_record_age_seconds %.2f\n",
			dlqDepth, oldestAge,
		)
	})

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.MetricsPort),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("worker HTTP server listening", "port", cfg.MetricsPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("worker HTTP error", "error", err)
		}
	}()

	// ── Graceful shutdown ────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("sentinel-worker shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
	cancel()
	slog.Info("sentinel-worker stopped")
}
