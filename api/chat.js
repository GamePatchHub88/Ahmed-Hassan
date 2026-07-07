// Vercel Serverless Function — POST /api/chat
// Powers the "🤖 اسأل المدونة" floating chatbot. Client sends the question plus
// a short list of relevant articles (title + excerpt) it retrieved locally;
// this function asks Anthropic to answer strictly from that context.
//
// Setup: same as /api/summarize.js — requires ANTHROPIC_API_KEY env var on Vercel.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { question, context, history } = req.body || {};
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Missing "question" in request body' });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
      return;
    }

    const contextText = Array.isArray(context) && context.length
      ? context.map((p, i) => `[${i + 1}] ${p.title}\n${p.excerpt || ''}`).join('\n\n')
      : 'لا توجد مقالات ذات صلة واضحة بهذا السؤال.';

    const systemPrompt =
      'أنت مساعد ذكي يجيب نيابة عن مدونة "Ah Stack" التقنية للمهندس أحمد حسن. ' +
      'أجب فقط بالاعتماد على المقالات المرفقة أدناه. إن لم تكفِ المعلومات المتاحة للإجابة، ' +
      'صرّح بوضوح أن المدونة لا تغطي هذا الموضوع حالياً بدل اختلاق معلومات. ' +
      'أجب دائماً باللغة العربية، بإيجاز ووضوح، واذكر عنوان المقال المصدر بين قوسين عند الإمكان.\n\n' +
      'المقالات المتاحة كسياق:\n' + contextText;

    const messages = [
      ...(Array.isArray(history) ? history.slice(-12) : []),
      { role: 'user', content: question }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || 'Anthropic API error' });
      return;
    }

    const answer = (data.content || []).find((b) => b.type === 'text')?.text || '';
    if (!answer) {
      res.status(502).json({ error: 'AI did not return an answer' });
      return;
    }

    res.status(200).json({ answer: answer.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
};
