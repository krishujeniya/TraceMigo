# Deployment Guide — TraceMigo

> Operational Runbook for Production Deployment, Health Verification, and Rollbacks.
> Standardized across the project suite in conformance with deployment engineering patterns.

---

## 1. Architecture & Production Topology

**Application Type**: Interactive Code Execution & Diagnostic Learning Platform

### Declared Service Topology
- **`tracemigo_api`**: Fastify Node 22 API backend (Port: `3001`)
- **`tracemigo_web`**: Next.js 15 UI frontend (Port: `3000`)
- **`tracemigo_postgres`**: PostgreSQL 17 relational database (Port: `5432`)

All services are orchestrated via `docker-compose.yml` with isolated internal bridge networking, non-root system users (uid 1001), and layer-cached multi-stage container builds.

---

## 2. Environment Configuration

Supply environment variables via a secure `.env` file (or CI/CD secrets manager). Never commit plaintext credentials to Git.

### Key Environment Variables
- `TRACEMIGO_PORT`
- `TRACEMIGO_HOST`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`

---

## 3. Deployment Procedures

### Method A: Single-Host / VPS Deployment (Docker Compose)

1. **Clone repository on host**:
   ```bash
   git clone https://github.com/krishujeniya/TraceMigo.git
   cd TraceMigo
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env # edit with production secrets
   ```

3. **Start stack in detached mode**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify container health and logs**:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

### Method B: Pre-built Container Registry Deployment (GHCR)

Pre-built multi-stage production images are published automatically via GitHub Actions:
```bash
docker pull ghcr.io/krishujeniya/tracemigo-tracemigo-api:latest
docker run -d --restart unless-stopped -p 3001:3001 ghcr.io/krishujeniya/tracemigo-tracemigo-api:latest
```

### Method C: Vercel Serverless Deployment (CLI)

Serverless API and UI deployment via Vercel CLI:
```bash
# Link project and pull environment
vercel link --yes

# Deploy preview build
vercel deploy

# Deploy production release
vercel deploy --prod
```

### Method D: Cloudflare Free Stack Deployment (CLI)

Edge Gateway Worker with D1 persistence and KV rate limiting:
```bash
# Verify shared D1 and KV bindings
wrangler d1 info shared-production-db
wrangler kv namespace list

# Deploy Edge Gateway Worker
wrangler deploy
```

---

## 4. Health Check & Readiness Probes

### Verification Command
Run the designated health check probe to confirm operational readiness:
```bash
curl -f http://localhost:3001/v1/health/live
```

Expected HTTP Response: `200 OK`

---

## 5. Rollback Procedures

If an anomaly, regression, or service failure is detected:

### Step 1: Immediate Container Rollback
Roll back immediately to the previous immutable release tag or SHA:
```bash
# Pull previous known healthy SHA tag
docker pull ghcr.io/krishujeniya/tracemigo-tracemigo-api:sha-<previous-commit-sha>

# Or revert compose to previous git revision
git checkout <previous-stable-tag>
docker compose up -d
```

### Step 2: Verification
Re-run the health probe to confirm traffic restoration:
```bash
curl -f http://localhost:3001/v1/health/live
```

---

## 6. Pre-Flight & Post-Flight Quality Gates

Follow the 4-phase verification protocol before declaring a release complete:

- [ ] **Code Quality**: Static inspection passed; zero lint or AST warnings.
- [ ] **Build Reproducibility**: Container builds cleanly via multi-stage isolation without dev dependencies.
- [ ] **Environment Validation**: All required environment variables present; secrets injected via secrets manager.
- [ ] **Safety & Probes**: Healthcheck endpoints respond with `200 OK`; rollback target verified.
