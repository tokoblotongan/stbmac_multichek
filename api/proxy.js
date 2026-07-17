// api/proxy.js - Version for Vercel
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With, User-Agent, Referer');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL parameter is required',
                hint: 'Use: /api/proxy?url=https://example.com'
            });
        }
        
        // Decode URL
        const targetUrl = decodeURIComponent(url);
        
        // Validate URL
        try {
            new URL(targetUrl);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        // Prepare headers
        const headers = {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
        };
        
        // Forward important headers
        if (req.headers['x-requested-with']) {
            headers['X-Requested-With'] = req.headers['x-requested-with'];
        }
        if (req.headers['cookie']) {
            headers['Cookie'] = req.headers['cookie'];
        }
        if (req.headers['authorization']) {
            headers['Authorization'] = req.headers['authorization'];
        }
        if (req.headers['referer']) {
            headers['Referer'] = req.headers['referer'];
        }
        
        // Fetch target URL
        const response = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: headers,
            redirect: 'follow'
        });
        
        // Get response data
        const data = await response.text();
        
        // Set response headers
        res.status(response.status);
        
        // Forward content type
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        // Send response
        res.send(data);
        
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({
            error: 'Proxy request failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
