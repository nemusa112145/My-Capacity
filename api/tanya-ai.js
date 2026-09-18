// Fitur "Tanya AI": lu tanya soal pelatihan/kapasitas, AI jawab pakai konteks
// data lu yang sama dengan dashboard (sesi Strava + pengukuran manual).
//
// POST dengan body {pesan, sesi, stats, manual, riwayat?}
//   riwayat: array opsional [{role:'user'|'assistant', content}] utk chat memori
import { ringkas, panggilAI } from './_ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Gunakan POST dengan body JSON {pesan, sesi, stats, manual}.' });
    return;
  }

  const { pesan, sesi = [], stats = null, manual = null, riwayat = [] } = req.body || {};

  if (!pesan || typeof pesan !== 'string') {
    res.status(400).json({ error: 'Body wajib memuat field "pesan" (string).' });
    return;
  }
  if (pesan.length > 2000) {
    res.status(400).json({ error: 'Pesan terlalu panjang (maks 2000 karakter).' });
    return;
  }

  const konteks = ringkas(sesi, stats, manual);

  const sistem =
    'Kamu adalah asisten kebugaran pribadi dalam Bahasa Indonesia santai untuk dashboard kapasitas fisik seorang engineer tambang di Kalimantan. ' +
    'Jawab pertanyaan dengan ringkas (3-6 kalimat), berpijak pada data berikut. ' +
    'Aturan: (1) jangan mengarang angka — kalau tidak ada di konteks, bilang tidak tersedia dan tawarkan cara mengukurnya; ' +
    '(2) kalau pertanyaan menyangkut kesehatan parah, sarankan ke dokter; ' +
    '(3) hindari hiasan kosong, langsung ke inti yang actionable.';

  const dataBlock =
    'Data saya (dari Strava + pengukuran manual):\n' + konteks;

  const messages = [{ role: 'system', content: sistem }, { role: 'user', content: dataBlock }];
  const historis = (riwayat || []).slice(-10).filter(m => m && ['user', 'assistant'].includes(m.role));
  if (historis.length) messages.push({ role: 'user', content: 'Berikut percakapan sebelumnya (konteks di atas tetap berlaku):' });
  for (const h of historis) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: 'Pertanyaan saya: ' + pesan });

  try {
    const jawaban = await panggilAI(messages, { json: false });
    res.status(200).json({ jawaban: (jawaban || '').trim(), model: process.env.AI_MODEL || 'deepseek/deepseek-chat' });
  } catch (e) {
    const status = e.kode === 'AI_ENV_KURANG' ? 500 : 502;
    res.status(status).json({ error: e.message, kode: e.kode || 'GAGAL' });
  }
}