// ============================================================
//  API PROXY - Vercel Serverless Function
//  DENGAN SESSION MANAGEMENT (seperti Python requests.Session)
// ============================================================

// Store sessions per MAC
// NOTE: Ini menggunakan memory, untuk production gunakan Redis
const sessionStore = new Map();

export default async function handler(req, res) {
    // CORS HEADERS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, User-Agent, Referer, Cookie');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { url, mac } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }
        
        const targetUrl = decodeURIComponent(url);
        
        // ==========================================================
        //  SESSION MANAGEMENT (seperti Python requests.Session)
        // ==========================================================
        const sessionKey = mac || 'default';
        
        // Ambil atau buat session untuk MAC ini
        if (!sessionStore.has(sessionKey)) {
            sessionStore.set(sessionKey, {
                cookies: {},
                headers: {},
                token: null
            });
        }
        
        const session = sessionStore.get(sessionKey);
        
        // ==========================================================
        //  DETEKSI TOKEN DARI RESPONSE (untuk disimpan)
        // ==========================================================
        // Jika ini adalah request handshake, kita akan simpan token dari response
        
        // ==========================================================
        //  BUILD HEADERS (seperti Python)
        // ==========================================================
        const headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Referer': targetUrl.replace(/portal\.php.*$/, 'portal.php')
        };
        
        // ==========================================================
        //  TAMBAHKAN COOKIE DARI SESSION (seperti Python)
        // ==========================================================
        if (mac) {
            // Cookie dasar (seperti di Python make_session)
            const baseCookies = {
                'mac': mac,
                'stb_lang': 'en',
                'timezone': 'Europe/Amsterdam'
            };
            
            // Gabungkan dengan cookie yang tersimpan di session
            const allCookies = { ...baseCookies, ...session.cookies };
            
            // Convert ke string
            const cookieString = Object.entries(allCookies)
                .map(([key, value]) => `${key}=${value}`)
                .join('; ');
            
            headers['Cookie'] = cookieString;
        }
        
        // ==========================================================
        //  TAMBAHKAN TOKEN KE HEADER (seperti Python)
        // ==========================================================
        // Jika session punya token, tambahkan ke header
        if (session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        
        // ==========================================================
        //  LOGGING
        // ==========================================================
        console.log('================================================');
        console.log('📤 PROXY REQUEST');
        console.log('TARGET :', targetUrl);
        console.log('MAC    :', mac || '(none)');
        console.log('TOKEN  :', session.token ? `${session.token.substring(0, 20)}...` : '(none)');
        console.log('COOKIE :', headers['Cookie'] || '(none)');
        console.log('AUTH   :', headers['Authorization'] ? 'Bearer ***' : '(none)');
        console.log('================================================');
        
        // ==========================================================
        //  FETCH
        // ==========================================================
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: headers,
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
        // ==========================================================
        //  SIMPAN COOKIE DARI RESPONSE (seperti Python)
        // ==========================================================
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            // Parse set-cookie header
            const cookieParts = setCookie.split(';');
            const nameValue = cookieParts[0].trim();
            if (nameValue.includes('=')) {
                const [key, value] = nameValue.split('=');
                session.cookies[key.trim()] = value.trim();
            }
        }
        
        // ==========================================================
        //  SIMPAN TOKEN DARI RESPONSE (jika handshake)
        // ==========================================================
        const data = await response.text();
        
        // Coba parse JSON untuk ambil token
        try {
            const jsonData = JSON.parse(data);
            let token = null;
            
            // Cek berbagai format token
            if (jsonData?.js?.token) {
                token = jsonData.js.token;
            } else if (jsonData?.token) {
                token = jsonData.token;
            }
            
            if (token) {
                session.token = token;
                console.log('🔑 TOKEN SAVED:', token.substring(0, 20) + '...');
            }
        } catch (e) {
            // Bukan JSON atau tidak ada token
        }
        
        // ==========================================================
        //  RESPONSE
        // ==========================================================
        console.log('📥 RESPONSE STATUS:', response.status);
        console.log('📥 RESPONSE LEN :', data.length);
        console.log('================================================');
        
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        res.status(response.status).send(data);
        
    } catch (error) {
        console.error('PROXY ERROR:', error.message);
        
        if (error.name === 'AbortError') {
            return res.status(504).json({
                success: false,
                error: 'Request timeout (15s)'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
