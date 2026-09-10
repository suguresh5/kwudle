package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sentinel/ingest/src/batcher"
	"github.com/sentinel/ingest/src/config"
	"github.com/sentinel/ingest/src/db"
	"github.com/sentinel/ingest/src/enrichment"
	"github.com/sentinel/ingest/src/handler"
	"github.com/sentinel/ingest/src/middleware"
	"github.com/sentinel/ingest/src/otel"
	"github.com/sentinel/ingest/src/pii"
	"github.com/sentinel/ingest/src/sampling"
	"github.com/sentinel/ingest/src/schema"
	"github.com/valyala/fasthttp"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ── Dependencies ────────────────────────────────────────
	chClient, err := db.NewClickHouseClient(cfg)
	if err != nil {
		slog.Error("clickhouse init failed", "error", err)
		os.Exit(1)
	}
	defer chClient.Close()

	redisClient, err := db.NewRedisClient(cfg)
	if err != nil {
		slog.Error("redis init failed", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()

	// ── Feature modules ─────────────────────────────────────
	authMiddleware := middleware.NewAuthMiddleware(redisClient, chClient, cfg)
	piiHasher := pii.NewHasher(cfg.PIIHashSalt)
	enricher, err := enrichment.NewEnricher(cfg.GeoIPPath, cfg.EnrichmentTimeoutMs)
	if err != nil {
		slog.Warn("enricher init failed — geo enrichment disabled", "error", err)
		enricher = enrichment.NewNoop()
	}
	sampler := sampling.NewSampler(redisClient, cfg)
	schemaRegistry := schema.NewRegistry(redisClient, chClient, cfg)
	bat := batcher.NewBatcher(chClient, cfg)

	otelNormalizer := otel.NewNormalizer()

	// ── Start background tasks ───────────────────────────────
	bat.Start(ctx)
	schemaRegistry.Start(ctx)

	// ── HTTP router ─────────────────────────────────────────
	h := handler.New(handler.Deps{
		Auth:           authMiddleware,
		PII:            piiHasher,
		Enricher:       enricher,
		Sampler:        sampler,
		SchemaRegistry: schemaRegistry,
		Batcher:        bat,
		OTelNormalizer: otelNormalizer,
		Config:         cfg,
	})

	server := &fasthttp.Server{
		Handler:      h.Route(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		Name:         "sentinel-ingest",
	}

	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		slog.Info("ingest server listening", "addr", addr)
		if err := server.ListenAndServe(addr); err != nil {
			slog.Error("server error", "error", err)
		}
	}()

	// ── Graceful shutdown ───────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down — draining batcher")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	bat.Drain(shutdownCtx)
	server.Shutdown()
	slog.Info("shutdown complete")
}
