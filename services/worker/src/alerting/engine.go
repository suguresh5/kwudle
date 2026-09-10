package alerting

import (
"context"
"log/slog"
"time"

"github.com/sentinel/worker/src/config"
)

type Engine struct {
cfg *config.Config
}

func NewEngine(ch interface{}, cfg *config.Config) *Engine {
return &Engine{cfg: cfg}
}

func (e *Engine) Start(ctx context.Context) {
ticker := time.NewTicker(time.Duration(e.cfg.AlertPollIntervalS) * time.Second)
defer ticker.Stop()
slog.Info("alerting engine started", "poll_interval_s", e.cfg.AlertPollIntervalS)
for {
select {
case <-ticker.C:
slog.Info("alert engine tick")
case <-ctx.Done():
return
}
}
}
