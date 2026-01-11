# Kasra (Next.js)

KASRA is a financial assistant focused on the Base blockchain.

## Setup

1) Install dependencies

```bash
npm ci
```

2) Configure environment variables

```bash
cp .env.example .env.local
```

Required:

- `CDP_API_KEY_NAME`
- `CDP_API_KEY_PRIVATE_KEY`
- `OPENAI_API_KEY`

Optional:

- `NETWORK_ID` (default: `base-sepolia`)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

3) Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## API

- `POST /api/agent` (JSON body: `{ "message": string }`)

Example:

```bash
curl -s http://localhost:3000/api/agent \
	-H 'content-type: application/json' \
	-d '{"message":"Tolong catat pengeluaran makan Rp 50rb"}'
```

## Notes

- The server may create `wallet_data.txt` at runtime to persist wallet state (ignored by git).
