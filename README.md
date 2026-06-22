# ChatAPP

A customer-ready real-time messaging product with a premium responsive interface and a deployment architecture that works as one service.

## Product features

- Secure registration, login, logout, and MongoDB-backed sessions
- Protected one-to-one conversations with server-side authorization
- Real-time messaging, online presence, typing indicators, and read receipts
- Unread counts and sorted conversation history
- Message reactions, editing, deletion, and cursor-style history loading
- Image and avatar uploads with file-type and size validation
- People discovery, conversation search, and in-conversation search
- Profile editing, dark mode, mobile navigation, and responsive layouts
- Single-origin production deployment: Express serves the built React app and Socket.IO
- Rate limiting, security headers, restricted input, and production-safe cookies

## Local setup

Requirements: Node.js 20.19+ and MongoDB.

```bash
npm install
cp backend/.env.example backend/.env
npm run dev
```

Open `http://localhost:5173`.

Before running, replace `SESSION_SECRET` in `backend/.env` with a random value:

```bash
openssl rand -base64 48
```

Validate the backend syntax and build the production frontend:

```bash
npm run check
```

## Render deployment

1. Push this project to a new GitHub repository.
2. Create a Render Blueprint and select the repository; Render reads `render.yaml`.
3. Provide `MONGO_URI` using a MongoDB Atlas connection string.
4. Render generates `SESSION_SECRET` and sets `NODE_ENV=production` automatically.
5. Deploy. The backend, frontend, session cookie, and Socket.IO connection all share one domain.

Do not set `FRONTEND_ORIGIN` for the standard single-service deployment. Set it only if you deliberately host another frontend on a different origin.

## Other deployment platforms

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Required environment variables:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...
SESSION_SECRET=a-long-random-secret
```

The platform must support a long-running Node.js web service and WebSockets. Static-only hosting is not sufficient for the backend.

## Productization notes

Small images currently use validated data URLs so the demo works without another vendor. Before high-volume commercial use, move media to object storage such as Cloudinary or S3, add email verification and password recovery, and define moderation/retention policies.
