// api/proxy.js
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }
        
        // Forward request ke Stalker server
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3',
                'X-Requested-With': 'XMLHttpRequest',
                ...req.headers
            }
        });
        
        const data = await response.text();
        res.status(response.status).send(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
