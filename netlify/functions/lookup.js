exports.handler = async (event) => {
  console.log('Function called, method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = JSON.parse(event.body || '{}');
  const isCoach = body.mode === 'coach';
  const input = body.food;
  
  console.log('Input received:', input ? input.substring(0, 50) : 'none');
  console.log('API key present:', !!process.env.ANTHROPIC_API_KEY);
  console.log('API key prefix:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) : 'missing');

  if (!input) {
    return { statusCode: 400, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ error: 'Missing input' }) };
  }

  const prompt = isCoach
    ? input
    : `You are a nutrition database. Return ONLY this JSON with estimated values for the food described, no other text:
{"name":"short name","cal":0,"prot":0,"carb":0,"fib":0,"fat":0,"sugar":0,"sodium":0,"satfat":0,"pot":0,"calcium":0,"iron":0,"mag":0,"vitc":0,"vitd":0,"omega3":0,"b12":0,"zinc":0,"folate":0,"selenium":0}
Food: ${input}`;

  try {
    console.log('Calling Anthropic API...');
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

    console.log('Anthropic response status:', response.status);
    const data = await response.json();
    console.log('Anthropic response type:', data.type);
    
    if (data.error) {
      console.log('Anthropic error:', JSON.stringify(data.error));
      return { statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ error: data.error.message }) };
    }

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    console.log('Response text preview:', text.substring(0, 100));

    if (isCoach) {
      return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ response: text }) };
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in response');

    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: match[0] };
  } catch (e) {
    console.log('Error:', e.message);
    return { statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ error: e.message }) };
  }
};
