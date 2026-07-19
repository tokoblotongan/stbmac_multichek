// ============================================================
//  API PROXY - Vercel Serverless Function
//  Dengan retry mechanism dan timeout handling
// ============================================================

// Store sessions per MAC
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
        const { url, mac, token, cookie } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }
        
        const targetUrl = decodeURIComponent(url);
        
        // ==========================================================
        //  SESSION MANAGEMENT
        // ==========================================================
        const sessionKey = mac || 'default';
        
        if (!sessionStore.has(sessionKey)) {
            sessionStore.set(sessionKey, {
                cookies: {},
                headers: {},
                token: null
            });
        }
        
        const session = sessionStore.get(sessionKey);
        
        // ==========================================================
        //  BUILD HEADERS
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
        //  TAMBAHKAN COOKIE
        // ==========================================================
        if (cookie) {
            headers['Cookie'] = decodeURIComponent(cookie);
        } else if (mac) {
            const baseCookies = {
                'mac': mac,
                'stb_lang': 'en',
                'timezone': 'Europe/Amsterdam'
            };
            const allCookies = { ...baseCookies, ...session.cookies };
            const cookieString = Object.entries(allCookies)
                .map(([key, value]) => `${key}=${value}`)
                .join('; ');
            headers['Cookie'] = cookieString;
        }
        
        // ==========================================================
        //  TAMBAHKAN TOKEN
        // ==========================================================
        if (token) {
            session.token = token;
        }
        
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
        //  FETCH DENGAN RETRY
        // ==========================================================
        let lastError = null;
        let retries = 3;
        let response = null;
        
        while (retries > 0) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                response = await fetch(targetUrl, {
                    method: req.method || 'GET',
                    headers: headers,
                    signal: controller.signal,
                    redirect: 'follow'
                });
                
                clearTimeout(timeoutId);
                
                // Jika berhasil, keluar dari loop
                if (response.ok || response.status === 206 || response.status === 302 || response.status === 301) {
                    break;
                }
                
                // Jika status 5xx, retry
                if (response.status >= 500) {
                    console.log(`🔄 Retry ${retries-1} left, status: ${response.status}`);
                    retries--;
                    if (retries === 0) break;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                // Status lain, keluar
                break;
                
            } catch (error) {
                lastError = error;
                console.log(`🔄 Retry ${retries-1} left, error: ${error.message}`);
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (!response) {
            throw new Error('No response after retries');
        }
        
        // ==========================================================
        //  SIMPAN COOKIE DARI RESPONSE
        // ==========================================================
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            const cookieParts = setCookie.split(';');
            const nameValue = cookieParts[0].trim();
            if (nameValue.includes('=')) {
                const [key, value] = nameValue.split('=');
                session.cookies[key.trim()] = value.trim();
            }
        }
        
        // ==========================================================
        //  SIMPAN TOKEN DARI RESPONSE
        // ==========================================================
        const data = await response.text();
        
        try {
            const jsonData = JSON.parse(data);
            let tokenFound = null;
            
            if (jsonData?.js?.token) {
                tokenFound = jsonData.js.token;
            } else if (jsonData?.token) {
                tokenFound = jsonData.token;
            }
            
            if (tokenFound) {
                session.token = tokenFound;
                console.log('🔑 TOKEN SAVED:', tokenFound.substring(0, 20) + '...');
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
                error: 'Request timeout (30s)'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
