FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o sentinel-ingest ./main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates curl
WORKDIR /app
COPY --from=builder /app/sentinel-ingest .
EXPOSE 8080 4317 4318 9090
ENTRYPOINT ["./sentinel-ingest"]
