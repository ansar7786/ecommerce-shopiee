# Hyperlocal Kirana Platform 🛒

> **Zero-Commission Community Kirana Commerce Platform**  
> A Community Service Project (CSP) prototype designed for neighborhood kirana stores and customers in **Gudlavalleru, Andhra Pradesh**.

---

## 📌 Overview

The **Hyperlocal Kirana Platform** empowers local neighborhood kirana store owners to receive, manage, and fulfill online grocery and essentials orders without paying marketplace aggregator commissions. 

Customers discover nearby approved kirana stores within a 3–5 km radius, browse bilingual (Telugu & English) catalogues with strictly enforced MRP protections, place orders with simulated digital payments (UPI, Card, COD), and track their order through a real-time state machine. Store owners receive audio and modal alerts upon new orders, pack items using an interactive checklist, flag unavailable items, and complete fulfillment. Administrators supervise platform health, store approvals, catalogues, complaints, and analytics.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18 (PWA), Vite, Tailwind CSS, Lucide React, Recharts, QRCode.react |
| **Localization** | `react-i18next` with Telugu (`te`) and English (`en`) translations |
| **Backend** | Node.js, Express, Socket.IO (WebSockets), Multer (Image uploads) |
| **Database** | MongoDB Atlas / Local MongoDB via Mongoose ODM |
| **Auth & Security** | Google OAuth, httpOnly Cookie JWT sessions, Role-Based Access Control, Idempotency |
| **Testing** | Jest, Supertest |
| **Code Quality** | ESLint, Prettier |

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **MongoDB** instance (Local running on port 27017 or a MongoDB Atlas connection string)
- **npm** (v9+)

### 2. Clone and Install Dependencies
Install dependencies across the root, client, and server:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Environment Variables Configuration

#### Server (`server/.env`):
Create `server/.env` with the following variables:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/kirana_db?retryWrites=true&w=majority
JWT_SECRET=super_secret_kirana_jwt_key_change_in_production_123456
CLIENT_ORIGIN=http://localhost:5802
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ADMIN_EMAILS=admin@demo.com
```

#### Client (`client/.env`):
Create `client/.env` with:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 4. Database Seeding (`seed:all`)
Seed the entire database with a single idempotent command:
```bash
npm run seed:all
```
This runs three seeders sequentially:
1. `seed:catalogue`: Populates master product categories and 100+ standard packaged goods with Telugu and English titles, units, and MRPs.
2. `seed:stores`: Registers and approves 3 pilot stores in Gudlavalleru with location coordinates, operating hours, and stocked products.
3. `seed:demo`: Populates sample orders across various statuses, payments, ratings, and complaints for immediate demo richness (tagged with `isDemo: true` so repeated runs are 100% idempotent and never corrupt real customer data).

### 5. Running the Application
Start both the backend server (port 5000) and frontend client (port 5802) concurrently:
```bash
npm run dev
```

Visit the app in your browser at: **`http://localhost:5802`**

---

## 👥 Demo Accounts & One-Click Login

In development mode (`NODE_ENV=development`), the login screen (`/login`) provides a **Demo Quick Login** panel allowing instant access without requiring Google OAuth credentials:

| Persona | Demo Email | Role | Key Capabilities |
|---|---|---|---|
| **Customer** | `customer@demo.com` | `customer` | Browse nearby stores in Gudlavalleru, manage cart, place orders via Card/UPI/COD, track status, rate store, file complaints. |
| **Store 1** | `store1@demo.com` | `store_owner` | **Sri Krishna Kirana & General Stores**: Live order alerts, audio chime, packing checklist, mark item unavailable, stock toggles. |
| **Store 2** | `store2@demo.com` | `store_owner` | **Gudlavalleru Super Bazaar**: Store inventory, analytics, QR code, store settings. |
| **Store 3** | `store3@demo.com` | `store_owner` | **Balaji Provision Store**: Local grocery operations. |
| **Platform Admin** | `admin@demo.com` | `admin` | Store approvals, master catalogue CRUD, order management, user blocks, complaint resolutions, CSV exports. |

---

## 💳 Payment Simulation & Test Rules

All payments are processed through `paymentService.js` with server-authoritative bill validation:

### 1. Card Simulation
- **Success:** Any valid card format with last 4 digits other than `0002` (e.g., `4111 1111 1111 1111`).
- **Decline:** Any card with last 4 digits `0002` (e.g., `4000 0000 0000 0002`) immediately returns `"Payment declined by bank"`.
- *Security:* Full card numbers and CVVs are strictly client-validated and never sent to or stored on the backend. Only card brand and last 4 digits are retained.

### 2. UPI Simulation
- **Format:** Must match standard VPA syntax `^[\w.\-]{2,}@[a-zA-Z]{2,}$` (e.g., `customer@okhdfcbank`, `kirana@okaxis`).
- **Failure:** Any UPI ID containing the substring `"fail"` (e.g., `testfail@upi`, `fail@okaxis`) simulates a bank rejection.
- **Success:** Valid UPI IDs enter a simulated 20-second authorization countdown before confirming.

### 3. Cash on Delivery (COD)
- Allowed for orders up to **₹2,000** (200,000 paise).
- Creates an immediately confirmed order; store owner marks `"Payment Collected"` upon handover.

### 4. Mock Refunds
- Prepaid orders that transition to `REJECTED`, `CANCELLED`, or `EXPIRED` automatically trigger mock full refunds.
- If a store owner marks an item unavailable and the customer accepts the reduced order, a mock partial refund is credited.

---

## ⏱️ 8-Minute Demo Walkthrough Script (Guide Section 20)

Follow this step-by-step presentation script to demonstrate the platform's complete feature set in 8 minutes:

### Minute 1: Platform Overview & Customer Location
1. Open `http://localhost:5802/login` and click **Customer Demo Login** (`customer@demo.com`).
2. Show the location banner set to **Gudlavalleru (PIN: 521356)**.
3. Switch the language toggle between **English** and **తెలుగు** to showcase full localization.
4. View the list of approved nearby stores (Sri Krishna Kirana, Gudlavalleru Super Bazaar, Balaji Provision Store).

### Minute 2: Catalogue Browsing & Cart Validation
1. Tap on **Sri Krishna Kirana & General Stores**.
2. Notice store operational hours, free delivery threshold chip (e.g., "Free delivery above ₹299"), and store rating.
3. Search for rice or spices using the search bar.
4. Add items to cart (e.g., *Sona Masoori Rice 1kg* and *Tata Salt*). Observe dynamic delivery calculation and near-free-delivery progress indicator.

### Minute 3: Checkout & Payment Simulation
1. Proceed to the Cart screen (`/app/cart`).
2. Select **Home Delivery** and choose the default Gudlavalleru address.
3. Proceed to Checkout (`/app/checkout`).
4. Select **UPI**, enter `customer@okaxis`, and click **Pay**.
5. Watch the payment authorization state transition seamlessly to **Order Placed** (`#KR-xxxx`).

### Minute 4: Store Dashboard & Real-Time Alerts
1. In a split window or second browser tab, log in as **Store Owner** (`store1@demo.com`) at `/store/orders`.
2. Hear the audio chime and observe the real-time popup modal announcing the new incoming order.
3. View order details: customer name, address, delivery method, and ordered items.
4. Tap **Accept Order** to move status from `PLACED` to `ACCEPTED`.

### Minute 5: Packing & Unavailable Item Workflow
1. Move the order to **PACKING**.
2. Use the interactive **Packing Checklist** to check off packaged items.
3. Click **Mark Unavailable** on one item to demonstrate real-world grocery stockouts.
4. Switch back to the Customer tab: observe the live WebSocket alert prompting the customer to accept the updated total or cancel.
5. Customer taps **Accept Changes**; the store packing screen updates in real time with the recalculated total.

### Minute 6: Order Dispatch & Live Timeline
1. Store taps **Mark Ready**, then **Out for Delivery**.
2. Switch to the Customer tab: view the real-time tracking timeline updating automatically without page refresh.
3. Show the order progress badges and direct tap-to-call store contact button.

### Minute 7: Delivery Handover & Customer Review
1. Store marks the order as **Delivered**.
2. Switch to Customer tab: status transitions to **Delivered**.
3. Customer navigates to **Past Orders** (`/app/orders`) and taps **Rate Store**.
4. Submit a 5-star rating with a comment (*"Fresh items and quick delivery!"*).
5. Demonstrate the **Reorder** button, which validates current stock and repopulates the cart.

### Minute 8: Admin Oversight & Store Analytics
1. Log in as **Admin** (`admin@demo.com`) at `/admin`.
2. View key platform metrics: Total GMV, Orders Today, Store Approval Queue, and Category distribution charts.
3. View the **Orders** tab and show the audit trail with complete `statusHistory` timeline.
4. Demonstrate **Export Reports (CSV)** to download orders and stores data.
5. Switch to Store Analytics (`/store/analytics`) to demonstrate the store owner's daily/weekly revenue graphs.

---

## ⚠️ Known Limitations

1. **Missed Store Alerts on Tab Sleep:**
   Web browsers throttle background tabs. If the store owner minimizes or sleeps their browser tab, WebSockets and audio notifications can be delayed. (In a production deployment, Web Push Notifications or SMS alerts via Twilio/Gupshup would serve as a fallback).
2. **Mocked Payments:**
   All payments and refunds are simulated via `paymentService.js`. No real money transfers or third-party payment gateway webhooks (Razorpay/Cashfree) are implemented.
3. **Sweeper-Based Order Timers:**
   Order expiry (3-minute store response and 10-minute customer confirmation timeouts) is managed via a lightweight 30-second database sweeper interval rather than an external distributed job queue like BullMQ/Redis.
4. **Standard Package Units Only:**
   Products are sold in standardized packaged units (e.g., 500g, 1kg, 1 pc). Custom loose weighable produce (e.g., 350g onions) and arbitrary fractional weights are not supported.
5. **No Dedicated Delivery Fleet:**
   The platform operates on a decentralized store-fulfillment model. Orders are delivered directly by the store's own staff or collected via in-store pickup; there is no third-party rider dispatch or live GPS rider tracking.
6. **Free-Tier Hosting Sleep Cycles:**
   Deployments on free-tier container platforms (e.g., Render, Railway) spin down when idle, resulting in initial cold start latency (30–60s) on the first API request.

---

## 🧪 Testing

Run all unit, integration, state machine, and security tests with Jest:
```bash
# Run server test suite
npm --prefix server test

# Run specifically security tests
npm --prefix server test -- tests/security.test.js
```

### Code Formatting and Linting
```bash
# Run lint check across client and server
npm run lint

# Format code with Prettier
npm run format
```

---

## 📄 License
This project is developed for educational and academic evaluation under the Community Service Project (CSP) curriculum.
