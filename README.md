# Kasra

Next.js app lives in the `kasra/` folder.

## Quickstart

```bash
cd kasra
npm ci
cp .env.example .env.local
# fill .env.local
npm run dev
```

Open http://localhost:3000.

## API

The agent endpoint is:

- `POST /api/agent`

Example:

```bash
curl -s http://localhost:3000/api/agent \
	-H 'content-type: application/json' \
	-d '{"message":"Saldo saya berapa?"}' | jq
```