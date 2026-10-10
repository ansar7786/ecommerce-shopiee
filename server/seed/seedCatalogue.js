const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Category = require('../src/models/Category');
const MasterProduct = require('../src/models/MasterProduct');

const seedCatalogue = async () => {
  try {
    console.log('--- Starting Catalogue Seeding ---');
    await connectDB();

    const dataPath = path.join(__dirname, 'masterProducts.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const batches = JSON.parse(rawData);

    let totalCategories = 0;
    let totalProducts = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // 1. Upsert Category
      const category = await Category.findOneAndUpdate(
        { name: batch.category },
        {
          name: batch.category,
          nameTe: batch.categoryTe,
          icon: batch.categoryIcon,
          sortOrder: (i + 1) * 10,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      totalCategories++;

      // 2. Upsert Products in this Category
      for (const prod of batch.products) {
        await MasterProduct.findOneAndUpdate(
          { name: prod.name, unit: prod.unit },
          {
            name: prod.name,
            nameTe: prod.nameTe,
            brand: prod.brand,
            category: category._id,
            unit: prod.unit,
            mrp: prod.mrp,
            tags: prod.tags || [],
            image: null,
            isActive: true,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        totalProducts++;
      }

      console.log(`Synced Category [${batch.category}] with ${batch.products.length} products`);
    }

    console.log(`\nCatalogue Seed Complete!`);
    console.log(`Total Categories: ${totalCategories}`);
    console.log(`Total Master Products: ${totalProducts}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Catalogue Seeding failed:', error);
    process.exit(1);
  }
};

seedCatalogue();
