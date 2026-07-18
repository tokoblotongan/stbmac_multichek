// ============================================================
//  API PROXY - Vercel Serverless Function
//  Dengan Cookie Persistence
// ============================================================

// Store cookies per session (gunakan Map sederhana)
// NOTE: Ini hanya untuk demo, untuk production gunakan Redis atau database
const cookieStore = new Map();

export default async function handler(req, res) {
    // CORS HEADERS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With, User-Agent, Referer, Set-Cookie');
    
    // HANDLE PREFLIGHT
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }
        
        const targetUrl = decodeURIComponent(url);
        
        // Validasi URL
        try {
            new URL(targetUrl);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }
        
        // ==========================================================
        //  1. GET COOKIE DARI SESSION
        // ==========================================================
        // Gunakan MAC address sebagai session key (dikirim via cookie)
        const cookieHeader = req.headers['cookie'] || '';
        const macMatch = cookieHeader.match(/mac=([^;]+)/);
        const sessionKey = macMatch ? macMatch[1] : 'default';
        
        // Ambil cookie yang tersimpan
        let savedCookies = cookieStore.get(sessionKey) || '';
        
        // ==========================================================
        //  2. PREPARE HEADERS
        // ==========================================================
        const headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Referer': targetUrl.includes('portal.php') ? targetUrl.replace(/portal\.php.*$/, 'portal.php') : targetUrl
        };
        
        // Tambahkan cookie yang tersimpan
        if (savedCookies) {
            headers['Cookie'] = savedCookies;
        }
        
        // Tambahkan cookie dari request jika ada
        if (req.headers['cookie']) {
            headers['Cookie'] = headers['Cookie'] 
                ? `${headers['Cookie']}; ${req.headers['cookie']}`
                : req.headers['cookie'];
        }
        
        // ==========================================================
        //  3. FETCH DENGAN TIMEOUT
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
        //  4. SIMPAN COOKIE DARI RESPONSE
        // ==========================================================
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            // Parse dan simpan cookie
            const cookies = setCookie.split(',').map(c => c.trim());
            let newCookies = savedCookies;
            
            cookies.forEach(cookie => {
                const parts = cookie.split(';');
                const nameValue = parts[0];
                if (nameValue.includes('=')) {
                    // Hapus cookie lama dengan nama yang sama
                    const name = nameValue.split('=')[0];
                    newCookies = newCookies
                        .split('; ')
                        .filter(c => !c.startsWith(name + '='))
                        .join('; ');
                    newCookies = newCookies ? `${newCookies}; ${nameValue}` : nameValue;
                }
            });
            
            cookieStore.set(sessionKey, newCookies);
        }
        
        // ==========================================================
        //  5. RESPONSE
        // ==========================================================
        const data = await response.text();
        
        // Forward content type
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        // Forward set-cookie ke client
        if (setCookie) {
            res.setHeader('Set-Cookie', setCookie);
        }
        
        res.status(response.status).send(data);
        
    } catch (error) {
        console.error('Proxy Error:', error.message);
        
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
