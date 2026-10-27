// ==========================================================================
// GOLDENMATCH - COĞRAFİ KONUM VE MESAFE HESAPLAMA MOTORU (CITIES.JS)
// ==========================================================================

const LOCATIONS_DATA = {
  "İstanbul": {
    "Merkez": { lat: 41.0082, lng: 28.9784 },
    "Kadıköy": { lat: 40.9901, lng: 29.0279 },
    "Beşiktaş": { lat: 41.0428, lng: 29.0077 },
    "Şişli": { lat: 41.0602, lng: 28.9877 },
    "Beyoğlu": { lat: 41.0369, lng: 28.9775 },
    "Bakırköy": { lat: 40.9791, lng: 28.8756 },
    "Üsküdar": { lat: 41.0267, lng: 29.0153 },
    "Maltepe": { lat: 40.9295, lng: 29.1308 },
    "Ataşehir": { lat: 40.9923, lng: 29.1136 },
    "Sarıyer": { lat: 41.1685, lng: 29.0573 },
    "Fatih": { lat: 41.0104, lng: 28.9482 },
    "Bahçelievler": { lat: 40.9978, lng: 28.8595 },
    "Avcılar": { lat: 40.9781, lng: 28.7214 },
    "Kartal": { lat: 40.8923, lng: 29.1843 },
    "Pendik": { lat: 40.8756, lng: 29.2341 },
    "Beylikdüzü": { lat: 41.0015, lng: 28.6421 }
  },
  "Ankara": {
    "Merkez": { lat: 39.9334, lng: 32.8597 },
    "Çankaya": { lat: 39.9208, lng: 32.8541 },
    "Kızılay": { lat: 39.9207, lng: 32.8540 },
    "Tunalı": { lat: 39.9056, lng: 32.8597 },
    "Bahçelievler": { lat: 39.9221, lng: 32.8234 },
    "Yenimahalle": { lat: 39.9687, lng: 32.7938 },
    "Batıkent": { lat: 39.9734, lng: 32.7189 },
    "Keçiören": { lat: 39.9663, lng: 32.8617 },
    "Mamak": { lat: 39.9298, lng: 32.9341 }
  },
  "İzmir": {
    "Merkez": { lat: 38.4192, lng: 27.1287 },
    "Alsancak": { lat: 38.4385, lng: 27.1425 },
    "Konak": { lat: 38.4189, lng: 27.1287 },
    "Karşıyaka": { lat: 38.4578, lng: 27.1147 },
    "Bornova": { lat: 38.4622, lng: 27.2163 },
    "Buca": { lat: 38.3813, lng: 27.1738 },
    "Bostanlı": { lat: 38.4552, lng: 27.0961 },
    "Göztepe": { lat: 38.4031, lng: 27.0863 }
  },
  "Antalya": {
    "Merkez": { lat: 36.8969, lng: 30.7133 },
    "Muratpaşa": { lat: 36.8791, lng: 30.7077 },
    "Konyaaltı": { lat: 36.8756, lng: 30.6384 },
    "Lara": { lat: 36.8523, lng: 30.7845 },
    "Kepez": { lat: 36.9167, lng: 30.6667 },
    "Alanya": { lat: 36.5438, lng: 31.9998 }
  },
  "Bursa": {
    "Merkez": { lat: 40.1828, lng: 29.0665 },
    "Nilüfer": { lat: 40.2187, lng: 28.8595 },
    "Osmangazi": { lat: 40.2526, lng: 29.0621 },
    "Yıldırım": { lat: 40.1833, lng: 29.1333 },
    "Mudanya": { lat: 40.3776, lng: 28.8837 }
  }
};

// Haversine Formülü ile İki Nokta Arasındaki KM Mesafesini Hesaplama
function calculateExactDistance(loc1, loc2) {
  try {
    const city1 = LOCATIONS_DATA[loc1.city];
    const city2 = LOCATIONS_DATA[loc2.city];
    if (!city1 || !city2) return null;

    const point1 = city1[loc1.district] || city1["Merkez"];
    const point2 = city2[loc2.district] || city2["Merkez"];
    if (!point1 || !point2) return null;

    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (point2.lat - point1.lat) * (Math.PI / 180);
    const dLon = (point2.lng - point1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * (Math.PI / 180)) * Math.cos(point2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance);
  } catch (e) {
    return null;
  }
}

module.exports = {
  LOCATIONS_DATA,
  calculateExactDistance
};
