require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const StoreProduct = require('../src/models/StoreProduct');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Review = require('../src/models/Review');
const Complaint = require('../src/models/Complaint');
const {
  PLACED,
  ACCEPTED,
  PACKING,
  READY,
  OUT_FOR_DELIVERY,
  DELIVERED,
  REJECTED,
  CANCELLED,
  EXPIRED,
} = require('../src/constants/orderStatus');
const { COD, CARD, UPI } = require('../src/constants/paymentMethod');
const { SUCCESS, REFUNDED } = require('../src/constants/paymentStatus');
const { CUSTOMER } = require('../src/constants/roles');

async function seedDemo() {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting demo seeding...');

    // 1. Clean only demo-tagged records (idempotent)
    console.log('Cleaning previous demo orders, payments, reviews, and complaints...');
    await Promise.all([
      Order.deleteMany({ isDemo: true }),
      Payment.deleteMany({ isDemo: true }),
      Review.deleteMany({ isDemo: true }),
      Complaint.deleteMany({ isDemo: true }),
    ]);

    // 2. Fetch or create demo customer
    let customer = await User.findOne({ email: 'customer@demo.com' });
    if (!customer) {
      customer = await User.create({
        email: 'customer@demo.com',
        name: 'Demo Customer',
        role: CUSTOMER,
        phone: '9999999999',
        addresses: [
          {
            label: 'Home',
            line: 'Door 3-45, Brahmin Street, Gudlavalleru',
            pincode: '521356',
            landmark: 'Near Ganapathi Temple',
            location: {
              type: 'Point',
              coordinates: [81.054082, 16.343565],
            },
            isDefault: true,
          },
        ],
      });
    } else if (!customer.addresses || customer.addresses.length === 0) {
      customer.addresses = [
        {
          label: 'Home',
          line: 'Door 3-45, Brahmin Street, Gudlavalleru',
          pincode: '521356',
          landmark: 'Near Ganapathi Temple',
          location: {
            type: 'Point',
            coordinates: [81.054082, 16.343565],
          },
          isDefault: true,
        },
      ];
      await customer.save();
    }

    const defaultAddress = customer.addresses[0];
    const addressSnapshot = {
      label: defaultAddress.label,
      line: defaultAddress.line,
      pincode: defaultAddress.pincode,
      landmark: defaultAddress.landmark,
      location: defaultAddress.location,
    };

    // 3. Find stores
    const stores = await Store.find({ status: 'approved' }).limit(3);
    if (stores.length === 0) {
      console.error('No approved stores found. Please run npm run seed:stores first.');
      process.exit(1);
    }
    console.log(`Using ${stores.length} approved store(s) for demo orders.`);

    // Map store products
    const storeProductsMap = {};
    for (const s of stores) {
      const prods = await StoreProduct.find({ store: s._id, inStock: true, isActive: true }).limit(8);
      storeProductsMap[s._id.toString()] = prods;
    }

    const now = Date.now();
    const minAgo = (m) => new Date(now - m * 60 * 1000);
    const minFromNow = (m) => new Date(now + m * 60 * 1000);

    // Helpers to build order item snapshot
    const makeItems = (storeId, count = 2) => {
      const prods = storeProductsMap[storeId.toString()] || [];
      const selected = prods.slice(0, count);
      if (selected.length === 0) {
        // Fallback item if store has no products
        return [
          {
            storeProductId: new mongoose.Types.ObjectId(),
            name: 'Demo Product 1kg',
            nameTe: 'డెమో సరుకు 1కేజీ',
            unit: '1 kg',
            price: 6500, // ₹65.00
            qty: 1,
            available: true,
          },
        ];
      }
      return selected.map((p, idx) => ({
        storeProductId: p._id,
        name: p.customName || 'Store Item',
        nameTe: p.customName || 'సరుకు',
        unit: '1 pack',
        price: p.price,
        qty: idx === 0 ? 2 : 1,
        available: true,
      }));
    };

    // 12 Demo order blueprints
    const orderDefinitions = [
      // 1. PLACED
      {
        orderNo: 'KR-DEMO-1001',
        storeIndex: 0,
        status: PLACED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(2),
        expiresAt: minFromNow(1),
        itemCount: 2,
        history: [{ status: PLACED, at: minAgo(2), by: customer._id, byRole: 'customer', note: 'Order placed by customer' }],
      },
      // 2. ACCEPTED
      {
        orderNo: 'KR-DEMO-1002',
        storeIndex: 0,
        status: ACCEPTED,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(12),
        expiresAt: minFromNow(15),
        itemCount: 3,
        cardLast4: '4242',
        cardBrand: 'visa',
        history: [
          { status: PLACED, at: minAgo(12), by: customer._id, byRole: 'customer', note: 'Order placed by customer' },
          { status: ACCEPTED, at: minAgo(10), byRole: 'store', note: 'Store accepted the order' },
        ],
      },
      // 3. PACKING
      {
        orderNo: 'KR-DEMO-1003',
        storeIndex: 0,
        status: PACKING,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: SUCCESS,
        createdAt: minAgo(25),
        expiresAt: minFromNow(30),
        itemCount: 4,
        upiId: 'customer@okhdfcbank',
        history: [
          { status: PLACED, at: minAgo(25), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(23), byRole: 'store', note: 'Store accepted' },
          { status: PACKING, at: minAgo(20), byRole: 'store', note: 'Items being packed into delivery bag' },
        ],
      },
      // 4. READY (Pickup)
      {
        orderNo: 'KR-DEMO-1004',
        storeIndex: 0,
        status: READY,
        fulfilment: 'pickup',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(40),
        expiresAt: minFromNow(60),
        itemCount: 2,
        history: [
          { status: PLACED, at: minAgo(40), by: customer._id, byRole: 'customer', note: 'Self pickup order placed' },
          { status: ACCEPTED, at: minAgo(38), byRole: 'store', note: 'Store confirmed pickup order' },
          { status: PACKING, at: minAgo(35), byRole: 'store', note: 'Packing items' },
          { status: READY, at: minAgo(20), byRole: 'store', note: 'Order packed and ready at counter' },
        ],
      },
      // 5. OUT_FOR_DELIVERY
      {
        orderNo: 'KR-DEMO-1005',
        storeIndex: 1,
        status: OUT_FOR_DELIVERY,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(45),
        expiresAt: minFromNow(45),
        itemCount: 3,
        cardLast4: '1111',
        cardBrand: 'mastercard',
        history: [
          { status: PLACED, at: minAgo(45), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(42), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(35), byRole: 'store', note: 'Packing complete' },
          { status: READY, at: minAgo(25), byRole: 'store', note: 'Bag ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(15), byRole: 'store', note: 'Delivery rider is on the way' },
        ],
      },
      // 6. DELIVERED x 1 (With 5-star Review)
      {
        orderNo: 'KR-DEMO-1006',
        storeIndex: 0,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: SUCCESS,
        createdAt: minAgo(180),
        expiresAt: minAgo(120),
        itemCount: 2,
        upiId: 'siva@ybl',
        history: [
          { status: PLACED, at: minAgo(180), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(175), byRole: 'store', note: 'Order accepted' },
          { status: PACKING, at: minAgo(170), byRole: 'store', note: 'Packed' },
          { status: READY, at: minAgo(160), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(150), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(135), byRole: 'store', note: 'Delivered to customer doorstep' },
        ],
        hasReview: {
          rating: 5,
          comment: 'సూపర్ సర్వీస్! సరుకులు చాలా ఫ్రెష్‌గా త్వరగా వచ్చాయి. ధన్యవాదాలు.',
        },
      },
      // 7. DELIVERED x 2 (Pickup with 4-star Review)
      {
        orderNo: 'KR-DEMO-1007',
        storeIndex: 1,
        status: DELIVERED,
        fulfilment: 'pickup',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(320),
        expiresAt: minAgo(260),
        itemCount: 3,
        history: [
          { status: PLACED, at: minAgo(320), by: customer._id, byRole: 'customer', note: 'Pickup order placed' },
          { status: ACCEPTED, at: minAgo(315), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(310), byRole: 'store', note: 'Packing' },
          { status: READY, at: minAgo(300), byRole: 'store', note: 'Ready at counter' },
          { status: DELIVERED, at: minAgo(280), byRole: 'store', note: 'Handed over to customer' },
        ],
        hasReview: {
          rating: 4,
          comment: 'Quick and hassle-free pickup at the counter. Everything was neatly organized.',
        },
      },
      // 8. DELIVERED x 3 (With Open Complaint)
      {
        orderNo: 'KR-DEMO-1008',
        storeIndex: 1,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: CARD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(480),
        expiresAt: minAgo(420),
        itemCount: 4,
        cardLast4: '8888',
        cardBrand: 'visa',
        history: [
          { status: PLACED, at: minAgo(480), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(475), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(465), byRole: 'store', note: 'Packing' },
          { status: READY, at: minAgo(455), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(445), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(430), byRole: 'store', note: 'Delivered' },
        ],
        hasComplaint: {
          message: 'One packet of curd was missing from the bag. Please check with the store and assist.',
          status: 'open',
        },
      },
      // 9. DELIVERED x 4
      {
        orderNo: 'KR-DEMO-1009',
        storeIndex: stores.length > 2 ? 2 : 0,
        status: DELIVERED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: SUCCESS,
        createdAt: minAgo(600),
        expiresAt: minAgo(540),
        itemCount: 2,
        history: [
          { status: PLACED, at: minAgo(600), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: ACCEPTED, at: minAgo(595), byRole: 'store', note: 'Accepted' },
          { status: PACKING, at: minAgo(585), byRole: 'store', note: 'Packed' },
          { status: READY, at: minAgo(575), byRole: 'store', note: 'Ready' },
          { status: OUT_FOR_DELIVERY, at: minAgo(565), byRole: 'store', note: 'Out for delivery' },
          { status: DELIVERED, at: minAgo(550), byRole: 'store', note: 'Delivered' },
        ],
      },
      // 10. REJECTED
      {
        orderNo: 'KR-DEMO-1010',
        storeIndex: 1,
        status: REJECTED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: REFUNDED,
        createdAt: minAgo(90),
        expiresAt: minAgo(87),
        itemCount: 2,
        rejectReason: 'Store closing soon for festival',
        history: [
          { status: PLACED, at: minAgo(90), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: REJECTED, at: minAgo(88), byRole: 'store', note: 'Store closing early for the festival' },
        ],
      },
      // 11. CANCELLED
      {
        orderNo: 'KR-DEMO-1011',
        storeIndex: 0,
        status: CANCELLED,
        fulfilment: 'delivery',
        paymentMethod: UPI,
        paymentStatus: REFUNDED,
        createdAt: minAgo(140),
        expiresAt: minAgo(130),
        itemCount: 2,
        upiId: 'customer@okhdfcbank',
        history: [
          { status: PLACED, at: minAgo(140), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: CANCELLED, at: minAgo(136), by: customer._id, byRole: 'customer', note: 'Customer cancelled: Ordered duplicate items' },
        ],
      },
      // 12. EXPIRED
      {
        orderNo: 'KR-DEMO-1012',
        storeIndex: 1,
        status: EXPIRED,
        fulfilment: 'delivery',
        paymentMethod: COD,
        paymentStatus: REFUNDED,
        createdAt: minAgo(240),
        expiresAt: minAgo(237),
        itemCount: 3,
        history: [
          { status: PLACED, at: minAgo(240), by: customer._id, byRole: 'customer', note: 'Order placed' },
          { status: EXPIRED, at: minAgo(237), byRole: 'system', note: 'Store response timeout expired (3 minutes)' },
        ],
      },
    ];

    let createdOrdersCount = 0;
    for (const def of orderDefinitions) {
      const targetStore = stores[def.storeIndex] || stores[0];
      const items = makeItems(targetStore._id, def.itemCount);
      const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const deliveryFee = def.fulfilment === 'delivery' ? (subtotal >= targetStore.freeDeliveryAbove ? 0 : targetStore.deliveryFee) : 0;
      const total = subtotal + deliveryFee;

      // 1. Create Payment
      const payment = await Payment.create({
        user: customer._id,
        method: def.paymentMethod,
        amount: total,
        status: def.paymentStatus,
        last4: def.cardLast4 || null,
        brand: def.cardBrand || null,
        upiId: def.upiId || null,
        isDemo: true,
      });

      // 2. Create Order
      const order = await Order.create({
        orderNo: def.orderNo,
        customer: customer._id,
        store: targetStore._id,
        items,
        addressSnapshot,
        fulfilment: def.fulfilment,
        subtotal,
        deliveryFee,
        total,
        payment: payment._id,
        paymentMethod: def.paymentMethod,
        paymentStatus: def.paymentStatus,
        status: def.status,
        statusHistory: def.history,
        rejectReason: def.rejectReason || '',
        expiresAt: def.expiresAt,
        idempotencyKey: `demo-idemp-${def.orderNo}`,
        isDemo: true,
        createdAt: def.createdAt,
        updatedAt: def.createdAt,
      });

      // Link payment to order
      payment.order = order._id;
      await payment.save();

      // 3. Create Review if applicable
      if (def.hasReview) {
        await Review.create({
          user: customer._id,
          store: targetStore._id,
          order: order._id,
          rating: def.hasReview.rating,
          comment: def.hasReview.comment,
          isDemo: true,
        });
      }

      // 4. Create Complaint if applicable
      if (def.hasComplaint) {
        await Complaint.create({
          user: customer._id,
          order: order._id,
          message: def.hasComplaint.message,
          status: def.hasComplaint.status,
          isDemo: true,
        });
      }

      createdOrdersCount++;
    }

    console.log(`Successfully seeded ${createdOrdersCount} demo orders across ${stores.length} store(s)!`);
    console.log('Seeded demo reviews and complaints. Every dashboard and list now has rich demo content.');

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during demo seeding:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDemo();
}

module.exports = seedDemo;
