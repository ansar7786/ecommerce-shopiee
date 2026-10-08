# Kirana Platform

A zero-commission hyperlocal kirana platform enabling neighborhood kirana stores to receive and fulfill online orders.

## Project Structure

```
kirana-platform/
├── PROJECT_CONTEXT.md
├── README.md
├── .gitignore
├── .prettierrc
├── package.json
├── server/
└── client/
```

## Getting Started

### Prerequisites
- Node.js (v20+)
- MongoDB running locally or a MongoDB Atlas URI

### Installation
Install dependencies in root, server, and client:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### Environment Configuration
1. Configure `server/.env` based on `server/.env.example`
2. Configure `client/.env` based on `client/.env.example`

### Running Development Servers
Run both server and client concurrently:
```bash
npm run dev
```

Or run them individually:
```bash
# Server only (runs on port 5000)
npm run dev:server

# Client only (runs on port 5173)
npm run dev:client
```
