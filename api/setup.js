// Halaman sekali pakai untuk mendapatkan refresh token.
//
//   /api/setup            → tombol ke halaman izin Strava
//   /api/setup?code=...   → menukar code menjadi refresh token dan menampilkannya
//
// Setelah refresh token disalin ke environment variable, hapus file ini
// atau setel SETUP_TERKUNCI=1 agar tidak bisa diakses lagi.

function halaman(isi) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hubungkan Strava</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#faf9f5;color:#1d1d1f;
display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;line-height:1.55}
.k{max-width:620px;width:100%;background:#fff;border:1px solid #e0e0e0;border-radius:18px;padding:32px}
h1{font-size:24px;font-weight:600;letter-spacing:-.5px;margin-bottom:8px}
p{font-size:15px;color:#333;margin-bottom:14px}
.b{display:inline-block;min-height:46px;padding:12px 22px;border-radius:9999px;background:#fc4c02;
color:#fff;font-size:16px;font-weight:600;text-decoration:none;margin-top:6px}
code{display:block;background:#f5f5f7;border:1px solid #e0e0e0;border-radius:10px;padding:14px 16px;
font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;margin:10px 0 18px;color:#1d1d1f}
ol{margin:0 0 6px 20px;font-size:15px;color:#333}li{margin-bottom:7px}
.w{background:#fff8ee;border:1px solid #f0d9b5;border-radius:11px;padding:14px 16px;font-size:14px;color:#6b4d16;margin-top:18px}
.e{background:#fdf2f2;border:1px solid #f0c9c9;border-radius:11px;padding:14px 16px;font-size:14px;color:#8a2020}
</style></head><body><div class="k">${isi}</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (process.env.SETUP_TERKUNCI === '1') {
    res.status(403).send(halaman('<h1>Halaman ditutup</h1><p>Penyiapan sudah selesai dan halaman ini dikunci.</p>'));
    return;
  }

  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    res.status(500).send(halaman(`<h1>Kredensial belum diisi</h1>
      <p>Tambahkan dua environment variable di dashboard Vercel, lalu deploy ulang:</p>
      <code>STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET</code>
      <p>Keduanya ada di <strong>strava.com/settings/api</strong>.</p>`));
    return;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirect = `${proto}://${host}/api/setup`;
  const { code, error } = req.query;

  if (error) {
    res.status(400).send(halaman(`<h1>Izin ditolak</h1>
      <div class="e">Strava mengembalikan: ${String(error).slice(0, 120)}</div>
      <p style="margin-top:16px">Coba lagi dan pastikan menekan Authorize.</p>
      <a class="b" href="/api/setup">Ulangi</a>`));
    return;
  }

  // Langkah 1 — arahkan ke halaman izin Strava.
  if (!code) {
    const auth = new URL('https://www.strava.com/oauth/authorize');
    auth.searchParams.set('client_id', STRAVA_CLIENT_ID);
    auth.searchParams.set('redirect_uri', redirect);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('approval_prompt', 'force');
    auth.searchParams.set('scope', 'read,activity:read_all,profile:read_all');

    res.status(200).send(halaman(`<h1>Hubungkan Strava</h1>
      <p>Satu langkah sekali seumur aplikasi. Setelah menekan tombol, Strava akan meminta izin membaca aktivitasmu.</p>
      <a class="b" href="${auth.toString()}">Beri izin di Strava</a>
      <div class="w">Pastikan <strong>Authorization Callback Domain</strong> di pengaturan API Strava berisi <strong>${host}</strong>, tanpa https dan tanpa garis miring.</div>`));
    return;
  }

  // Langkah 2 — tukar code menjadi refresh token.
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    const data = await r.json();

    if (!r.ok || !data.refresh_token) {
      res.status(502).send(halaman(`<h1>Penukaran gagal</h1>
        <div class="e">${String(data.message || JSON.stringify(data)).slice(0, 300)}</div>
        <p style="margin-top:16px">Periksa Client Secret, lalu ulangi.</p>
        <a class="b" href="/api/setup">Ulangi</a>`));
      return;
    }

    const nama = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ');

    res.status(200).send(halaman(`<h1>Berhasil terhubung</h1>
      <p>Akun Strava${nama ? ' <strong>' + nama + '</strong>' : ''} sudah memberi izin. Salin nilai di bawah ini:</p>
      <code>${data.refresh_token}</code>
      <ol>
        <li>Buka dashboard Vercel, pilih proyek ini.</li>
        <li>Masuk ke Settings, lalu Environment Variables.</li>
        <li>Tambahkan <strong>STRAVA_REFRESH_TOKEN</strong> dengan nilai di atas.</li>
        <li>Tambahkan juga <strong>SETUP_TERKUNCI</strong> bernilai <strong>1</strong>.</li>
        <li>Buka tab Deployments, pilih deployment terakhir, tekan Redeploy.</li>
      </ol>
      <div class="w">Refresh token ini setara kunci akun. Jangan dibagikan atau ditulis di dalam berkas yang masuk ke repositori.</div>`));
  } catch (e) {
    res.status(500).send(halaman(`<h1>Terjadi kesalahan</h1>
      <div class="e">${String(e.message).slice(0, 300)}</div>`));
  }
}
