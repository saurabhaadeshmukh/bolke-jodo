// Bol Ke Jodo — Sarvam AI Secure Proxy (saaras:v3)
// API key lives here on Netlify's server only — never reaches the browser.

exports.handler = async function(event) {

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
    console.error('SARVAM_API_KEY is not set in Netlify environment variables!');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'SARVAM_API_KEY not configured.' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { audio, mimeType } = body;

    if (!audio) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No audio data received.' }) };
    }

    console.log('Audio received, mimeType:', mimeType, 'base64 length:', audio.length);

    const audioBuffer = Buffer.from(audio, 'base64');
    const audioType = mimeType || 'audio/webm';
    const filename = audioType.includes('wav') ? 'recording.wav'
                   : audioType.includes('ogg') ? 'recording.ogg'
                   : 'recording.webm';

    console.log('Sending to Sarvam:', filename, audioBuffer.length, 'bytes');

    const boundary = '----SarvamBoundary' + Date.now().toString(36);

    const bodyParts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${audioType}\r\n\r\n`),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v3\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nhi-IN\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\ntranscribe\r\n`),
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
    console.log('Sarvam response status:', response.status);
    console.log('Sarvam response body:', responseText.substring(0, 300));

    if (!response.ok) {
      console.error('Sarvam API error:', response.status, responseText);
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Sarvam API error',
          status: response.status,
          details: responseText.substring(0, 200)
        })
      };
    }

    const data = JSON.parse(responseText);
    console.log('Transcript:', data.transcript);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: data.transcript || '',
        language_code: data.language_code || 'hi-IN'
      })
    };

  } catch (err) {
    console.error('Function error:', err.message, err.stack);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
