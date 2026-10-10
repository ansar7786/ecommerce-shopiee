require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const MasterProduct = require('../src/models/MasterProduct');
const StoreProduct = require('../src/models/StoreProduct');
const { STORE_OWNER } = require('../src/constants/roles');

const SEED_LAT = Number(process.env.SEED_LAT || 16.343565671713698);
const SEED_LNG = Number(process.env.SEED_LNG || 81.05408215921423);

const STORE_DEFINITIONS = [
  {
    ownerEmail: 'store1@demo.com',
    ownerName: 'Ramesh Kumar',
    ownerPhone: '9848011111',
    storeName: 'Sri Krishna Kirana & General Stores',
    slug: 'sri-krishna-kirana-stores',
    phone: '9848011111',
    address: 'Near Gandhi Statue, Main Road, Gudlavalleru',
    pincode: '521356',
    // ~300m away
    coordinates: [SEED_LNG + 0.002, SEED_LAT + 0.0018],
    isOpen: true,
    timings: { open: '07:00', close: '22:00' },
    deliveryRadiusKm: 3,
    deliveryFee: 1500, // ₹15.00
    freeDeliveryAbove: 24900, // ₹249.00
    minOrder: 4900, // ₹49.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.8,
    ratingCount: 142,
    productCountTarget: 50,
  },
  {
    ownerEmail: 'store2@demo.com',
    ownerName: 'Venkata Rao',
    ownerPhone: '9848022222',
    storeName: 'Gudlavalleru Super Bazaar',
    slug: 'gudlavalleru-super-bazaar',
    phone: '9848022222',
    address: 'Opp. Bus Stand, College Road, Gudlavalleru',
    pincode: '521356',
    // ~650m away
    coordinates: [SEED_LNG - 0.004, SEED_LAT - 0.003],
    isOpen: true,
    timings: { open: '06:30', close: '21:30' },
    deliveryRadiusKm: 4,
    deliveryFee: 2000, // ₹20.00
    freeDeliveryAbove: 29900, // ₹299.00
    minOrder: 9900, // ₹99.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.6,
    ratingCount: 98,
    productCountTarget: 55,
  },
  {
    ownerEmail: 'store3@demo.com',
    ownerName: 'Suresh Babu',
    ownerPhone: '9848033333',
    storeName: 'Balaji Provision Store',
    slug: 'balaji-provision-store',
    phone: '9848033333',
    address: 'Railway Station Road, Gudlavalleru',
    pincode: '521356',
    // ~1.05km away
    coordinates: [SEED_LNG + 0.007, SEED_LAT + 0.005],
    isOpen: false, // Closed store as requested!
    timings: { open: '08:00', close: '20:00' },
    deliveryRadiusKm: 2,
    deliveryFee: 2500, // ₹25.00
    freeDeliveryAbove: 34900, // ₹349.00
    minOrder: 9900, // ₹99.00
    supportsDelivery: true,
    supportsPickup: true,
    ratingAvg: 4.3,
    ratingCount: 45,
    productCountTarget: 45,
  },
];

async function seedStores() {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting store seeding...');

    // Fetch master products
    const masterProducts = await MasterProduct.find({ isActive: true });
    if (masterProducts.length === 0) {
      console.error('No master products found! Please run npm run seed:catalogue first.');
      process.exit(1);
    }
    console.log(`Found ${masterProducts.length} active master products.`);

    for (const def of STORE_DEFINITIONS) {
      console.log(`\nProcessing store owner: ${def.ownerEmail}`);

      // 1. Ensure store owner user exists
      let owner = await User.findOne({ email: def.ownerEmail });
      if (!owner) {
        owner = await User.create({
          email: def.ownerEmail,
          name: def.ownerName,
          phone: def.ownerPhone,
          role: STORE_OWNER,
        });
        console.log(`✓ Created store owner: ${owner.name} (${owner.email})`);
      } else {
        owner.role = STORE_OWNER;
        owner.name = def.ownerName;
        owner.phone = def.ownerPhone;
        await owner.save();
        console.log(`✓ Updated existing owner: ${owner.name}`);
      }

      // 2. Ensure store exists
      let store = await Store.findOne({ owner: owner._id });
      if (!store) {
        store = await Store.create({
          owner: owner._id,
          name: def.storeName,
          slug: def.slug,
          phone: def.phone,
          address: def.address,
          pincode: def.pincode,
          location: {
            type: 'Point',
            coordinates: def.coordinates,
          },
          status: 'approved',
          isOpen: def.isOpen,
          timings: def.timings,
          deliveryRadiusKm: def.deliveryRadiusKm,
          deliveryFee: def.deliveryFee,
          freeDeliveryAbove: def.freeDeliveryAbove,
          minOrder: def.minOrder,
          supportsDelivery: def.supportsDelivery,
          supportsPickup: def.supportsPickup,
          ratingAvg: def.ratingAvg,
          ratingCount: def.ratingCount,
        });
        console.log(`✓ Created store: "${store.name}" (Status: approved, isOpen: ${store.isOpen})`);
      } else {
        store.name = def.storeName;
        store.phone = def.phone;
        store.address = def.address;
        store.pincode = def.pincode;
        store.location = {
          type: 'Point',
          coordinates: def.coordinates,
        };
        store.status = 'approved';
        store.isOpen = def.isOpen;
        store.timings = def.timings;
        store.deliveryRadiusKm = def.deliveryRadiusKm;
        store.deliveryFee = def.deliveryFee;
        store.freeDeliveryAbove = def.freeDeliveryAbove;
        store.minOrder = def.minOrder;
        store.supportsDelivery = def.supportsDelivery;
        store.supportsPickup = def.supportsPickup;
        store.ratingAvg = def.ratingAvg;
        store.ratingCount = def.ratingCount;
        await store.save();
        console.log(`✓ Updated store: "${store.name}" (isOpen: ${store.isOpen})`);
      }

      // 3. Seed 40–60 store products from master products
      const targetCount = Math.min(def.productCountTarget, masterProducts.length);
      const chosenMasters = masterProducts.slice(0, targetCount);

      let addedProducts = 0;
      for (let i = 0; i < chosenMasters.length; i++) {
        const master = chosenMasters[i];

        // Slightly different prices, never above MRP (2% to 12% discount)
        const discountFraction = 0.02 + ((i % 11) * 0.01);
        const price = Math.max(100, Math.floor(master.mrp * (1 - discountFraction)));

        const existing = await StoreProduct.findOne({
          store: store._id,
          masterProduct: master._id,
        });

        if (!existing) {
          await StoreProduct.create({
            store: store._id,
            masterProduct: master._id,
            price,
            mrp: master.mrp,
            inStock: i % 15 !== 0, // mark a few items out of stock for realism
            isActive: true,
          });
          addedProducts++;
        } else {
          existing.price = price;
          existing.mrp = master.mrp;
          existing.isActive = true;
          await existing.save();
        }
      }

      const totalStoreProducts = await StoreProduct.countDocuments({
        store: store._id,
        isActive: true,
      });
      console.log(
        `✓ Store has ${totalStoreProducts} active products (newly added: ${addedProducts}).`,
      );
    }

    console.log('\n=============================================');
    console.log('Stores and products seeded successfully! 🎉');
    console.log('=============================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding stores:', error);
    process.exit(1);
  }
}

seedStores();
