PROJECT_CONTEXT.md

Read this file first, in every chat. If a request conflicts with it, ask before changing anything here.

1. What this is

Hyperlocal Kirana Platform: a zero-commission web platform where neighbourhood kirana stores receive and fulfil online orders from nearby customers.

Type: Community Service Project (CSP) prototype for a graduate student team.
Pilot area: Gudlavalleru, Andhra Pradesh.
Goal: a prototype that looks and behaves like a real product. Payments are mocked.
2. Stack
Layer	Choice
Frontend	React PWA, Vite, Tailwind CSS
Backend	Node.js, Express
Database	MongoDB (Mongoose)
Realtime	Socket.IO
Auth	Google OAuth + httpOnly cookie session. Dev-only Demo Login panel for the 3 roles
i18n	react-i18next: Telugu (te) and English (en)
Dev proxy	Vite proxy to the API, so there is no cross-domain cookie auth
3. Folder structure

Keep in sync with the Design & Development Guide, Part B. If they differ, the Guide wins.

/
├── PROJECT_CONTEXT.md
├── client/                  # Vite + React + Tailwind
│   └── src/
│       ├── components/      # shared UI
│       ├── pages/
│       │   ├── customer/    # C1–C10
│       │   ├── store/       # S1–S8
│       │   └── admin/       # A1–A7
│       ├── hooks/
│       ├── i18n/            # en.json, te.json
│       ├── services/        # api client, socket client
│       └── main.jsx
└── server/
    ├── models/
    ├── routes/
    ├── controllers/
    ├── services/            # paymentService, orderService, geoService
    ├── middleware/          # auth, role guard, error handler
    ├── sockets/
    ├── seed/
    └── index.js
4. Roles
Customer: set location, find nearby stores, browse/search, cart, checkout, track order, history and reorder, ratings and complaints.
Store owner: 4-step registration, admin approval, tick-and-price onboarding from the master catalogue, stock toggles, live orders (popup + sound), packing checklist, mark items unavailable, earnings, settings, QR code.
Admin: dashboard, store approvals, users, master catalogue, orders (with force-cancel), complaints, CSV export.

Role checks are enforced server-side on every route. Hiding a button in the UI is not enough.

5. Order statuses

Happy path:

PAYMENT_PENDING → PLACED → ACCEPTED → PACKING → READY → OUT_FOR_DELIVERY → DELIVERED

Other statuses:

AWAITING_CUSTOMER: entered from ACCEPTED or PACKING (for example when items are unavailable). Returns to PACKING when the customer confirms.
REJECTED: the store declines.
CANCELLED: the customer or admin cancels (admin force-cancel).
EXPIRED: a timeout fired.
DELIVERY_FAILED

Timeouts (setTimeout is fine for the prototype):

Store response: 3 minutes, then EXPIRED.
Customer confirmation: 10 minutes, then EXPIRED.

Transition rules

Every transition is a conditional update: findOneAndUpdate({ _id, status: <expectedFrom> }, ...). If it matches nothing, reject.
Every mutating order endpoint accepts an idempotency key.
All transitions go through one function in orderService. Never set status directly elsewhere.
6. Payments (all mocked via paymentService)

One service, one interface. No other file talks to a "gateway".

COD: order goes to PLACED immediately. Store marks "payment collected" on delivery.
Card: live Luhn, brand and expiry validation.
4111 1111 1111 1111 succeeds.
4000 0000 0000 0002 fails.
Card numbers are never stored or logged.
UPI: user enters a UPI ID, sees "payment request sent" with a 20-second countdown, then success and "Order placed". A UPI ID containing fail ends in failure.
7. Design tokens
Token	Value
Primary (green)	
#15803D
Accent (amber)	
#F59E0B
Fonts	Inter + Noto Sans Telugu
Base viewport	mobile-first, 390 px
Touch targets	48 px minimum; 56 px on store screens
Language	Telugu-first on store screens; customer defaults by user preference

Add the extra tokens (error, neutrals, surfaces, radius) to tailwind.config.js only, never as hardcoded hex values in components.

8. Rules (non-negotiable)
Prices above MRP are blocked, on both client and server.
Packs only. No loose weights or free-text quantities.
Nearby search: $geoNear first, then filter by each store's own delivery radius. Needs a 2dsphere index on store location.
No Razorpay, Web Push/SMS, CSRF tokens or refresh tokens in the prototype.
Auth cookies are httpOnly. Use the Vite proxy in dev; do not enable cross-origin cookies.
All user-facing strings go through react-i18next. No hardcoded English or Telugu in JSX.
Never expose Demo Login outside dev (NODE_ENV !== 'production').
Validate all input on the server. Never trust client-sent prices, totals or statuses; recompute them from the DB.
Keep changes small and scoped to the current build step. Do not refactor unrelated files.
Don't invent screens, statuses or fields that are not in the Guide. Ask first.
11. Never invent or guess image URLs. Product images must be real files in
    /uploads (or Cloudinary) referenced by the image field. If a product has no
    image yet, show the category placeholder tile. Never use stock or random photos.
9. Known limitations (list in the report)
Missed store alerts: a sleeping browser tab can miss the new-order popup and sound. There is no Web Push/SMS in the prototype. Biggest real-world risk.
Timeouts use in-memory setTimeout and are lost on server restart.
Free-tier hosting can sleep and cause slow first loads.
Payments are simulated. No real money moves.
10. Open decisions
Team size and deadline
Who delivers in the pilot (store or a separate rider)
Image storage: local uploads vs Cloudinary
Demo hosting
11. Working agreement for AI chats
Start every chat with: "Read PROJECT_CONTEXT.md first."
State which Build Step (0–14) you're on.
Prefer small diffs. After each step, list the files changed and how to test.
If this file and the Guide disagree, stop and flag it.