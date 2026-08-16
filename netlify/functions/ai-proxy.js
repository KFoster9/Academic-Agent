// Serverless proxy: keeps GROQ_API_KEY server-side (never sent to the browser)
// and translates between the app's request/response shape and Groq's
// OpenAI-compatible chat completions API, so App.jsx doesn't need to change
// its parsing logic (data.content[0].text) if the provider changes again later.

const GROQ_MODEL = 'openai/gpt-oss-120b';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: 'Method not allowed' } }) };
  }

  if (!process.env.GROQ_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: 'GROQ_API_KEY is not set in this site\'s environment variables.' } })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON body' } }) };
  }

  const { max_tokens, system, messages } = payload;

  const groqMessages = [];
  if (system) {
    groqMessages.push({ role: 'system', content: system });
  }
  if (Array.isArray(messages)) {
    groqMessages.push(...messages);
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: max_tokens || 1024,
        messages: groqMessages
      })
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      return {
        statusCode: groqRes.status,
        body: JSON.stringify({ error: { message: groqData.error?.message || 'Groq API error' } })
      };
    }

    const text = groqData.choices?.[0]?.message?.content || '';

    // Normalized to match the shape App.jsx already expects: data.content[0].text
    return {
      statusCode: 200,
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: 'Failed to reach Groq: ' + err.message } })
    };
  }
};
