package session

import (
	"testing"
	"time"
)

func TestComputeSessions_SingleSession(t *testing.T) {
	now := time.Date(2026, 9, 8, 10, 0, 0, 0, time.UTC)
	rows := []FeedRow{
		{
			TenantID:   "tenant-1",
			UserID:     "user-1",
			EventID:    "e1",
			Timestamp:  now,
			EventType:  "PageView",
			Properties: "/home",
			Country:    "US",
			DeviceType: "desktop",
		},
		{
			TenantID:   "tenant-1",
			UserID:     "user-1",
			EventID:    "e2",
			Timestamp:  now.Add(5 * time.Minute),
			EventType:  "PageView",
			Properties: "/pricing",
			Country:    "US",
			DeviceType: "desktop",
		},
		{
			TenantID:   "tenant-1",
			UserID:     "user-1",
			EventID:    "e3",
			Timestamp:  now.Add(10 * time.Minute),
			EventType:  "Purchase",
			Country:    "US",
			DeviceType: "desktop",
		},
	}

	sessions := computeSessions(rows)
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}

	s := sessions[0]
	if s.TenantID != "tenant-1" || s.UserID != "user-1" {
		t.Errorf("unexpected tenant or user in session: %+v", s)
	}
	if s.EventCount != 3 {
		t.Errorf("expected 3 events, got %d", s.EventCount)
	}
	if !s.Converted {
		t.Errorf("expected Converted=true due to Purchase event")
	}
	if s.PageDepth != 2 {
		t.Errorf("expected PageDepth=2 (/home and /pricing), got %d", s.PageDepth)
	}
	if s.DurationMs != 10*60*1000 {
		t.Errorf("expected duration 600,000ms, got %d", s.DurationMs)
	}
}

func TestComputeSessions_SplitOn30MinGap(t *testing.T) {
	now := time.Date(2026, 9, 8, 10, 0, 0, 0, time.UTC)
	rows := []FeedRow{
		{
			TenantID:  "tenant-1",
			UserID:    "user-1",
			EventID:   "e1",
			Timestamp: now,
			EventType: "PageView",
		},
		{
			TenantID:  "tenant-1",
			UserID:    "user-1",
			EventID:   "e2",
			Timestamp: now.Add(10 * time.Minute),
			EventType: "PageView",
		},
		// 35 minute gap here (> 30 min session gap)
		{
			TenantID:  "tenant-1",
			UserID:    "user-1",
			EventID:   "e3",
			Timestamp: now.Add(45 * time.Minute),
			EventType: "PageView",
		},
	}

	sessions := computeSessions(rows)
	if len(sessions) != 2 {
		t.Fatalf("expected 2 sessions after 35m gap, got %d", len(sessions))
	}

	if sessions[0].SessionID == sessions[1].SessionID {
		t.Errorf("sessions should have different UUIDs: %s == %s", sessions[0].SessionID, sessions[1].SessionID)
	}
}

func TestComputeSessions_MultiTenantMultiUser(t *testing.T) {
	now := time.Date(2026, 9, 8, 10, 0, 0, 0, time.UTC)
	rows := []FeedRow{
		{TenantID: "tenant-A", UserID: "user-1", Timestamp: now, EventType: "PageView"},
		{TenantID: "tenant-A", UserID: "user-2", Timestamp: now, EventType: "PageView"},
		{TenantID: "tenant-B", UserID: "user-1", Timestamp: now, EventType: "PageView"},
	}

	sessions := computeSessions(rows)
	if len(sessions) != 3 {
		t.Fatalf("expected 3 separate sessions for 3 tenant/user pairs, got %d", len(sessions))
	}
}

func TestSortFeedByTime(t *testing.T) {
	now := time.Now()
	rows := []FeedRow{
		{EventID: "3", Timestamp: now.Add(30 * time.Minute)},
		{EventID: "1", Timestamp: now.Add(10 * time.Minute)},
		{EventID: "2", Timestamp: now.Add(20 * time.Minute)},
	}

	sortFeedByTime(rows)

	if rows[0].EventID != "1" || rows[1].EventID != "2" || rows[2].EventID != "3" {
		t.Errorf("rows were not sorted chronologically: %+v", rows)
	}
}
