// api/ai-writer.js
// Deploy this file inside an "api" folder at the root of your Vercel project
// (same level as index.html). Vercel automatically turns it into a serverless
// endpoint reachable at: https://your-site.vercel.app/api/ai-writer
//
// SETUP:
// 1. In your Vercel project dashboard → Settings → Environment Variables,
//    add: ANTHROPIC_API_KEY = sk-ant-xxxxxxxx  (get one from console.anthropic.com)
// 2. Redeploy the project after adding the variable.
// 3. The "Write Full Article with AI" button in your admin panel will then work.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic } = req.body || {};
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing "topic" in request body.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY environment variable.' });
  }

  const systemPrompt = `You are a technical writer for an Arabic/English developer blog called "Ah Stack".
Given a topic, write a complete, well-structured article.
Respond ONLY with a single valid JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "title": "a compelling article title",
  "excerpt": "a 1-2 sentence summary, under 160 characters",
  "content": "the full article body as clean semantic HTML using <h2>, <h3>, <p>, <ul>/<li>, <blockquote>, and <strong> tags where appropriate. Do not include <html>, <head>, or <body> tags — just the inner content."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Write a full article about: ${topic}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // Strip accidental markdown code fences if the model added them anyway
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: 'Could not parse AI response as JSON.', raw: rawText });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error.' });
  }
}
