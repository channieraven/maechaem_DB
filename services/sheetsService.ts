
import { API_URL } from '../constants';

export async function apiPost(payload: any) {
  const params = new URLSearchParams();
  params.append('payload', JSON.stringify(payload));
  const url = `${API_URL}?${params.toString()}`;
  
  // Using no-cors as Apps Script usually doesn't return CORS headers for redirects
  // This means we won't see the response body, but the write usually succeeds.
  try {
    await fetch(url, { mode: 'no-cors' });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function apiGet(sheetName: string) {
  try {
    const res = await fetch(`${API_URL}?sheet=${sheetName}`, {
      method: 'GET',
      mode: 'cors'
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const result = await res.json();
    return result;
  } catch (err: any) {
    throw new Error('Could not fetch data: ' + err.message);
  }
}
