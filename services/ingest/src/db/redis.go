package db

import (
	"fmt"
	"github.com/go-redis/redis/v8"
	"github.com/sentinel/ingest/src/config"
)

func NewRedisClient(cfg *config.Config) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       0,
		PoolSize: 20,
	})
	return client, nil
}
