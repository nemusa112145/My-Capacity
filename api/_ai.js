// Konteks singkat + panggilan ke OpenRouter (DeepSeek).
// Dipakai bersama oleh api/rekomendasi.js dan api/tanya-ai.js.
//
// Batasan nyata: fungsi serverless Vercel paket Hobby menghentikan eksekusi
// setelah ~10 detik. Konteks sengaja diringkas supaya hasil datang cepat,
// dan kita pakai AbortController agar panggilan nggak menggantung.

const MODEL = process.env.AI_MODEL || 'deepseek/deepseek-chat';

// Konteks satu paragraf dari data yang sama dengan dashboard.
// Cuma data sungguhan dari Strava + pengukuran manual — tidak ada angka karangan.
export function ringkas(sesi, stats, manual) {
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

// Panggil OpenRouter; return isi pesan model. Lempar Error kalau gagal/timeout.
export async function panggilAI(pesan, { json = false } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    const e = new Error('OPENROUTER_API_KEY belum diisi di Environment Variables Vercel.');
    e.kode = 'AI_ENV_KURANG';
    throw e;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://my-capacity.vercel.app'
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: json ? { type: 'json_object' } : undefined,
        messages: pesan
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const teks = await r.text();
      throw new Error('OpenRouter ' + r.status + ': ' + teks.slice(0, 150));
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}