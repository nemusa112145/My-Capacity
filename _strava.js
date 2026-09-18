// Menukar refresh token menjadi access token.
// Access token Strava berlaku 6 jam; disimpan di memori instance
// supaya tidak menukar ulang setiap permintaan.

let cache = { token: null, kedaluwarsa: 0 };

export async function ambilAccessToken() {
  const sekarang = Math.floor(Date.now() / 1000);

  if (cache.token && cache.kedaluwarsa > sekarang + 120) {
    return cache.token;
  }

  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    const e = new Error('Environment variable Strava belum lengkap.');
    e.kode = 'ENV_KURANG';
    throw e;
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) {
    const teks = await res.text();
    const e = new Error('Gagal menukar refresh token: ' + res.status + ' ' + teks.slice(0, 200));
    e.kode = 'TOKEN_GAGAL';
    throw e;
  }

  const data = await res.json();
  cache = { token: data.access_token, kedaluwarsa: data.expires_at };
  return data.access_token;
}
