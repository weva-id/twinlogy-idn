# 🚀 TWINLOGY IDN - Quick Start Guide

## Setup Custom Domain (3 Steps!)

### Step 1: Setup Domain (Run as Admin)
Right-click PowerShell → "Run as Administrator"
```powershell
cd "C:\Users\wevaadmin\OneDrive\Dokumen\twin-ingest"
npm run setup-domain
```

### Step 2: Generate SSL Certificate
```powershell
npm run gen-cert
```

### Step 3: Start Server & Sensors
```powershell
# Terminal 1: Start server
npm run start

# Terminal 2: Start sensor simulator with HTTPS
npm run sensor:https
```

## 🌐 Access Dashboard

Open browser and visit:
```
https://twinlogy-idn.local:3443
```

Or:
```
https://twinlogy-idn.com:3443
```

**Browser Warning?** ⚠️
- Click "Advanced"
- Click "Proceed to twinlogy-idn.local"
- This is normal for self-signed certificates in development

---

## 🎯 What You Get

✅ Custom domain: `https://twinlogy-idn.local:3443`  
✅ HTTPS secured connection  
✅ Real-time sensor data from 31 cities  
✅ Interactive dashboard with maps & charts  
✅ Professional branding with TWINLOGY IDN logo  

---

## 📋 Available URLs

After setup, you can access via any of these:

- **Primary:** `https://twinlogy-idn.local:3443` ⭐
- **Alternative:** `https://twinlogy-idn.com:3443`
- **Fallback:** `https://localhost:3443`
- **HTTP (unsecured):** `http://localhost:3000`

---

## 🆘 Troubleshooting

### "Cannot access twinlogy-idn.local"
- Make sure you ran `npm run setup-domain` as Administrator
- Check `C:\Windows\System32\drivers\etc\hosts` - should have entries for twinlogy-idn.local

### "Your connection is not private"
- This is expected for self-signed certificates
- Click "Advanced" → "Proceed"
- For production, use real SSL certificate from Let's Encrypt

### "Server not running"
- Make sure you ran `npm run start`
- Check if ports 3000/3443 are free
- Look for error messages in console

---

## 📱 Features

- 📊 **Dashboard**: Real-time sensor data table
- 🗺️ **Map View**: Visualize sensors across Indonesia
- 📍 **Location Search**: Advanced search with autocomplete, geolocation, favorites
- 📈 **Statistics**: Charts and analytics
- 🔐 **HTTPS**: Secured with SSL

---

## ⚡ Quick Commands

```powershell
# Setup (run once)
npm install
npm run setup-domain  # as Admin
npm run gen-cert

# Daily use
npm run start         # Start server
npm run sensor        # Sensor with HTTP
npm run sensor:https  # Sensor with HTTPS (recommended)

# Development
npm run dev           # Server with development mode
```

---

**Made with 💙 by TWINLOGY IDN**  
Digital Twin Sensor Platform • 2025
