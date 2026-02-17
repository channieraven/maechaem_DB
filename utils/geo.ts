
/**
 * UTM to Lat/Lng conversion for Zone 47N (Mae Chaem / Chiang Mai area)
 */
export function utmToLatLng(easting: number, northing: number) {
  const K0 = 0.9996;
  const E = 0.00669438;
  const E2 = E * E;
  const E3 = E2 * E;
  const E_P2 = E / (1 - E);
  const A = 6378137.0;
  const _E = (1 - Math.sqrt(1 - E)) / (1 + Math.sqrt(1 - E));
  const _E2 = _E ** 2;
  const _E3 = _E ** 3;
  const _E4 = _E ** 4;
  
  const x = easting - 500000.0;
  const y = northing;
  const m = y / K0;
  const mu = m / (A * (1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256));
  
  const fp = (mu + (3 * _E / 2 - 27 * _E3 / 32) * Math.sin(2 * mu)
    + (21 * _E2 / 16 - 55 * _E4 / 32) * Math.sin(4 * mu)
    + (151 * _E3 / 96) * Math.sin(6 * mu) + (1097 * _E4 / 512) * Math.sin(8 * mu));
    
  const sf = Math.sin(fp);
  const cf = Math.cos(fp);
  const tf = sf / cf;
  const T = tf ** 2;
  const C = E_P2 * cf ** 2;
  const N = A / Math.sqrt(1 - E * sf ** 2);
  const R = A * (1 - E) / (1 - E * sf ** 2) ** 1.5;
  
  const D = x / (N * K0);
  const D2 = D ** 2;
  const D3 = D ** 3;
  const D4 = D ** 4;
  const D5 = D ** 5;
  const D6 = D ** 6;
  
  const lat = fp - (N * tf / R) * (D2 / 2 - D4 / 24 * (5 + 3 * T + 10 * C - 4 * C ** 2 - 9 * E_P2)
    + D6 / 720 * (61 + 90 * T + 298 * C + 45 * T ** 2 - 252 * E_P2 - 3 * C ** 2));
    
  // Zone 47 offset (+99 deg)
  const lon = (D - D3 / 6 * (1 + 2 * T + C) + D5 / 120 * (5 - 2 * C + 28 * T - 3 * C ** 2 + 8 * E_P2 + 24 * T ** 2)) / cf;
  
  return {
    lat: parseFloat((lat * 180 / Math.PI).toFixed(6)),
    lng: parseFloat(((lon * 180 / Math.PI) + 99).toFixed(6))
  };
}
