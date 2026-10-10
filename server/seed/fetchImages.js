const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const MasterProduct = require('../src/models/MasterProduct');
require('../src/models/Category');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Format paise to rupees for review HTML display
const formatPaise = (paise) => {
  if (typeof paise !== 'number') return '₹0';
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

// Check if an OFF product is likely from/sold in India
const isIndiaProduct = (p) => {
  if (!p) return false;
  const countriesTags = p.countries_tags || [];
  const countries = (p.countries || '').toLowerCase();
  const code = String(p._id || p.code || '');
  return (
    countriesTags.some((c) => c.toLowerCase().includes('india')) ||
    countries.includes('india') ||
    code.startsWith('890') // India barcode prefix
  );
};

// Extract best front image URL from an Open Food Facts product entry
const getFrontImageUrl = (p) => {
  if (!p) return null;
  if (p.image_front_url) return p.image_front_url;
  if (p.selected_images && p.selected_images.front) {
    const frontObj = p.selected_images.front;
    if (frontObj.display) {
      const langs = Object.keys(frontObj.display);
      for (const lang of ['en', 'hi', ...langs]) {
        if (frontObj.display[lang]) return frontObj.display[lang];
      }
    }
  }
  if (p.image_front_small_url) return p.image_front_small_url;
  if (p.image_url) return p.image_url;
  return null;
};

// Search Open Food Facts with fallback and retry
const searchOFF = async (query) => {
  const endpoints = [
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
    `https://in.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
  ];

  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(endpoint, {
          headers: {
            'User-Agent': 'KiranaPrototype/1.0 (kirana-project@academic.local)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.status === 200) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            return data.products || [];
          }
        }

        // If rate limited or 503, brief pause before retry
        if (res.status === 503 || res.status === 429) {
          await sleep(1500);
        }
      } catch (_err) {
        // Network error, try next attempt or endpoint
      }
    }
  }

  return [];
};

// Find matching image candidate with "India preferred" rule
const findBestImageMatch = (products) => {
  if (!products || products.length === 0) return null;

  const withImages = products
    .map((p) => ({
      product: p,
      imageUrl: getFrontImageUrl(p),
      isIndia: isIndiaProduct(p),
    }))
    .filter((item) => Boolean(item.imageUrl));

  if (withImages.length === 0) return null;

  // India preferred if available
  const indiaCandidate = withImages.find((item) => item.isIndia);
  const chosen = indiaCandidate || withImages[0];

  return {
    imageUrl: chosen.imageUrl,
    matchedTitle: chosen.product.product_name || chosen.product.generic_name || 'Matched Product',
    barcode: chosen.product._id || chosen.product.code || '',
    isIndia: chosen.isIndia,
  };
};

// Generate HTML review report
const generateReviewHtml = (matchedList, unmatchedList, summary) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catalogue Product Images Review</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px 16px;
      line-height: 1.5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .header h1 { font-size: 24px; font-weight: 700; color: #15803d; margin-bottom: 8px; }
    .header p { color: #64748b; font-size: 14px; margin-bottom: 16px; }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .stat-badge {
      background: #f1f5f9;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
    }
    .stat-badge.green { background: #dcfce7; color: #166534; }
    .stat-badge.amber { background: #fef3c7; color: #92400e; }
    .stat-badge.blue { background: #e0f2fe; color: #075985; }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin: 32px 0 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Grid for matched products */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .card-img-wrap {
      width: 100%;
      height: 180px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .card-body {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .card-te {
      font-size: 12px;
      color: #475569;
      margin-bottom: 6px;
    }
    .card-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .card-price {
      font-size: 13px;
      font-weight: 700;
      color: #15803d;
    }
    .card-matched {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
      font-size: 11px;
      color: #64748b;
      word-break: break-word;
    }
    .badge-origin {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e2e8f0;
      color: #334155;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .badge-origin.india { background: #dcfce7; color: #15803d; }

    /* Table for unmatched */
    .table-wrap {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      padding: 10px 14px;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:last-child td { border-bottom: none; }
    .placeholder-note {
      color: #b45309;
      font-size: 11px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Catalogue Product Photos Review</h1>
      <p>Eyeball and verify real Open Food Facts images matched to master products. Unmatched products retain image = null and will show their Category icon placeholder tile in the UI.</p>
      <div class="stats">
        <div class="stat-badge blue">Total Products: ${summary.total}</div>
        <div class="stat-badge green">✓ Matched with Photo: ${summary.matched}</div>
        <div class="stat-badge amber">○ Not Matched (Null): ${summary.notMatched}</div>
      </div>
    </div>

    <h2 class="section-title">
      ✓ Matched Products (${matchedList.length})
    </h2>
    <div class="grid">
      ${matchedList
        .map(
          (item) => `
        <div class="card">
          <div class="card-img-wrap">
            <img class="card-img" src="${item.localRelativeUrl}" alt="${item.name}" loading="lazy" />
          </div>
          <div class="card-body">
            <div class="card-title">${item.name}</div>
            <div class="card-te">${item.nameTe}</div>
            <div class="card-meta">
              <span>${item.brand} • ${item.unit}</span>
              <span class="card-price">${formatPaise(item.mrp)}</span>
            </div>
            <div class="card-matched">
              <span class="badge-origin ${item.isIndia ? 'india' : ''}">${item.isIndia ? 'India Match' : 'Global Match'}</span>
              <div><strong>OFF Match:</strong> ${item.matchedTitle}</div>
            </div>
          </div>
        </div>
      `,
        )
        .join('')}
    </div>

    <h2 class="section-title">
      ○ Unmatched Products (${unmatchedList.length})
    </h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product Name (EN)</th>
            <th>Telugu Name</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Unit</th>
            <th>MRP</th>
            <th>Status / UI Representation</th>
          </tr>
        </thead>
        <tbody>
          ${unmatchedList
            .map(
              (item) => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td>${item.nameTe}</td>
              <td>${item.brand}</td>
              <td>${item.categoryName || '-'}</td>
              <td>${item.unit}</td>
              <td>${formatPaise(item.mrp)}</td>
              <td><span class="placeholder-note">Null (Category placeholder tile)</span></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
};

const fetchImages = async () => {
  try {
    console.log('=== Starting Real Product Photos Fetch from Open Food Facts ===');
    await connectDB();

    const uploadDir = path.join(__dirname, '../uploads/products');
    fs.mkdirSync(uploadDir, { recursive: true });

    // Fetch all master products
    const products = await MasterProduct.find().populate('category').sort({ createdAt: 1 });
    console.log(`Loaded ${products.length} master products from database.\n`);

    const matchedList = [];
    const unmatchedList = [];

    let alreadyHadCount = 0;
    let newlyDownloadedCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const prodId = String(product._id);
      const filePath = path.join(uploadDir, `${prodId}.jpg`);
      const localRelativeUrl = `/uploads/products/${prodId}.jpg`;
      const categoryName = product.category?.name || '';

      // Skip products that already have an image in DB or already downloaded on disk (never overwrite)
      if (product.image && fs.existsSync(filePath)) {
        alreadyHadCount++;
        matchedList.push({
          id: prodId,
          name: product.name,
          nameTe: product.nameTe,
          brand: product.brand,
          unit: product.unit,
          mrp: product.mrp,
          categoryName,
          localRelativeUrl: product.image,
          matchedTitle: 'Previously downloaded / set',
          isIndia: true,
        });
        console.log(`[${i + 1}/${products.length}] [SKIP] ${product.name} (already has image)`);
        continue;
      }

      // Check if image file exists locally but DB has null
      if (fs.existsSync(filePath)) {
        alreadyHadCount++;
        await MasterProduct.findByIdAndUpdate(product._id, { image: localRelativeUrl });
        matchedList.push({
          id: prodId,
          name: product.name,
          nameTe: product.nameTe,
          brand: product.brand,
          unit: product.unit,
          mrp: product.mrp,
          categoryName,
          localRelativeUrl,
          matchedTitle: 'Existing local photo linked',
          isIndia: true,
        });
        console.log(`[${i + 1}/${products.length}] [LINK] ${product.name} (re-linked local file)`);
        continue;
      }

      // Construct search queries
      const brand = (product.brand || '').trim();
      const name = (product.name || '').trim();

      // Query 1: Cleaned brand + name
      let primaryQuery = name;
      if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) {
        primaryQuery = `${brand} ${name}`;
      }

      // Query 2: Remove trailing pack weights (e.g., "5kg", "500 ml") if query 1 fails
      const simplifiedQuery = primaryQuery
        .replace(/\s+\d+(\.\d+)?\s*(kg|g|gm|l|ml|pcs|sachets)\b/gi, '')
        .trim();

      console.log(`[${i + 1}/${products.length}] Searching OFF for: "${primaryQuery}"...`);

      // Rate limit: 1 request per second
      await sleep(1100);

      let offProducts = await searchOFF(primaryQuery);

      // If no results and simplified query is different, try simplified query
      if (
        (!offProducts || offProducts.length === 0) &&
        simplifiedQuery &&
        simplifiedQuery !== primaryQuery
      ) {
        await sleep(1100);
        offProducts = await searchOFF(simplifiedQuery);
      }

      const match = findBestImageMatch(offProducts);

      if (match && match.imageUrl) {
        try {
          // Download image to server/uploads/products/<productId>.jpg
          const imgRes = await fetch(match.imageUrl, {
            headers: { 'User-Agent': 'KiranaPrototype/1.0' },
            signal: AbortSignal.timeout(8000),
          });

          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            fs.writeFileSync(filePath, buffer);

            // Update MasterProduct in DB
            await MasterProduct.findByIdAndUpdate(product._id, { image: localRelativeUrl });

            newlyDownloadedCount++;
            matchedList.push({
              id: prodId,
              name: product.name,
              nameTe: product.nameTe,
              brand: product.brand,
              unit: product.unit,
              mrp: product.mrp,
              categoryName,
              localRelativeUrl,
              matchedTitle: match.matchedTitle,
              isIndia: match.isIndia,
            });

            console.log(
              `  ✓ MATCHED & SAVED: "${match.matchedTitle}" ${match.isIndia ? '[India]' : '[Global]'} -> ${localRelativeUrl}`,
            );
          } else {
            console.log(`  ✗ Download failed (HTTP ${imgRes.status}). Image left null.`);
            unmatchedList.push({
              id: prodId,
              name: product.name,
              nameTe: product.nameTe,
              brand: product.brand,
              unit: product.unit,
              mrp: product.mrp,
              categoryName,
            });
          }
        } catch (downloadErr) {
          console.log(`  ✗ Download error: ${downloadErr.message}. Image left null.`);
          unmatchedList.push({
            id: prodId,
            name: product.name,
            nameTe: product.nameTe,
            brand: product.brand,
            unit: product.unit,
            mrp: product.mrp,
            categoryName,
          });
        }
      } else {
        console.log(`  ○ No front image found on OFF. Image left null.`);
        unmatchedList.push({
          id: prodId,
          name: product.name,
          nameTe: product.nameTe,
          brand: product.brand,
          unit: product.unit,
          mrp: product.mrp,
          categoryName,
        });
      }
    }

    // Write review HTML
    const summary = {
      total: products.length,
      matched: matchedList.length,
      notMatched: unmatchedList.length,
      alreadyHad: alreadyHadCount,
      newlyDownloaded: newlyDownloadedCount,
    };

    const reviewHtmlPath = path.join(__dirname, '../uploads/image-review.html');
    const reviewHtmlContent = generateReviewHtml(matchedList, unmatchedList, summary);
    fs.writeFileSync(reviewHtmlPath, reviewHtmlContent, 'utf-8');

    console.log('\n======================================================');
    console.log('             IMAGE FETCH COMPLETED SUMMARY            ');
    console.log('======================================================');
    console.log(`Total Master Products checked: ${summary.total}`);
    console.log(
      `  ✓ Matched with photos:       ${summary.matched} (Newly downloaded: ${summary.newlyDownloaded}, Existing: ${summary.alreadyHad})`,
    );
    console.log(`  ○ Not matched (left null):    ${summary.notMatched}`);
    console.log('======================================================');
    console.log(`Image review HTML written to: ${reviewHtmlPath}`);
    console.log(`View online at: http://localhost:5000/uploads/image-review.html`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during fetchImages:', err);
    process.exit(1);
  }
};

fetchImages();
