// Konteks singkat + panggilan ke OpenRouter (model AI).
// Dipakai bersama oleh api/rekomendasi.js dan api/tanya-ai.js.
//
// Batasan nyata: fungsi serverless Vercel paket Hobby menghentikan eksekusi
// setelah ~10 detik. Konteks sengaja diringkas supaya hasil datang cepat,
// dan kita pakai AbortController agar panggilan nggak menggantung.
//
// Ketahanan: kalau model utama (default DeepSeek) 429 / lambat / timeout,
// kita otomatis jatuh ke model cadangan (default gpt-4o-mini, yang cepet & stabil.
// Anggaran waktu dibagi per-percobaan supaya satu model yang macet nggak
// menghabiskan seluruh jatah waktu.

const DEFAULT_MODELS = ['deepseek/deepseek-chat', 'openai/gpt-4o-mini'];
const DEADLINE_MS = 9500; // batas total nyata, di bawah 10 s limit Vercel

function daftarModel() {
  const dariEnv = (process.env.AI_MODEL || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const fallback = (process.env.AI_FALLBACK_MODEL || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const semua = dariEnv.concat(DEFAULT_MODELS).concat(fallback);
  return semua.filter((v, i, a) => v && a.indexOf(v) === i); // de-dup, urutan dipertahankan
}

// Konteks satu paragraf dari data yang sama dengan dashboard.
// Cuma data sungguhan dari Strava + pengukuran manual — tidak ada angka karangan.

export function ringkas(sesi, stats, manual) {
  if (typeof manual === 'string') {
    try { manual = JSON.parse(manual); } catch { manual = null; }
  }
  const bagian = [];
  if (stats) {
    if (stats.lari) {
      bagian.push('total lari ' + stats.lari.total_km + ' km dalam ' + stats.lari.total_sesi + ' sesi, 4 minggu terakhir ' +
        (stats.lari.empat_minggu_km || 0) + ' km / ' + (stats.lari.empat_minggu_jam || 0) + ' jam');
    }
    if (stats.sepeda) {
      bagian.push('total sepeda ' + stats.sepeda.total_km + ' km dalam ' + stats.sepeda.total_sesi + ' sesi');
    }
  }
  const sesiLanjut = (sesi || []).slice(0, 20);
  if (sesiLanjut.length) {
    const baris = sesiLanjut.map(s =>
      (s.tgl || '?') + ' ' + (s.nama || (s.asli || s.j)) +
      ((s.km ? ' ' + s.km + ' km' : '') || '') +
      (s.mnt ? ' / ' + s.mnt + ' mnt' : '') +
      (s.hr ? ' / HR ' + s.hr : '') +
      (s.hrm ? '-' + s.hrm : '')
    );
    bagian.push('aktivitas 20 terakhir:\n' + baris.join('\n'));
  }
  if (manual) {
    const mn = [];
    if (manual.vo2) mn.push('VO2max ' + manual.vo2);
    if (manual.hrv) mn.push('HRV ' + manual.hrv + ' ms');
    if (manual.lemak) mn.push('lemak tubuh ' + manual.lemak + '%');
    if (manual.otot) mn.push('massa otot ' + manual.otot + '%');
    if (manual.hrIstirahat) mn.push('HR istirahat ' + manual.hrIstirahat);
    if (mn.length) bagian.push('pengukuran manual: ' + mn.join(', '));
  }
  return bagian.join('\n') || 'Belum ada data aktivitas.';
}

// Panggil OpenRouter; coba model utama dulu, lalu jatuh ke cadangan kalau gagal./
// Return isi pesan model. Lempar Error berisi pesan terakhir kalau semua gagal./
export async function panggilAI(pesan, { json = false } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    const e = new Error('OPENROUTER_API_KEY belum diisi di Environment Variables Vercel.');
    e.kode = 'AI_ENV_KURANG';
    throw e;
  }

  const modelList = daftarModel();
  const tAwal = Date.now();
  const total = new AbortController();
  const totalTimer = setTimeout(() => total.abort(), DEADLINE_MS);
  let pesanTerakhir = null;

  try {
    for (const model of modelList) {
      // Anggaran: percobaan pertama (model utama) dapat 6 s, cadangan 4 s.
      const sisa = DEADLINE_MS - (Date.now() - tAwal);
      if (sisa < 1200) break;
      const jatah = Math.min(modelList[0] === model ? 6000 : 4000, sisa);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), jatah);
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
            'HTTP-Referer': process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://my-capacity.vercel.app'
          },
          body: JSON.stringify({
            model,
            response_format: json ? { type: 'json_object' } : undefined,
            messages: pesan
          }),
          signal: ctrl.signal
        });
        if (!r.ok) {
          const teks = await r.text();
          pesanTerakhir = new Error(model + ' ' + r.status + ': ' + teks.slice(0, 120));
          continue; // jatuh ke model cadangan
        }
        const d = await r.json();
        const isi = d.choices?.[0]?.message?.content ?? '';
        if (isi.trim()) return isi;
        pesanTerakhir = new Error(model + ' mengembalikan respons kosong.');
      } catch (e) {
        pesanTerakhir = new Error(model + ': ' + (e.name === 'AbortError' ? 'timeout ' + Math.round(jatah / 1000) + ' s' : e.message));
        if (total.signal.aborted) break;
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    clearTimeout(totalTimer);
  }

  throw pesanTerakhir || new Error('Semua model AI gagal balas.');
}