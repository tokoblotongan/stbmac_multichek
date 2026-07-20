// ============================================================
//  API PROXY - Vercel Serverless Function
//  STATELESS - Semua data dikirim dari client
// ============================================================

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
        //  BUILD HEADERS - SEMUA DARI CLIENT
        // ==========================================================
        const headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Referer': targetUrl.replace(/portal\.php.*$/, 'c/')
        };
        
        // ==========================================================
        //  COOKIE DARI CLIENT
        // ==========================================================
        if (cookie) {
            headers['Cookie'] = decodeURIComponent(cookie);
        } else if (mac) {
            headers['Cookie'] = `mac=${mac}; stb_lang=en; timezone=Europe%2FAmsterdam`;
        }
        
        // ==========================================================
        //  TOKEN DARI CLIENT
        // ==========================================================
        if (token && token !== 'authenticated') {
            headers['Authorization'] = `Bearer ${decodeURIComponent(token)}`;
        }
        
        // ==========================================================
        //  LOGGING
        // ==========================================================
        console.log('================================================');
        console.log('📤 PROXY REQUEST');
        console.log('TARGET :', targetUrl);
        console.log('MAC    :', mac || '(none)');
        console.log('TOKEN  :', token ? `${token.substring(0, 20)}...` : '(none)');
        console.log('COOKIE :', headers['Cookie'] ? headers['Cookie'].substring(0, 60) + '...' : '(none)');
        console.log('AUTH   :', headers['Authorization'] ? 'Bearer ***' : '(none)');
        console.log('================================================');
        
        // ==========================================================
        //  FETCH DENGAN TIMEOUT 25 DETIK
        // ==========================================================
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        
        const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: headers,
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
        // ==========================================================
        //  SIMPAN COOKIE RESPONSE UNTUK CLIENT
        // ==========================================================
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            res.setHeader('X-Set-Cookie', setCookie);
        }
        
        // ==========================================================
        //  RESPONSE
        // ==========================================================
        const data = await response.text();
        
        // Log token dari response
        try {
            const json = JSON.parse(data);
            if (json?.js?.token) {
                console.log('🔑 TOKEN FOUND in response:', json.js.token.substring(0, 20) + '...');
            }
        } catch (e) {
            // Bukan JSON
        }
        
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
                error: 'Request timeout (25s)'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
