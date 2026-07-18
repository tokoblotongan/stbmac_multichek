// ============================================================
//  API PROXY - Vercel Serverless Function
//  Menerima mac dan token sebagai query parameter
//  Dengan logging lengkap untuk debugging
// ============================================================

export default async function handler(req, res) {
    // ==========================================================
    //  1. CORS HEADERS
    // ==========================================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, User-Agent, Referer, Cookie');
    
    // ==========================================================
    //  2. HANDLE PREFLIGHT (OPTIONS)
    // ==========================================================
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // ==========================================================
        //  3. AMBIL PARAMETER DARI QUERY
        // ==========================================================
        const { url, mac, token } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required',
                hint: 'Use: /api/proxy?url=https://example.com&mac=00:1A:79:XX:XX:XX&token=xyz'
            });
        }
        
        const targetUrl = decodeURIComponent(url);
        
        // ==========================================================
        //  4. DEBUGGING - LOG REQUEST
        // ==========================================================
        console.log('================================================');
        console.log('📤 PROXY REQUEST');
        console.log('TARGET URL :', targetUrl);
        console.log('MAC        :', mac || '(none)');
        console.log('TOKEN      :', token ? `${token.substring(0, 20)}...` : '(none)');
        console.log('METHOD     :', req.method || 'GET');
        console.log('------------------------------------------------');
        
        // ==========================================================
        //  5. BUILD HEADERS
        // ==========================================================
        const headers = {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'X-Requested-With': 'XMLHttpRequest'
        };
        
        // ==========================================================
        //  6. TAMBAHKAN COOKIE DARI MAC
        // ==========================================================
        if (mac) {
            headers['Cookie'] = `mac=${mac}; stb_lang=en; timezone=Europe/Amsterdam`;
            console.log('🍪 COOKIE SET :', headers['Cookie']);
        } else {
            console.log('🍪 COOKIE     : (none)');
        }
        
        // ==========================================================
        //  7. TAMBAHKAN AUTHORIZATION DARI TOKEN
        // ==========================================================
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('🔑 AUTH SET   : Bearer ' + token.substring(0, 20) + '...');
        } else {
            console.log('🔑 AUTH       : (none)');
        }
        
        // ==========================================================
        //  8. FORWARD ADDITIONAL HEADERS DARI CLIENT
        // ==========================================================
        if (req.headers['referer']) {
            headers['Referer'] = req.headers['referer'];
            console.log('↩️ REFERER    :', req.headers['referer']);
        }
        
        if (req.headers['authorization'] && !token) {
            headers['Authorization'] = req.headers['authorization'];
            console.log('🔑 AUTH (from client) :', req.headers['authorization'].substring(0, 30) + '...');
        }
        
        console.log('================================================');
        
        // ==========================================================
        //  9. FETCH DENGAN TIMEOUT
        // ==========================================================
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        console.log('⏳ Fetching...');
        const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: headers,
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
        // ==========================================================
        //  10. RESPONSE
        // ==========================================================
        const data = await response.text();
        
        // ==========================================================
        //  11. DEBUGGING - LOG RESPONSE
        // ==========================================================
        console.log('================================================');
        console.log('📥 PROXY RESPONSE');
        console.log('STATUS       :', response.status, response.statusText);
        console.log('CONTENT-TYPE :', response.headers.get('content-type') || '(none)');
        console.log('RESPONSE LEN :', data.length, 'bytes');
        console.log('RESPONSE PREV :', data.substring(0, 300) + (data.length > 300 ? '...' : ''));
        console.log('================================================');
        
        // ==========================================================
        //  12. FORWARD RESPONSE KE CLIENT
        // ==========================================================
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        // Forward set-cookie jika ada
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            res.setHeader('Set-Cookie', setCookie);
        }
        
        res.status(response.status).send(data);
        
    } catch (error) {
        // ==========================================================
        //  13. ERROR HANDLING
        // ==========================================================
        console.error('================================================');
        console.error('❌ PROXY ERROR');
        console.error('MESSAGE :', error.message);
        console.error('STACK   :', error.stack);
        console.error('================================================');
        
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
