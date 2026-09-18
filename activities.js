import { ambilAccessToken } from './_strava.js';

// Pemetaan jenis olahraga Strava ke istilah yang dipakai dashboard.
const JENIS = {
  Run: 'lari',
  TrailRun: 'trail',
  Ride: 'sepeda',
  VirtualRide: 'sepeda',
  GravelRide: 'sepeda',
  MountainBikeRide: 'sepeda',
  EBikeRide: 'sepeda',
  Walk: 'jalan',
  Hike: 'jalan',
  WeightTraining: 'strength',
  Workout: 'strength',
  Crossfit: 'strength',
  Racquetball: 'padel',
  Squash: 'padel',
  Tennis: 'padel',
  Pickleball: 'padel'
};

function petakan(a) {
  const jenis = JENIS[a.sport_type] || JENIS[a.type] || 'lainnya';
  const km = a.distance ? +(a.distance / 1000).toFixed(2) : null;
  const mnt = a.moving_time ? Math.round(a.moving_time / 60) : null;

  return {
    id: a.id,
    tgl: a.start_date_local ? a.start_date_local.slice(0, 10) : null,
    j: jenis,
    asli: a.sport_type || a.type,
    nama: a.name || '',
    km,
    mnt,
    hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    hrm: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    naik: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
    kal: a.calories ? Math.round(a.calories) : null,
    pr: a.pr_count || 0
  };
}

export default async function handler(req, res) {
  try {
    const token = await ambilAccessToken();

    const jumlah = Math.min(parseInt(req.query.n, 10) || 60, 200);
    const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=' + jumlah;

    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });

    if (r.status === 429) {
      res.status(429).json({ error: 'Batas permintaan Strava tercapai. Coba lagi dalam 15 menit.' });
      return;
    }
    if (!r.ok) {
      const teks = await r.text();
      res.status(r.status).json({ error: 'Strava menolak permintaan: ' + teks.slice(0, 200) });
      return;
    }

    const mentah = await r.json();
    const sesi = mentah.map(petakan).filter((s) => s.tgl);

    // Cache di edge Vercel 15 menit, boleh disajikan basi 1 jam sambil menyegarkan.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ diperbarui: new Date().toISOString(), jumlah: sesi.length, sesi });
  } catch (e) {
    const status = e.kode === 'ENV_KURANG' ? 500 : 502;
    res.status(status).json({ error: e.message, kode: e.kode || 'GAGAL' });
  }
}
