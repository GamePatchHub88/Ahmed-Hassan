// Vercel Serverless Function — POST /api/summarize
// Proxies a request to the Anthropic API to summarize an article, keeping the
// API key on the server only (never expose ANTHROPIC_API_KEY to the browser).
//
// Setup:
// 1) Add this file at /api/summarize.js in your Vercel project root (same repo as index.html).
// 2) In the Vercel dashboard -> Project -> Settings -> Environment Variables, add:
//      ANTHROPIC_API_KEY = <your key from https://console.anthropic.com>
// 3) Redeploy.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { content } = req.body || {};
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Missing "content" in request body' });
      return;
    }

    const plainText = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    if (!plainText) {
      res.status(400).json({ error: 'Article content is empty' });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              'لخّص المقال التقني التالي في 3 إلى 4 جمل بالعربية الفصحى الواضحة، بأسلوب مباشر بدون مقدمات ولا تكرار لعنوان المقال:\n\n' +
              plainText
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || 'Anthropic API error' });
      return;
    }

    const summary = (data.content || []).find((b) => b.type === 'text')?.text || '';
    if (!summary) {
      res.status(502).json({ error: 'AI did not return a summary' });
      return;
    }

    res.status(200).json({ summary: summary.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
};
