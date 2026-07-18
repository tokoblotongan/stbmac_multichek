// ============================================================
//  API PROXY - Vercel Serverless Function
//  Menghandle CORS dan forward request ke Stalker server
// ============================================================

export default async function handler(req, res) {
    // ==========================================================
    //  1. CORS HEADERS
    // ==========================================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With, User-Agent, Referer');
    
    // ==========================================================
    //  2. HANDLE PREFLIGHT (OPTIONS)
    // ==========================================================
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // ==========================================================
    //  3. VALIDASI URL
    // ==========================================================
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required',
                hint: 'Use: /api/proxy?url=https://example.com'
            });
        }
        
        const targetUrl = decodeURIComponent(url);
        
        // Validasi format URL
        try {
            new URL(targetUrl);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }
        
        // ==========================================================
        //  4. (OPTIONAL) WHITELIST DOMAIN - UNCOMMENT UNTUK PAKAI
        // ==========================================================
        // const allowedDomains = [
        //     'your-portal-domain.com',
        //     'iptv-server.com'
        // ];
        // const urlObj = new URL(targetUrl);
        // if (!allowedDomains.includes(urlObj.hostname)) {
        //     return res.status(403).json({
        //         success: false,
        //         error: 'Domain not allowed'
        //     });
        // }
        
        // ==========================================================
        //  5. PREPARE HEADERS
        // ==========================================================
        const headers = {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        };
        
        // Forward important headers dari client
        if (req.headers['cookie']) {
            headers['Cookie'] = req.headers['cookie'];
        }
        if (req.headers['authorization']) {
            headers['Authorization'] = req.headers['authorization'];
        }
        if (req.headers['referer']) {
            headers['Referer'] = req.headers['referer'];
        }
        
        // ==========================================================
        //  6. FETCH DENGAN TIMEOUT
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
        //  7. RESPONSE
        // ==========================================================
        const data = await response.text();
        
        // Forward content type
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        res.status(response.status).send(data);
        
    } catch (error) {
        // ==========================================================
        //  8. ERROR HANDLING
        // ==========================================================
        console.error('Proxy Error:', error.message);
        
        if (error.name === 'AbortError') {
            return res.status(504).json({
                success: false,
                error: 'Request timeout (15s)',
                hint: 'Server terlalu lambat merespon'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
