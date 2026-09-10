package metrics

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func Serve(port int) {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	addr := fmt.Sprintf(":%d", port)
	slog.Info("metrics server listening", "addr", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		slog.Error("metrics server failed", "error", err)
	}
}
