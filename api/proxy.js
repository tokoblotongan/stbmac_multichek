// api/proxy.js
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter required' });
        }
        
        // Forward request ke Stalker server
        const response = await fetch(url, {
            method: req.method || 'GET',
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3',
                'X-Requested-With': req.headers['x-requested-with'] || 'XMLHttpRequest',
                'Referer': req.headers['referer'] || '',
                'Cookie': req.headers['cookie'] || '',
                'Authorization': req.headers['authorization'] || ''
            }
        });
        
        const data = await response.text();
        res.status(response.status).send(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
