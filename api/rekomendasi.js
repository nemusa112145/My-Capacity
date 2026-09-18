// AI rekomendasi: 2-3 poin saran minggu ini yang grounded pada data sungguhan
// dari dashboard (aktivitas Strava + pengukuran manual), bukan heuristik kaku.
//
// Frontend mengirim {sesi, stats, manual} — data yang SAMA dengan yang
// ditampilkan di dashboard. Endpoint ini hanya menambah narasi AI.
// Kalau AI gagal/timeout/modal-nya belum diisi, frontend memanfaatkan
// heuristik yang sudah ada sebagai cadangan.
import { ringkas, panggilAI } from './_ai.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=43200');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Gunakan POST dengan body JSON {sesi, stats, manual}.' });
    return;
  }

  const { sesi = [], stats = null, manual = null } = req.body || {};

  const konteks = ringkas(sesi, stats, manual);

  const sistem =
    'Kamu adalah asisten kebugaran yang menulis dalam Bahasa Indonesia santai untuk dashboard kapasitas fisik seorang engineer tambang di Kalimantan. ' +
    'Berdasarkan data aktivitas berikut, beri 2 sampai 3 rekomendasi fokus minggu ini yang SINGKAT dan NYATA. ' +
    'Aturan keras: (1) jangan jadi komentar kosong — setiap saran harus berpijak pada angka yang ada di konteks; ' +
    '(2) jangan mengarang angka atau menyebut data yang tidak ada di konteks; ' +
    '(3) kalau konteks hanya punya data lari dan sepeda, jangan menyarankan hal yang butuh data tidur/kekuatan secara spesifik kecuali berupa ' +
    'pertanyaan lanjutan; ' +
    '(4) bila ada sinyal bahaya (misal HR jalan santai terus di atas normal, atau jeda sangat lama tanpa latihan), ungkapkan dengan hati-hati ' +
    'dan sarankan pemulihan. ' +
    'Jawab HANYA dengan JSON satu objek berformat: {"rekomendasi":[{"judul":"...","isi":"..."}]}';

  const pengguna =
    'Data saya (dari Strava + pengukuran manual):\n' +
    konteks +
    '\n\nFokus minggu ini apa yang paling bermakna untuk saya?';

  try {
    const isi = await panggilAI(
      [
        { role: 'system', content: sistem },
        { role: 'user', content: pengguna }
      ],
      { json: true }
    );

    let data = null;
    try {
      data = JSON.parse(isi);
    } catch {
      const cocok = isi.match(/\{[\s\S]*\}/);
      if (cocok) data = JSON.parse(cocok[0]);
    }

    const rekomendasi = (data && Array.isArray(data.rekomendasi) ? data.rekomendasi : [])
      .filter(r => r && r.judul && r.isi)
      .slice(0, 3)
      .map(r => ({ judul: String(r.judul).slice(0, 120), isi: String(r.isi).slice(0, 1000) }));

    if (!rekomendasi.length) throw new Error('AI tidak mengembalikan rekomendasi yang valid.');

    res.status(200).json({ rekomendasi, model: process.env.AI_MODEL || 'deepseek/deepseek-chat' });
  } catch (e) {
    const status = e.kode === 'AI_ENV_KURANG' ? 500 : 502;
    res.status(status).json({ error: e.message, kode: e.kode || 'GAGAL' });
  }
}