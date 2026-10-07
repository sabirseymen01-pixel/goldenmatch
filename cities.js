// cities.js - İl ve Semt/İlçe Bazlı Koordinat ve Mesafe Motoru

const LOCATIONS_DATA = {
  "İstanbul": {
    coords: { lat: 41.0082, lng: 28.9784 },
    districts: {
      "Kadıköy": { lat: 40.9927, lng: 29.0287 },
      "Beşiktaş": { lat: 41.0428, lng: 29.0077 },
      "Şişli": { lat: 41.0602, lng: 28.9877 },
      "Beyoğlu": { lat: 41.0369, lng: 28.9775 },
      "Bakırköy": { lat: 40.9792, lng: 28.8718 },
      "Üsküdar": { lat: 41.0267, lng: 29.0153 },
      "Fatih": { lat: 41.0186, lng: 28.9497 },
      "Maltepe": { lat: 40.9247, lng: 29.1311 },
      "Ataşehir": { lat: 40.9847, lng: 29.1067 },
      "Sarıyer": { lat: 41.1663, lng: 29.0498 },
      "Kartal": { lat: 40.9014, lng: 29.1866 },
      "Pendik": { lat: 40.8756, lng: 29.2333 },
      "Beylikdüzü": { lat: 41.0015, lng: 28.6419 },
      "Esenyurt": { lat: 41.0343, lng: 28.6801 },
      "Bahçelievler": { lat: 41.0000, lng: 28.8600 },
      "Bağcılar": { lat: 41.0333, lng: 28.8500 },
      "Küçükçekmece": { lat: 41.0000, lng: 28.7833 },
      "Zeytinburnu": { lat: 40.9917, lng: 28.9042 }
    }
  },
  "Ankara": {
    coords: { lat: 39.9334, lng: 32.8597 },
    districts: {
      "Çankaya": { lat: 39.9167, lng: 32.8500 },
      "Keçiören": { lat: 39.9833, lng: 32.8667 },
      "Yenimahalle": { lat: 39.9667, lng: 32.8167 },
      "Mamak": { lat: 39.9333, lng: 32.9167 },
      "Etimesgut": { lat: 39.9500, lng: 32.6833 },
      "Sincan": { lat: 39.9667, lng: 32.5833 },
      "Altındağ": { lat: 39.9417, lng: 32.8542 },
      "Gölbaşı": { lat: 39.7833, lng: 32.8000 }
    }
  },
  "İzmir": {
    coords: { lat: 38.4237, lng: 27.1428 },
    districts: {
      "Konak": { lat: 38.4189, lng: 27.1287 },
      "Karşıyaka": { lat: 38.4594, lng: 27.1106 },
      "Bornova": { lat: 38.4636, lng: 27.2164 },
      "Buca": { lat: 38.3878, lng: 27.1778 },
      "Alsancak": { lat: 38.4386, lng: 27.1433 },
      "Çiğli": { lat: 38.4914, lng: 27.0583 },
      "Bayraklı": { lat: 38.4622, lng: 27.1658 },
      "Balçova": { lat: 38.3892, lng: 27.0461 },
      "Çeşme": { lat: 38.3236, lng: 26.3042 },
      "Urla": { lat: 38.3228, lng: 26.7636 }
    }
  },
  "Adana": {
    coords: { lat: 37.0000, lng: 35.3213 },
    districts: {
      "Seyhan": { lat: 36.9850, lng: 35.3250 },
      "Çukurova": { lat: 37.0500, lng: 35.2667 },
      "Yüreğir": { lat: 36.9833, lng: 35.3500 },
      "Sarıçam": { lat: 37.0333, lng: 35.4000 },
      "Ceyhan": { lat: 37.0297, lng: 35.8175 }
    }
  },
  "Eskişehir": {
    coords: { lat: 39.7767, lng: 30.5206 },
    districts: {
      "Tepebaşı": { lat: 39.7900, lng: 30.5000 },
      "Odunpazarı": { lat: 39.7600, lng: 30.5300 }
    }
  },
  "Antalya": {
    coords: { lat: 36.8969, lng: 30.7133 },
    districts: {
      "Muratpaşa": { lat: 36.8833, lng: 30.7000 },
      "Kepez": { lat: 36.9333, lng: 30.6833 },
      "Konyaaltı": { lat: 36.8667, lng: 30.6333 },
      "Alanya": { lat: 36.5438, lng: 31.9998 }
    }
  },
  "Bursa": {
    coords: { lat: 40.1885, lng: 29.0610 },
    districts: {
      "Osmangazi": { lat: 40.1900, lng: 29.0600 },
      "Nilüfer": { lat: 40.2100, lng: 28.9800 },
      "Yıldırım": { lat: 40.1800, lng: 29.1000 }
    }
  }
  // Diğer iller de aynı hiyerarşik formatta koordinatlarıyla listelenebilir
};

// Belirtilen il ve ilçe için koordinat bulucu yardımcı fonksiyon
function resolveCoords(cityName, districtName) {
  if (!cityName) return null;
  const cityData = LOCATIONS_DATA[cityName];
  if (!cityData) return null;

  // Semt/İlçe koordinatı mevcutsa onu kullan
  if (districtName && cityData.districts && cityData.districts[districtName]) {
    return cityData.districts[districtName];
  }

  // Semt bulunamazsa il merkez koordinatını döndür
  return cityData.coords;
}

// İki konum (il + ilçe) arasındaki mesafeyi hesaplayan fonksiyon
function calculateExactDistance(userA, userB) {
  if (!userA?.city || !userB?.city) return null;

  // İkisi de aynı il ve aynı semtteyse mesafe 0 kabul edilir
  if (
    userA.city.trim().toLowerCase() === userB.city.trim().toLowerCase() &&
    userA.district &&
    userB.district &&
    userA.district.trim().toLowerCase() === userB.district.trim().toLowerCase()
  ) {
    return 0;
  }

  const coordA = resolveCoords(userA.city, userA.district);
  const coordB = resolveCoords(userB.city, userB.district);

  if (!coordA || !coordB) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Dünya yarıçapı km

  const dLat = toRad(coordB.lat - coordA.lat);
  const dLng = toRad(coordB.lng - coordA.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coordA.lat)) *
      Math.cos(toRad(coordB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = Math.round(R * c);

  // Aynı il içinde farklı semtlerdeyseler ve hesaplama 0 çıkarsa min 1 km gösterilir
  if (distance === 0 && userA.district !== userB.district) {
    return 1;
  }

  return distance;
}

module.exports = { LOCATIONS_DATA, calculateExactDistance, resolveCoords };
