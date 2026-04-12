# Disq - Socket Server

A real-time communication server powering **Disq**, a developer-focused chat platform. Built with **Bun** and **Hono**, it handles WebSocket connections for live messaging, friend requests, and direct messages. Backed by **Neon PostgreSQL** via **Drizzle ORM**, with file uploads handled by **Cloudinary**.

---

## Project Objective

The Disq socket server provides the real-time backbone for a Discord-like platform tailored to developers. It enables instant messaging in channels and direct conversations, friendship management, and file/code-snippet sharing - all through a lightweight, high-performance Bun runtime.

---

## Features

The server provides the following capabilities:

- Real-time WebSocket messaging in community channels
- Direct message WebSocket connections between users
- REST endpoints for messages, attachments, and friends
- File and attachment uploads via Cloudinary
- Friend request and relationship management
- Structured database access with Drizzle ORM and Neon PostgreSQL
- CORS-secured communication with the frontend client

---

## Technologies Used

**Runtime & Framework**
- Bun 1.x - JavaScript runtime and package manager
- Hono 4.x - lightweight web framework with built-in WebSocket support

**Database**
- Neon PostgreSQL - serverless PostgreSQL
- Drizzle ORM - type-safe ORM with schema-first migrations

**Storage**
- Cloudinary - cloud-based file and image storage

**Infrastructure**
- Docker + Docker Compose - containerised local development
- ws - WebSocket protocol support

---

## System Requirements

**Hardware**
- Any computer capable of running Docker, or a server/VPS for self-hosting
- Internet connection (required for Neon DB and Cloudinary)

**Software**
- Bun 1.x — https://bun.sh
- Docker + Docker Compose (for containerised setup)
- A Neon PostgreSQL database — https://neon.tech
- A Cloudinary account — https://cloudinary.com

---

## Environment Variables

Create a `.env` file inside the `server/` directory:

```env
# Neon Database
DATABASE_URL=

# API origin (backend URL)
ORIGIN=

# Frontend application URL
FRONTEND_URL=

# Cloudinary file storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Installation and Setup

### Setup Database
1. Create Neon Database (preferably +v17) and get the neon connection string from dashboard.
> Neon may require to manually make database migrations, 
> So first run the migratons from the (frontend/app) and sync with server, 
> Since both app and server share same database.
 
```bash
bun run db:push
```

If the above fails try.
```bash
bun run db:generate

bun run db:migrate
```


### Setup Cloudinary
1. Create Cloudinary account and get the api key and secret.

### Run Locally (Docker) Recomended

1. Clone the repository

```bash
git clone git@github.com:astro81/disq-backend.git
cd disq-server
```

2. Set up environment variables

```bash
cp server/.env.example server/.env
# Fill in your values in server/.env
```

3. Build and start the container

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Socket Server | http://localhost:3000 |

---

### Run Locally (Without Docker)

1. Clone the repository

```bash
git clone https://github.com/your-org/disq-server.git
cd disq-server/server
```

2. Install dependencies

```bash
bun install
```

3. Set up environment variables

```bash
cp .env.example .env
# Fill in your values in .env
```

4. Run database migrations

```bash
bun run db:migrate
```

5. Start the development server

```bash
bun run dev
```

The server will be available at **http://localhost:3000**.

---

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate Drizzle migration files from schema |
| `bun run db:migrate` | Apply pending migrations to the database |
| `bun run db:push` | Push schema changes directly (no migration files) |
| `bun run db:studio` | Open Drizzle Studio to browse data |

---

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| `*` | `/api/messages` | Channel message REST endpoints |
| `*` | `/api/attachments` | File/attachment upload endpoints |
| `*` | `/api/friends` | Friend request and relationship endpoints |
| `*` | `/api/dm-messages` | Direct message REST endpoints |
| WS | `/ws/channel/:channelId` | WebSocket connection for channel messaging |
| WS | `/ws/dm/:conversationId` | WebSocket connection for direct messages |

---

## Project Structure

```
.
├── compose.yml                         # Docker Compose — wires server + network
├── README.md
└── server/
    ├── Dockerfile                      # Two-stage Bun build (builder - runner)
    ├── drizzle.config.ts               # Drizzle Kit configuration
    ├── package.json
    ├── tsconfig.json
    ├── .env.example                    # Environment variable template
    └── src/
        ├── index.ts                    # Hono app entry point - routes, CORS, middleware
        │
        ├── api/
        │   ├── messages/               # Channel message REST handlers
        │   ├── attachments/            # File/attachment upload handlers
        │   ├── friends/                # Friend request and relationship handlers
        │   ├── dm-messages/            # Direct message REST handlers
        │   └── ws/
        │       ├── index.ts            # WebSocket handler - /ws/channel/:channelId
        │       ├── dm-index.ts         # WebSocket handler - /ws/dm/:conversationId
        │       └── helpers/
        │           ├── websocket.types.ts   # Shared WebSocket type definitions
        │           ├── client-parser.ts     # Parses and validates incoming WS messages
        │           ├── message-builder.ts   # Constructs outgoing message payloads
        │           ├── message-persister.ts # Saves channel messages to the database
        │           ├── channel-manager.ts   # Tracks connected clients per channel
        │           ├── dm-manager.ts        # Tracks connected clients per DM conversation
        │           └── dm-persister.ts      # Saves direct messages to the database
        │
        ├── db/                        # Drizzle client setup (Neon HTTP driver)
        │
        ├── lib/
        │   ├── cloudinary.ts           # Cloudinary client setup
        │   └── upload-constant.ts      # Upload size/type constraints
        └── utils/
```

---

## Docker Details

The server uses a two-stage Docker build for a lean production image.

```
Stages
├── builder   — installs all dependencies, builds from source
└── runner    — slim Bun image; copies source, drizzle migrations, and node_modules

Services
└── server    — Hono/Bun API + WebSocket server, port 3000
               runs as non-root for improved security

Networks
└── app-net   — bridge network (shared with frontend if co-deployed)
```

Migrations run automatically on startup via `bun run start`. For production CI/CD pipelines, run `bun run db:migrate` as a separate deployment step before starting the server.

---

## Database Migrations

```bash
# Generate migration files from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Push schema directly without migration files (development only)
bun run db:push

# Browse data visually
bun run db:studio
```

---

## Deployment

For production deployments it is recommended to:

1. Run migrations as a dedicated CI/CD step before starting the server — do not rely on startup-time migration
2. Supply all secrets via your platform's secret manager (e.g. AWS Secrets Manager, Railway environment variables, Render secret files) — never commit `.env`
3. Set `FRONTEND_URL` to your deployed frontend origin for correct CORS behaviour
4. Use a process manager or container orchestrator with `restart: unless-stopped` to handle crashes

---

## Live Project

Frontend: https://cozy-treacle-17c90f.netlify.app/

---

## Future Improvements

Possible improvements for the server:

- Message threading and reactions
- Rate limiting and abuse protection middleware
- End-to-end encryption for direct messages
- Horizontal scaling with Redis pub/sub for multi-instance WebSocket coordination

---

## Authors

Binaya Shrestha
BIT
IIC

---

## License

This project is created for educational purposes as part of a Final Year Project.