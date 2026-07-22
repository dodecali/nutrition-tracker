exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = JSON.parse(event.body || '{}');
  const isCoach = body.mode === 'coach';
  const input = isCoach ? body.food : body.food;
  if (!input) return { statusCode: 400, body: JSON.stringify({ error: 'Missing input' }) };

  const prompt = isCoach
    ? input  // AI coach sends full context as prompt
    : `You are a nutrition database. Estimate combined nutrition for this food description (may include brand names, restaurants, or stores). Return ONLY a valid JSON object, no markdown, no extra text:
{"name":"short name max 40 chars","cal":0,"prot":0,"carb":0,"fib":0,"fat":0,"sugar":0,"sodium":0,"satfat":0,"pot":0,"calcium":0,"iron":0,"mag":0,"vitc":0,"vitd":0,"omega3":0,"b12":0,"zinc":0,"folate":0,"selenium":0}
All values are numbers. Units: cal=kcal, sodium/pot/calcium/mag/vitc=mg, iron/zinc=mg, vitd/b12/folate/selenium=mcg, rest=grams.
Food: ${input}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';

    if (isCoach) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: text })
      };
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: match[0]
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
