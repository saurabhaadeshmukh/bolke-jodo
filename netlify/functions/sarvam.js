// Bol Ke Jodo — Sarvam AI Secure Proxy
// This function runs on Netlify's server. The API key never reaches the browser.

exports.handler = async function(event) {

  // Handle CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'SARVAM_API_KEY not configured in Netlify environment variables.' })
    };
  }

  try {
    const { audio, mimeType } = JSON.parse(event.body);

    if (!audio) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No audio data received.' }) };
    }

    // Decode base64 audio from browser
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioType = mimeType || 'audio/webm';
    const filename = audioType.includes('wav') ? 'recording.wav' : 'recording.webm';

    // Build multipart form data manually (compatible with Node 18 built-in fetch)
    const boundary = '----SarvamBoundary' + Date.now().toString(36);

    const bodyParts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${audioType}\r\n\r\n`),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v2\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nhi-IN\r\n`),
      Buffer.from(`--${boundary}--\r\n`)
    ];

    const bodyBuffer = Buffer.concat(bodyParts);

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length)
      },
      body: bodyBuffer
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Sarvam API error:', response.status, responseText);
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Sarvam API error', status: response.status, details: responseText })
      };
    }

    const data = JSON.parse(responseText);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: data.transcript || '',
        language_code: data.language_code || 'hi-IN'
      })
    };

  } catch (err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
