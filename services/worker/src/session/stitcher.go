package session

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/sentinel/worker/src/config"
)

const sessionGap = 30 * time.Minute

// FeedRow is a raw event row from mv_session_feed_data.
type FeedRow struct {
	TenantID   string
	UserID     string
	EventID    string
	Timestamp  time.Time
	EventType  string
	Country    string
	DeviceType string
	Properties string
}

// Session is a stitched user session written to sentinel.sessions.
type Session struct {
	TenantID     string
	SessionID    string
	UserID       string
	SessionStart time.Time
	SessionEnd   time.Time
	DurationMs   int64
	PageDepth    int
	EventCount   int
	Converted    bool
	EntryPage    string
	ExitPage     string
	Country      string
	DeviceType   string
}

// Repository is the CH interface the stitcher calls.
type Repository interface {
	QuerySessionFeed(ctx context.Context, since time.Time) ([]FeedRow, error)
	UpsertSessions(ctx context.Context, sessions []Session) error
}

// Stitcher computes session boundaries using the 30-minute gap strategy and
// writes results to sentinel.sessions. Runs in the background every interval.
type Stitcher struct {
	repo Repository
	cfg  *config.Config
	last time.Time
}

func NewStitcher(repo Repository, cfg *config.Config) *Stitcher {
	return &Stitcher{
		repo: repo,
		cfg:  cfg,
		last: time.Now().Add(-2 * time.Hour), // process last 2h on cold start
	}
}

func (s *Stitcher) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(s.cfg.SessionStitchIntervalS) * time.Second)
	defer ticker.Stop()
	slog.Info("session stitcher started", "interval_s", s.cfg.SessionStitchIntervalS)
	for {
		select {
		case <-ticker.C:
			s.stitch(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (s *Stitcher) stitch(ctx context.Context) {
	feed, err := s.repo.QuerySessionFeed(ctx, s.last)
	if err != nil {
		slog.Error("session stitcher: feed query failed", "error", err)
		return
	}
	if len(feed) == 0 {
		return
	}

	sessions := computeSessions(feed)

	if err := s.repo.UpsertSessions(ctx, sessions); err != nil {
		slog.Error("session stitcher: upsert failed", "error", err)
		return
	}

	// Advance watermark to most recent event timestamp
	for _, row := range feed {
		if row.Timestamp.After(s.last) {
			s.last = row.Timestamp
		}
	}

	slog.Info("sessions stitched",
		"events_processed", len(feed),
		"sessions_written", len(sessions),
		"watermark", s.last.Format(time.RFC3339))
}

// computeSessions applies gap strategy: new session when gap between consecutive
// events for a user exceeds 30 minutes.
func computeSessions(rows []FeedRow) []Session {
	type userKey struct{ TenantID, UserID string }
	grouped := make(map[userKey][]FeedRow)
	for _, r := range rows {
		k := userKey{r.TenantID, r.UserID}
		grouped[k] = append(grouped[k], r)
	}

	var out []Session
	for key, events := range grouped {
		sortFeedByTime(events)
		var (
			sessionID  string
			prevTS     time.Time
			window     []FeedRow
		)

		flush := func() {
			if len(window) == 0 {
				return
			}
			out = append(out, buildSession(key.TenantID, key.UserID, sessionID, window))
			window = nil
		}

		for _, ev := range events {
			newSession := sessionID == "" || (!prevTS.IsZero() && ev.Timestamp.Sub(prevTS) >= sessionGap)
			if newSession {
				flush()
				sessionID = uuid.NewString()
			}
			window = append(window, ev)
			prevTS = ev.Timestamp
		}
		flush()
	}
	return out
}

func buildSession(tenantID, userID, sessionID string, events []FeedRow) Session {
	first := events[0]
	last := events[len(events)-1]

	converted := false
	for _, ev := range events {
		if ev.EventType == "Purchase" {
			converted = true
			break
		}
	}

	pageDepth := 0
	pages := make(map[string]bool)
	for _, ev := range events {
		if ev.EventType == "PageView" && ev.Properties != "" {
			pages[ev.Properties] = true
		}
	}
	pageDepth = len(pages)
	if pageDepth == 0 {
		pageDepth = len(events)
	}

	return Session{
		TenantID:     tenantID,
		SessionID:    sessionID,
		UserID:       userID,
		SessionStart: first.Timestamp,
		SessionEnd:   last.Timestamp,
		DurationMs:   last.Timestamp.Sub(first.Timestamp).Milliseconds(),
		PageDepth:    pageDepth,
		EventCount:   len(events),
		Converted:    converted,
		Country:      last.Country,
		DeviceType:   last.DeviceType,
	}
}

func sortFeedByTime(rows []FeedRow) {
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && rows[j].Timestamp.Before(rows[j-1].Timestamp); j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}
}
