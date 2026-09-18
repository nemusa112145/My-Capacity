import { ambilAccessToken } from './_strava.js';

// Ringkasan total dari Strava: jarak sepanjang waktu dan 4 minggu terakhir.
export default async function handler(req, res) {
  try {
    const token = await ambilAccessToken();
    const h = { Authorization: 'Bearer ' + token };

    const ra = await fetch('https://www.strava.com/api/v3/athlete', { headers: h });
    if (!ra.ok) {
      res.status(ra.status).json({ error: 'Gagal mengambil profil atlet.' });
      return;
    }
    const atlet = await ra.json();

    const rs = await fetch('https://www.strava.com/api/v3/athletes/' + atlet.id + '/stats', { headers: h });
    if (!rs.ok) {
      res.status(rs.status).json({ error: 'Gagal mengambil statistik atlet.' });
      return;
    }
    const s = await rs.json();

    const km = (v) => (v ? +(v / 1000).toFixed(1) : 0);
    const jam = (v) => (v ? +(v / 3600).toFixed(1) : 0);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    res.status(200).json({
      nama: [atlet.firstname, atlet.lastname].filter(Boolean).join(' '),
      kota: atlet.city || null,
      lari: {
        total_km: km(s.all_run_totals?.distance),
        total_sesi: s.all_run_totals?.count || 0,
        empat_minggu_km: km(s.recent_run_totals?.distance),
        empat_minggu_jam: jam(s.recent_run_totals?.moving_time)
      },
      sepeda: {
        total_km: km(s.all_ride_totals?.distance),
        total_sesi: s.all_ride_totals?.count || 0,
        empat_minggu_km: km(s.recent_ride_totals?.distance),
        empat_minggu_jam: jam(s.recent_ride_totals?.moving_time),
        terjauh_km: km(s.biggest_ride_distance)
      },
      naik_tertinggi_m: s.biggest_climb_elevation_gain ? Math.round(s.biggest_climb_elevation_gain) : null
    });
  } catch (e) {
    const status = e.kode === 'ENV_KURANG' ? 500 : 502;
    res.status(status).json({ error: e.message, kode: e.kode || 'GAGAL' });
  }
}
