// ============================================================
//  API PROXY - Vercel Serverless Function
//  Dengan MAC sebagai query parameter
// ============================================================

export default async function handler(req, res) {
    // CORS HEADERS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, User-Agent, Referer');
    
    // HANDLE PREFLIGHT
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
        //  1. DEBUGGING - LOG REQUEST
        // ==========================================================
        console.log('================================');
        console.log('TARGET :', targetUrl);
        console.log('MAC    :', mac || '(none)');
        
        // ==========================================================
        //  2. BUILD HEADERS
        // ==========================================================
        const headers = {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'Accept': '*/*',
            'X-Requested-With': 'XMLHttpRequest'
        };
        
        // BUAT COOKIE DARI MAC (BUKAN DARI BROWSER)
        if (mac) {
            headers['Cookie'] = `mac=${mac}; stb_lang=en; timezone=Europe/Amsterdam`;
        }
        
        console.log('COOKIE :', headers['Cookie'] || '(none)');
        console.log('================================');
        
        // ==========================================================
        //  3. FORWARD ADDITIONAL HEADERS (jika ada)
        // ==========================================================
        if (req.headers['authorization']) {
            headers['Authorization'] = req.headers['authorization'];
        }
        if (req.headers['referer']) {
            headers['Referer'] = req.headers['referer'];
        }
        
        // ==========================================================
        //  4. FETCH DENGAN TIMEOUT
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
        //  5. RESPONSE
        // ==========================================================
        const data = await response.text();
        
        // DEBUGGING RESPONSE
        console.log('STATUS :', response.status);
        console.log('RESPONSE LENGTH:', data.length);
        console.log('RESPONSE PREVIEW:', data.substring(0, 200));
        console.log('================================');
        
        // Forward content type
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
