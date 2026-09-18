# Kapasitas — Ilham

Dashboard pemantauan kapasitas fisik yang menarik aktivitas langsung dari Strava.

```
index.html           halaman dashboard
api/_strava.js       penukar refresh token → access token
api/activities.js    daftar aktivitas
api/stats.js         total sepanjang waktu dan 4 minggu terakhir
api/setup.js         halaman sekali pakai untuk memberi izin Strava
api/_ai.js           konteks singkat + panggilan OpenRouter (DeepSeek)
api/rekomendasi.js   dua-tiga rekomendasi minggu ini berbasis AI
api/tanya-ai.js     fitur "Tanya AI" — jawab pertanyaan pelatihan
vercel.json          konfigurasi
package.json         menandai proyek sebagai ES module
.env.example         daftar environment variable
```

---

## Langkah penyiapan

### 1. Lengkapi aplikasi Strava

Buka [strava.com/settings/api](https://www.strava.com/settings/api). Client ID sudah ada: **274816**. Salin juga **Client Secret** dari halaman yang sama — jangan tulis di berkas mana pun yang masuk ke Git.

**Authorization Callback Domain** diisi nanti setelah tahu alamat Vercel, di langkah 4.

### 2. Unggah ke GitHub

Buat repositori baru, unggah seluruh isi folder ini. Berkas `.gitignore` sudah menahan `.env` agar tidak ikut terkirim.

### 3. Hubungkan ke Vercel

Buka [vercel.com/new](https://vercel.com/new), pilih repositori tadi.

- Framework Preset: **Other**
- Build Command: kosongkan
- Output Directory: kosongkan

Sebelum menekan Deploy, buka bagian Environment Variables dan isi dua nilai:

| Nama | Nilai |
|---|---|
| `STRAVA_CLIENT_ID` | `274816` |
| `STRAVA_CLIENT_SECRET` | dari halaman API Strava |

Lalu Deploy.

### 4. Daftarkan domain di Strava

Setelah deploy selesai, Vercel memberi alamat seperti `kapasitas-ilham.vercel.app`.

Kembali ke halaman API Strava, isi **Authorization Callback Domain** dengan alamat itu — tanpa `https://`, tanpa garis miring di akhir. Simpan.

### 5. Beri izin sekali

Buka `https://alamat-kamu.vercel.app/api/setup`, tekan tombol, setujui di Strava.

Halaman akan menampilkan **refresh token**. Salin nilainya, lalu di Vercel tambahkan dua variable lagi:

| Nama | Nilai |
|---|---|
| `STRAVA_REFRESH_TOKEN` | hasil dari halaman setup |
| `SETUP_TERKUNCI` | `1` |

Buka tab Deployments, pilih deployment terakhir, tekan **Redeploy**.

Selesai. Dashboard akan menarik aktivitas otomatis.

### 6. Aktifkan Rekomendasi & Tanya AI (opsional)

Setelah Strava tersambung dan dashboard berjalan, tambahkan satu environment
variable agar kedua fitur AI aktif:

| Nama | Nilai |
|---|---|
| `OPENROUTER_API_KEY` | dari [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |

Opsional `AI_MODEL` bisa mengganti modelnya (default `deepseek/deepseek-chat`,
murah dan cocok untuk ringkasan pelatihan). Setelah menambahkan, tekan **Redeploy**.

Tanpa `OPENROUTER_API_KEY`, dashboard tetap berfungsi penuh: kolom "Fokus minggu
ini" memakai heuristik cadangan dan kolom "Tanya AI" menampilkan pesan bahwa
kunci belum diisi.

---

## Cara kerjanya

Refresh token tidak pernah kedaluwarsa. Setiap kali halaman memuat, fungsi serverless menukarnya menjadi access token berumur 6 jam, lalu memanggil Strava. Token hanya ada di sisi server — browser tidak pernah melihatnya.

Hasil disimpan di cache edge Vercel selama 15 menit. Halaman juga menyegarkan sendiri tiap 15 menit selama tab terbuka. Batas Strava 200 permintaan per 15 menit dan 2.000 per hari; pola ini jauh di bawahnya.

### Jenis olahraga

Strava mengirim `sport_type`, dipetakan di `api/activities.js`:

| Strava | Dashboard |
|---|---|
| Run | Lari |
| TrailRun | Trail |
| Ride, GravelRide, MountainBikeRide, VirtualRide, EBikeRide | Sepeda |
| Walk, Hike | Jalan santai |
| WeightTraining, Workout, Crossfit | Strength |
| Racquetball, Squash, Tennis, Pickleball | Padel |

Strava belum punya jenis Padel tersendiri. Kalau kamu mencatatnya sebagai jenis lain, tambahkan namanya ke objek `JENIS`.

---

## Angka yang masih manual

Strava tidak menyediakan data tidur dan komposisi tubuh. Empat penanda ini diisi di `index.html`, cari `const MANUAL=`:

```js
const MANUAL={
  vo2:42, hrIstirahat:55, hrv:63, lemak:33.8, otot:36.3
};
```

Perbarui setelah pengukuran BIA atau saat angka tidur berubah, lalu commit.

Sisanya dihitung sendiri dari data Strava:

- **HR lari santai** — rata-rata HR sesi lari berpace di atas 8:00/km dalam 60 hari terakhir
- **Skor kesiapan** — skor fisik, disesuaikan dengan jeda sejak sesi berat terakhir dan total jam latihan 7 hari
- **Fokus minggu ini** — dibangkitkan dari pola: HR lari di atas batas, jumlah sesi Jumat, jumlah sesi kekuatan

---

## Kalau ada yang tidak jalan

**Indikator di sidebar berwarna kuning, tulisan "Belum terhubung"**
`STRAVA_REFRESH_TOKEN` belum terisi atau deploy ulang belum dilakukan.

**Indikator merah**
Buka `https://alamat-kamu.vercel.app/api/activities` langsung di browser — pesan kesalahannya akan tampil di sana.

**Halaman setup menolak dengan "Kredensial belum diisi"**
`STRAVA_CLIENT_SECRET` belum tersimpan, atau deploy ulang belum dilakukan setelah menambahkannya.

**Strava menolak saat memberi izin**
Authorization Callback Domain tidak cocok. Harus persis nama host, contoh `kapasitas-ilham.vercel.app`.

---

## Langkah lanjutan

Saat ini siapa pun yang tahu alamatnya bisa melihat dashboard. Kalau perlu ditutup, dua pilihan paling ringan:

- **Vercel Authentication** — aktifkan di Settings, Deployment Protection. Hanya akun Vercel kamu yang bisa membuka.
- **Kata sandi sederhana** — satu middleware yang memeriksa cookie sebelum menyajikan halaman.

Untuk menyimpan data tidur dan BIA secara historis, langkah berikutnya adalah Vercel KV atau Postgres, keduanya masih gratis di paket Hobby.
