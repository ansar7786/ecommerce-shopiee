const Store = require('../models/Store');

/**
 * Checks if a store is currently open based on its isOpen flag
 * and its open/close timings in Asia/Kolkata time zone.
 */
function checkStoreOpenStatus(store) {
  const open = store.timings?.open || '07:00';
  const close = store.timings?.close || '21:00';

  if (!store.isOpen) {
    return {
      isOpenNow: false,
      opensAt: open,
    };
  }

  // Get current time in Asia/Kolkata
  const now = new Date();
  const kolkataTimeStr = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  let isOpenNow = false;
  if (open <= close) {
    isOpenNow = kolkataTimeStr >= open && kolkataTimeStr <= close;
  } else {
    // Spans across midnight
    isOpenNow = kolkataTimeStr >= open || kolkataTimeStr <= close;
  }

  return {
    isOpenNow,
    opensAt: open,
  };
}

/**
 * Calculates delivery ETA estimate based on distance.
 * 15 min base + 5 min per km, formatted as a 10-minute range.
 */
function calculateEta(distanceKm) {
  const baseMinutes = Math.round(15 + distanceKm * 5);
  return `${baseMinutes}–${baseMinutes + 10} min`;
}

/**
 * Finds approved stores within 5 km using $geoNear,
 * then filters by each store's own deliveryRadiusKm (or keeps pickup-only stores with deliverable: false).
 */
async function getNearbyStores(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid latitude or longitude coordinates');
  }

  // 1. $geoNear aggregation
  const pipeline = [
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        distanceField: 'distanceMetres',
        maxDistance: 5000, // 5 km maximum search window
        query: { status: 'approved' },
        spherical: true,
      },
    },
  ];

  const stores = await Store.aggregate(pipeline);

  // 2. Filter & format each store
  const results = [];

  for (const store of stores) {
    const distanceKm = Number((store.distanceMetres / 1000).toFixed(1));
    const maxDeliveryMetres = (store.deliveryRadiusKm || 3) * 1000;
    const withinRadius = store.distanceMetres <= maxDeliveryMetres;
    const deliverable = Boolean(store.supportsDelivery && withinRadius);

    // Rule: Filter each store by its OWN deliveryRadiusKm (or keep stores that allow pickup but flag deliverable false)
    if (!deliverable && !store.supportsPickup) {
      continue;
    }

    const { isOpenNow, opensAt } = checkStoreOpenStatus(store);
    const eta = calculateEta(distanceKm);

    results.push({
      id: store._id,
      name: store.name,
      slug: store.slug,
      photo: store.photo,
      address: store.address,
      pincode: store.pincode,
      distanceKm,
      distanceMetres: Math.round(store.distanceMetres),
      eta,
      deliveryFee: store.deliveryFee,
      freeDeliveryAbove: store.freeDeliveryAbove,
      minOrder: store.minOrder,
      rating: store.ratingAvg || 4.5,
      ratingCount: store.ratingCount || 0,
      isOpenNow,
      opensAt,
      supportsDelivery: store.supportsDelivery,
      supportsPickup: store.supportsPickup,
      deliverable,
      deliveryRadiusKm: store.deliveryRadiusKm,
    });
  }

  return results;
}

/**
 * Calculates straight line distance in km between two [lng, lat] coordinate pairs.
 */
function calculateDistanceKm(coords1, coords2) {
  if (!coords1 || !coords2) return 0;
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

module.exports = {
  getNearbyStores,
  checkStoreOpenStatus,
  calculateEta,
  calculateDistanceKm,
};
