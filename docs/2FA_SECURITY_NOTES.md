# 2FA Security Notes (Reference)

Last reviewed: 2026-02-18

## Scope
This note captures the current security behavior of 2FA in SeqPulse, so it can be re-checked later.

## 1) Recovery codes are hashed in DB
- Recovery codes are generated as plain values for one-time display, then hashed with `bcrypt`.
- Hashing function: `get_password_hash(...)` from `backend/app/core/security.py:28`.
- Recovery generation and hashing: `backend/app/auth/twofa_service.py:214` and `backend/app/auth/twofa_service.py:223`.
- Stored field: `users.twofa_recovery_codes_hash` (`backend/app/db/models/user.py:22`).
- On successful usage, the used recovery code hash is removed from the stored list:
  - `backend/app/auth/twofa_service.py:239`
  - `backend/app/auth/twofa_service.py:247`

## 2) TOTP secrets are not stored in clear text
- TOTP secret is encrypted before persistence using Fernet:
  - `backend/app/auth/twofa_service.py:69`
- TOTP secret is decrypted only for verification:
  - `backend/app/auth/twofa_service.py:75`
  - `backend/app/auth/twofa_service.py:179`
- Stored field is `twofa_secret_encrypted` (`backend/app/db/models/user.py:19`), not raw secret.
- On 2FA disable, encrypted secret and recovery hashes are cleared:
  - `backend/app/auth/routes.py:1454`
  - `backend/app/auth/routes.py:1457`

## 3) Brute-force protections are present
- Global/auth 2FA rate limits (slowapi):
  - `auth`: `5/minute`
  - `twofa_setup_start`: `3/minute`
  - `twofa_setup_verify`: `5/minute`
  - `twofa_challenge_verify`: `8/minute`
  - `twofa_sensitive`: `3/minute`
  - Source: `backend/app/core/rate_limit.py:41`
- Login 2FA challenge has per-challenge attempt tracking and lockout:
  - DB fields: `attempt_count`, `max_attempts` in `backend/app/db/models/auth_challenge.py:17`
  - Enforcement path: `backend/app/auth/routes.py:1262`
  - Invalid attempts increment counter: `backend/app/auth/routes.py:1377`
  - Hard stop with HTTP 429 when max attempts reached: `backend/app/auth/routes.py:1352` and `backend/app/auth/routes.py:1392`
- TOTP anti-replay is enforced with `twofa_last_totp_step`:
  - `backend/app/auth/twofa_service.py:189`

## Important production note
- Current slowapi storage is in-memory (`memory://`), which is process-local:
  - `backend/app/core/rate_limit.py:33`
- For real production (multi-worker / multi-instance), move limiter storage to Redis to get shared/global enforcement.

## Config knobs to review regularly
- `TWOFA_ENCRYPTION_KEY`
- `TWOFA_CHALLENGE_MAX_ATTEMPTS`
- `TWOFA_CHALLENGE_TTL_SECONDS`
- `TWOFA_PREAUTH_TTL_SECONDS`
- `TWOFA_VALID_WINDOW`
- Defined in `backend/app/core/settings.py:25`

