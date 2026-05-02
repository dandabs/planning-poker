# Planning Poker

Planning Poker is a lightweight real-time estimation app built with Next.js (frontend), AppSync + DynamoDB (GraphQL API), and SST for infrastructure.

This repository is a monorepo with frontend, serverless functions, and infrastructure code.

Quick links
- Frontend: `packages/frontend`
- Functions (lambda): `packages/functions`
- Infra: `infra`
- GraphQL schema: `graphql/schema.graphql`

Prerequisites
- Node.js 18+ and npm
- (Optional) SST CLI for local infra: `npm i -g sst`

Install

```bash
# from repo root
npm install
```

Run locally (frontend only)

```bash
npm run dev

# Open: http://localhost:3000/room/<roomId>?username=YourName
```

Run with local infra (SST)

```bash
# Start SST dev (local infra + lambdas)
npx sst dev

# or deploy
npx sst deploy
```

Features
- Real-time participant list and votes (WebSocket subscriptions)
- Card-style UI: participant cards arranged around a table
- Voting options shown as cards on a bottom bar
- Reveal / Hide votes (syncs for all users)
- Kick participant or Clear their vote (admin actions)
- Presence heartbeat every 30s; participant TTL set to 40s

GraphQL
- Schema: `graphql/schema.graphql`

How to use
- Open a room: `/room/<roomId>?username=YourName` in the frontend
- Click a vote to cast; host can reveal or hide votes using the table button
- Click a participant card to open a menu with **Kick** and **Clear Choice**

Contributing
- Make changes on a branch, run tests in `core/` with `npm test`, and open a pull request.

License
- See `LICENSE` in the repo root.

