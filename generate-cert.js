// Script to generate self-signed SSL certificate for HTTPS development
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'ssl');
const keyFile = path.join(certDir, 'server.key');
const certFile = path.join(certDir, 'server.cert');

// Create ssl directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir);
  console.log('✅ Created ssl/ directory');
}

// Check if certificate already exists
if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  console.log('✅ SSL certificate already exists:');
  console.log(`   - ${keyFile}`);
  console.log(`   - ${certFile}`);
  console.log('\n💡 To regenerate, delete the ssl/ folder and run this script again.');
  process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificate...\n');

try {
  // Try using OpenSSL command (works if OpenSSL is installed)
  // Generate certificate with Subject Alternative Names for multiple domains
  const configFile = path.join(certDir, 'openssl.cnf');
  const configContent = `
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=ID
ST=Jakarta
L=Jakarta
O=TWINLOGY IDN
OU=Development
CN=twinlogy-idn.local

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = twinlogy-idn.local
DNS.3 = www.twinlogy-idn.local
DNS.4 = twinlogy-idn.com
DNS.5 = www.twinlogy-idn.com
IP.1 = 127.0.0.1
IP.2 = ::1
`;
  
  fs.writeFileSync(configFile, configContent);
  
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -config "${configFile}" -extensions v3_req`;
  
  execSync(command, { stdio: 'inherit' });
  
  // Clean up config file
  fs.unlinkSync(configFile);
  
  console.log('\n✅ SSL certificate generated successfully!');
  console.log(`   - Private Key: ${keyFile}`);
  console.log(`   - Certificate: ${certFile}`);
  console.log('\n🌐 Supported domains:');
  console.log('   • localhost');
  console.log('   • twinlogy-idn.local');
  console.log('   • twinlogy-idn.com');
  console.log('\n🚀 You can now run the server with HTTPS support.');
  console.log('   Run: npm run start');
  
} catch (err) {
  console.error('\n❌ OpenSSL not found. Using alternative method...\n');
  
  // Fallback: Use selfsigned npm package
  try {
    // Check if selfsigned is installed
    let selfsigned;
    try {
      selfsigned = require('selfsigned');
    } catch {
      console.log('📦 Installing selfsigned package...');
      execSync('npm install selfsigned', { stdio: 'inherit' });
      selfsigned = require('selfsigned');
    }
    
    const attrs = [
      { name: 'commonName', value: 'twinlogy-idn.local' },
      { name: 'countryName', value: 'ID' },
      { name: 'stateOrProvinceName', value: 'Jakarta' },
      { name: 'localityName', value: 'Jakarta' },
      { name: 'organizationName', value: 'TWINLOGY IDN' },
      { name: 'organizationalUnitName', value: 'Development' }
    ];
    
    const extensions = [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: 'twinlogy-idn.local' },
          { type: 2, value: 'www.twinlogy-idn.local' },
          { type: 2, value: 'twinlogy-idn.com' },
          { type: 2, value: 'www.twinlogy-idn.com' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ];
    
    const pems = selfsigned.generate(attrs, { 
      days: 365, 
      keySize: 2048,
      extensions: extensions
    });
    
    fs.writeFileSync(keyFile, pems.private);
    fs.writeFileSync(certFile, pems.cert);
    
    console.log('\n✅ SSL certificate generated successfully!');
    console.log(`   - Private Key: ${keyFile}`);
    console.log(`   - Certificate: ${certFile}`);
    console.log('\n🌐 Supported domains:');
    console.log('   • localhost');
    console.log('   • twinlogy-idn.local');
    console.log('   • twinlogy-idn.com');
    console.log('\n🚀 You can now run the server with HTTPS support.');
    console.log('   Run: npm run start');
    
  } catch (fallbackErr) {
    console.error('\n❌ Failed to generate certificate:', fallbackErr.message);
    process.exit(1);
  }
}
