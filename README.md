# 🌐 TWINLOGY IDN
## Digital Twin Sensor Platform • Secured with HTTPS

```markdown
TWINLOGY IDN - Digital Twin Sensor Platform

Platform sensor Digital Twin yang menunjukkan alur data real-time: sensor simulator -> backend (Express + HTTPS) -> dashboard frontend interaktif.

File yang dibuat:
- `server.js` - server Express dengan endpoint `/ingest` dan `/data`, serta static serving untuk folder `frontend/`
- `sensor.js` - skrip Node yang mengirim (POST) data sensor acak ke `/ingest` setiap 5 detik
- `frontend/index.html` + `frontend/script.js` - dashboard sederhana yang mem-poll endpoint `/data` setiap 5 detik
- `package.json` - mencantumkan `express` di dependencies dan beberapa script untuk start/sensor

Cara cepat menjalankan (PowerShell):

```powershell
cd 'C:\Users\wevaadmin\OneDrive\Dokumen\twin-ingest'
# pasang dependensi (jalankan sekali saja)
npm install

# jalankan server
npm run start

# di terminal lain jalankan sensor simulator
node sensor.js

# buka http://localhost:3000 di browser untuk melihat dashboard
```

Opsi jika ingin lebih cepat (tanpa memasang semua paket besar sekarang):
- Pasang hanya express: `npm install express`
- Atau tunda pemasangan dan jalankan development lokal; saya bisa bantu menyesuaikan jika perlu.

## 🔐 HTTPS Support dengan Custom Domain

Server mendukung HTTP dan HTTPS secara bersamaan (dual mode) dengan custom domain!

### 🌐 Option 1: Custom Domain (Recommended - More Professional!)

**Setup menggunakan domain: `twinlogy-idn.local` atau `twinlogy-idn.com`**

```powershell
# 1. Setup custom domain (butuh Administrator)
# Right-click PowerShell → "Run as Administrator"
npm run setup-domain
# atau: .\setup-domain.ps1

# 2. Generate SSL certificate (include custom domain)
npm run gen-cert

# 3. Jalankan server
npm run start

# 4. Akses via custom domain! 🎉
# https://twinlogy-idn.local:3443
# https://twinlogy-idn.com:3443

# 5. Sensor simulator dengan HTTPS
npm run sensor:https
```

**Supported Domains:**
- ✅ `https://twinlogy-idn.local:3443` (recommended)
- ✅ `https://twinlogy-idn.com:3443`
- ✅ `https://www.twinlogy-idn.local:3443`
- ✅ `https://www.twinlogy-idn.com:3443`
- ✅ `https://localhost:3443` (fallback)

### 🔧 Option 2: Localhost Only (Quick Setup)

```powershell
# 1. Generate SSL certificate
npm run gen-cert

# 2. Jalankan server
npm run start

# 3. Akses via localhost
# https://localhost:3443
```

**Ports:**
- 🌐 HTTP: `http://localhost:3000`
- 🔐 HTTPS: `https://localhost:3443` (atau custom domain)

**Note:** Browser akan menampilkan warning untuk self-signed certificate. Ini normal untuk development:
- Klik "Advanced" → "Proceed to twinlogy-idn.local" (atau localhost)

### Configuration (.env):

```env
HTTP_PORT=3000
HTTPS_PORT=3443
ENABLE_HTTPS=false  # optional, auto-detect jika cert tersedia
```

---

Langkah selanjutnya (opsional):
- Tambahkan fungsi hashing dan modul stub untuk integrasi DAG, Web3, dan AI ✅
- Simpan data ke database jika diperlukan ✅
- Tambahkan konfigurasi CORS dan autentikasi dasar untuk produksi ✅
- HTTPS support untuk production dengan Let's Encrypt

``` 
