# SeqPulse HMAC Guide (v2)

## Overview
SeqPulse collects metrics by calling your `/ds-metrics` endpoint.
HMAC is optional, but when enabled on a project, SeqPulse will sign each request.
Your app should validate the signature before returning metrics.

## When HMAC is enabled
SeqPulse sends these headers:
- `X-SeqPulse-Timestamp` (ISO 8601 UTC)
- `X-SeqPulse-Nonce` (unique per request)
- `X-SeqPulse-Signature` (`sha256=<hex>`)
- `X-SeqPulse-Signature-Version` (`v2`)
- `X-SeqPulse-Canonical-Path` (normalized path)
- `X-SeqPulse-Method` (usually `GET`)
- `X-SeqPulse-Nonce-TTL` (seconds, recommended cache TTL)
- `X-SeqPulse-Project-Id` (project identifier, helpful for nonce scoping)

## Signature payload (v2)
```
payload = "{timestamp}|{METHOD}|{path}|{nonce}"
signature = "sha256=" + HMAC_SHA256(secret, payload)
```

Notes:
- `METHOD` is uppercase (GET).
- `path` is canonical (no trailing slash, always starts with `/`).
- `nonce` is single-use (anti-replay).

## Timestamp validation
SeqPulse expects the receiver to reject requests outside the allowed skew:
- max past: `SEQPULSE_HMAC_MAX_SKEW_PAST` (default 300s)
- max future: `SEQPULSE_HMAC_MAX_SKEW_FUTURE` (default 30s)

## Nonce validation
Nonce should be stored briefly to prevent replay.
In multi-instance deployments, use a shared cache (Redis) or accept only timestamp checks.
Recommended TTL: `MAX_SKEW_PAST + MAX_SKEW_FUTURE` (seconds).

## Metrics payload (backend expected)
Return JSON with a `metrics` object:
```json
{
  "metrics": {
    "requests_per_sec": 12.3,
    "latency_p95": 220,
    "error_rate": 0.01,
    "cpu_usage": 0.32,
    "memory_usage": 0.45
  }
}
```
Constraints:
- `error_rate`, `cpu_usage`, `memory_usage` must be in `[0..1]`.
- All values must be finite numbers.

## Official Node.js example (Express)
```ts
import express from "express"
import os from "os"
import crypto from "crypto"

const app = express()

const HMAC_ENABLED = process.env.SEQPULSE_HMAC_ENABLED === "true"
const HMAC_SECRET = process.env.SEQPULSE_HMAC_SECRET || ""
const MAX_SKEW_PAST_MS = Number(process.env.SEQPULSE_HMAC_MAX_SKEW_PAST || 300) * 1000
const MAX_SKEW_FUTURE_MS = Number(process.env.SEQPULSE_HMAC_MAX_SKEW_FUTURE || 30) * 1000
const NONCE_TTL_MS = MAX_SKEW_PAST_MS + MAX_SKEW_FUTURE_MS

const nonceCache = new Map<string, number>()

function cleanupNonceCache() {
  const now = Date.now()
  for (const [nonce, ts] of nonceCache.entries()) {
    if (now - ts > NONCE_TTL_MS) nonceCache.delete(nonce)
  }
}

function isNonceReused(nonce: string) {
  cleanupNonceCache()
  if (nonceCache.has(nonce)) return true
  nonceCache.set(nonce, Date.now())
  return false
}

function validateTimestamp(ts: string) {
  const sent = Date.parse(ts)
  if (Number.isNaN(sent)) throw new Error("Invalid timestamp")
  const now = Date.now()
  const delta = now - sent
  if (delta > MAX_SKEW_PAST_MS) throw new Error("Timestamp too old")
  if (delta < -MAX_SKEW_FUTURE_MS) throw new Error("Timestamp too far in the future")
}

function canonicalizePath(path: string) {
  if (!path) return "/"
  if (!path.startsWith("/")) path = `/${path}`
  if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1)
  return path
}

function buildSignature(secret: string, timestamp: string, method: string, path: string, nonce: string) {
  const payload = `${timestamp}|${method}|${path}|${nonce}`
  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  return `sha256=${digest}`
}

app.get("/ds-metrics", (req, res) => {
  if (HMAC_ENABLED) {
    const ts = req.header("X-SeqPulse-Timestamp") || ""
    const nonce = req.header("X-SeqPulse-Nonce") || ""
    const sig = req.header("X-SeqPulse-Signature") || ""
    const ver = req.header("X-SeqPulse-Signature-Version") || ""
    const method = (req.header("X-SeqPulse-Method") || req.method || "GET").toUpperCase()
    const canonicalPath = canonicalizePath(req.header("X-SeqPulse-Canonical-Path") || req.path)

    if (!ts || !nonce || !sig || ver !== "v2") {
      return res.status(401).json({ error: "Missing or invalid HMAC headers" })
    }

    try {
      validateTimestamp(ts)
    } catch {
      return res.status(401).json({ error: "Invalid timestamp" })
    }

    if (isNonceReused(nonce)) {
      return res.status(401).json({ error: "Nonce reuse" })
    }

    const expected = buildSignature(HMAC_SECRET, ts, method, canonicalPath, nonce)
    const expBuf = Buffer.from(expected)
    const sigBuf = Buffer.from(sig)
    if (expBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) {
      return res.status(401).json({ error: "Invalid signature" })
    }
  }

  const metrics = {
    requests_per_sec: 12.3,
    latency_p95: 220,
    error_rate: 0.01,
    cpu_usage: 0.32,
    memory_usage: 0.45
  }

  res.json({ metrics })
})

app.listen(3001, () => console.log("App listening on port 3001"))
```

## Go example (net/http)
```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	hmacEnabled  = os.Getenv("SEQPULSE_HMAC_ENABLED") == "true"
	hmacSecret   = os.Getenv("SEQPULSE_HMAC_SECRET")
	maxSkewPast  = time.Duration(envInt("SEQPULSE_HMAC_MAX_SKEW_PAST", 300)) * time.Second
	maxSkewFuture = time.Duration(envInt("SEQPULSE_HMAC_MAX_SKEW_FUTURE", 30)) * time.Second
	nonceTTL     = maxSkewPast + maxSkewFuture
	nonceMu      sync.Mutex
	nonceMap     = map[string]time.Time{}
)

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func canonicalizePath(path string) string {
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if path != "/" && strings.HasSuffix(path, "/") {
		path = strings.TrimSuffix(path, "/")
	}
	return path
}

func buildSignature(secret, ts, method, path, nonce string) string {
	payload := ts + "|" + strings.ToUpper(method) + "|" + canonicalizePath(path) + "|" + nonce
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func validateTimestamp(ts string) error {
	sent, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	delta := now.Sub(sent)
	if delta > maxSkewPast {
		return errors.New("timestamp too old")
	}
	if delta < -maxSkewFuture {
		return errors.New("timestamp too far in the future")
	}
	return nil
}

func nonceReused(nonce string) bool {
	nonceMu.Lock()
	defer nonceMu.Unlock()
	now := time.Now().UTC()
	for k, t := range nonceMap {
		if now.Sub(t) > nonceTTL {
			delete(nonceMap, k)
		}
	}
	if _, ok := nonceMap[nonce]; ok {
		return true
	}
	nonceMap[nonce] = now
	return false
}

func dsMetrics(w http.ResponseWriter, r *http.Request) {
	if hmacEnabled {
		ts := r.Header.Get("X-SeqPulse-Timestamp")
		nonce := r.Header.Get("X-SeqPulse-Nonce")
		sig := r.Header.Get("X-SeqPulse-Signature")
		ver := r.Header.Get("X-SeqPulse-Signature-Version")
		method := r.Header.Get("X-SeqPulse-Method")
		if method == "" {
			method = r.Method
		}
		path := r.Header.Get("X-SeqPulse-Canonical-Path")
		if path == "" {
			path = r.URL.Path
		}

		if ts == "" || nonce == "" || sig == "" || ver != "v2" {
			http.Error(w, "Missing or invalid HMAC headers", http.StatusUnauthorized)
			return
		}
		if err := validateTimestamp(ts); err != nil {
			http.Error(w, "Invalid timestamp", http.StatusUnauthorized)
			return
		}
		if nonceReused(nonce) {
			http.Error(w, "Nonce reuse", http.StatusUnauthorized)
			return
		}
		expected := buildSignature(hmacSecret, ts, method, path, nonce)
		if !hmac.Equal([]byte(expected), []byte(sig)) {
			http.Error(w, "Invalid signature", http.StatusUnauthorized)
			return
		}
	}

	payload := map[string]interface{}{
		"metrics": map[string]interface{}{
			"requests_per_sec": 12.3,
			"latency_p95": 220,
			"error_rate": 0.01,
			"cpu_usage": 0.32,
			"memory_usage": 0.45,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payload)
}

func main() {
	http.HandleFunc("/ds-metrics", dsMetrics)
	http.ListenAndServe(":3001", nil)
}
```

## Laravel example (Controller)
```php
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class MetricsController extends Controller
{
    public function show(Request $request)
    {
        if (config('seqpulse.hmac_enabled')) {
            $ts = $request->header('X-SeqPulse-Timestamp');
            $nonce = $request->header('X-SeqPulse-Nonce');
            $sig = $request->header('X-SeqPulse-Signature');
            $ver = $request->header('X-SeqPulse-Signature-Version');
            $method = strtoupper($request->header('X-SeqPulse-Method', $request->method()));
            $path = $request->header('X-SeqPulse-Canonical-Path', $request->path());
            $path = '/' . ltrim($path, '/');
            if ($path !== '/' && str_ends_with($path, '/')) {
                $path = rtrim($path, '/');
            }

            if (!$ts || !$nonce || !$sig || $ver !== 'v2') {
                return response()->json(['error' => 'Missing or invalid HMAC headers'], 401);
            }

            try {
                $sent = Carbon::parse($ts, 'UTC');
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Invalid timestamp'], 401);
            }

            $now = Carbon::now('UTC');
            $delta = $now->diffInSeconds($sent, false);
            $maxPast = (int) env('SEQPULSE_HMAC_MAX_SKEW_PAST', 300);
            $maxFuture = (int) env('SEQPULSE_HMAC_MAX_SKEW_FUTURE', 30);
            if ($delta > $maxPast || $delta < -$maxFuture) {
                return response()->json(['error' => 'Invalid timestamp'], 401);
            }

            $nonceKey = 'seqpulse_nonce:' . $nonce;
            if (!Cache::add($nonceKey, true, $maxPast + $maxFuture)) {
                return response()->json(['error' => 'Nonce reuse'], 401);
            }

            $secret = env('SEQPULSE_HMAC_SECRET', '');
            $payload = "{$ts}|{$method}|{$path}|{$nonce}";
            $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
            if (!hash_equals($expected, $sig)) {
                return response()->json(['error' => 'Invalid signature'], 401);
            }
        }

        return response()->json([
            'metrics' => [
                'requests_per_sec' => 12.3,
                'latency_p95' => 220,
                'error_rate' => 0.01,
                'cpu_usage' => 0.32,
                'memory_usage' => 0.45,
            ]
        ]);
    }
}
```

## Python example (FastAPI)
```py
from fastapi import FastAPI, Request, HTTPException
import hmac, hashlib, time, os
from datetime import datetime, timezone

app = FastAPI()

HMAC_ENABLED = (os.getenv("SEQPULSE_HMAC_ENABLED") == "true")
HMAC_SECRET = os.getenv("SEQPULSE_HMAC_SECRET", "")
MAX_SKEW_PAST = int(os.getenv("SEQPULSE_HMAC_MAX_SKEW_PAST", "300"))
MAX_SKEW_FUTURE = int(os.getenv("SEQPULSE_HMAC_MAX_SKEW_FUTURE", "30"))
NONCE_TTL = MAX_SKEW_PAST + MAX_SKEW_FUTURE

nonce_cache = {}

def canonicalize_path(path: str) -> str:
    if not path:
        return "/"
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return path

def validate_timestamp(ts: str):
    sent = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    now = time.time()
    delta = now - sent
    if delta > MAX_SKEW_PAST or delta < -MAX_SKEW_FUTURE:
        raise ValueError("Invalid timestamp")

def nonce_reused(nonce: str) -> bool:
    now = time.time()
    for k, v in list(nonce_cache.items()):
        if now - v > NONCE_TTL:
            nonce_cache.pop(k, None)
    if nonce in nonce_cache:
        return True
    nonce_cache[nonce] = now
    return False

@app.get("/ds-metrics")
async def ds_metrics(request: Request):
    if HMAC_ENABLED:
        ts = request.headers.get("X-SeqPulse-Timestamp", "")
        nonce = request.headers.get("X-SeqPulse-Nonce", "")
        sig = request.headers.get("X-SeqPulse-Signature", "")
        ver = request.headers.get("X-SeqPulse-Signature-Version", "")
        method = (request.headers.get("X-SeqPulse-Method") or request.method or "GET").upper()
        path = canonicalize_path(request.headers.get("X-SeqPulse-Canonical-Path") or request.url.path)

        if not ts or not nonce or not sig or ver != "v2":
            raise HTTPException(status_code=401, detail="Missing or invalid HMAC headers")

        try:
            validate_timestamp(ts)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid timestamp")

        if nonce_reused(nonce):
            raise HTTPException(status_code=401, detail="Nonce reuse")

        payload = f"{ts}|{method}|{path}|{nonce}"
        expected = "sha256=" + hmac.new(HMAC_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    return {
        "metrics": {
            "requests_per_sec": 12.3,
            "latency_p95": 220,
            "error_rate": 0.01,
            "cpu_usage": 0.32,
            "memory_usage": 0.45,
        }
    }
```

## Python example (Django)
```py
from django.http import JsonResponse
from django.utils.timezone import now
from django.core.cache import cache
import hmac, hashlib, os
from datetime import datetime, timezone

HMAC_ENABLED = os.getenv("SEQPULSE_HMAC_ENABLED") == "true"
HMAC_SECRET = os.getenv("SEQPULSE_HMAC_SECRET", "")
MAX_SKEW_PAST = int(os.getenv("SEQPULSE_HMAC_MAX_SKEW_PAST", "300"))
MAX_SKEW_FUTURE = int(os.getenv("SEQPULSE_HMAC_MAX_SKEW_FUTURE", "30"))

def canonicalize_path(path: str) -> str:
    if not path:
        return "/"
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return path

def ds_metrics(request):
    if HMAC_ENABLED:
        ts = request.headers.get("X-SeqPulse-Timestamp", "")
        nonce = request.headers.get("X-SeqPulse-Nonce", "")
        sig = request.headers.get("X-SeqPulse-Signature", "")
        ver = request.headers.get("X-SeqPulse-Signature-Version", "")
        method = (request.headers.get("X-SeqPulse-Method") or request.method or "GET").upper()
        path = canonicalize_path(request.headers.get("X-SeqPulse-Canonical-Path") or request.path)

        if not ts or not nonce or not sig or ver != "v2":
            return JsonResponse({"error": "Missing or invalid HMAC headers"}, status=401)

        try:
            sent = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return JsonResponse({"error": "Invalid timestamp"}, status=401)

        now_utc = now().astimezone(timezone.utc)
        delta = (now_utc - sent).total_seconds()
        if delta > MAX_SKEW_PAST or delta < -MAX_SKEW_FUTURE:
            return JsonResponse({"error": "Invalid timestamp"}, status=401)

        if not cache.add(f"seqpulse_nonce:{nonce}", True, timeout=NONCE_TTL):
            return JsonResponse({"error": "Nonce reuse"}, status=401)

        payload = f"{ts}|{method}|{path}|{nonce}"
        expected = "sha256=" + hmac.new(HMAC_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return JsonResponse({"error": "Invalid signature"}, status=401)

    return JsonResponse({
        "metrics": {
            "requests_per_sec": 12.3,
            "latency_p95": 220,
            "error_rate": 0.01,
            "cpu_usage": 0.32,
            "memory_usage": 0.45,
        }
    })
```
