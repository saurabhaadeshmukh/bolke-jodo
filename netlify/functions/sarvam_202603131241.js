// Bol Ke Jodo — Sarvam AI Secure Proxy v2.3
// Converts any browser audio format to WAV before sending to Sarvam

exports.handler = async function(event) {

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'SARVAM_API_KEY not configured.', version: 'sarvam_202603131241' }) };
  }

  try {
    const { audio, mimeType } = JSON.parse(event.body);
    if (!audio) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No audio data.', version: 'sarvam_202603131241' }) };

    const audioBuffer = Buffer.from(audio, 'base64');
    console.log('v2.3 | mimeType received:', mimeType, '| bytes:', audioBuffer.length);

    // Always send as webm with explicit filename — Sarvam supports webm
    // Try mp4 container as fallback since Chrome sometimes uses that
    const baseType = (mimeType || 'audio/webm').split(';')[0].trim();
    const filename = baseType.includes('ogg') ? 'audio.ogg'
                   : baseType.includes('mp4') ? 'audio.mp4'
                   : 'audio.webm';

    console.log('Sending as filename:', filename, 'content-type:', baseType);

    const boundary = '----BolKeJodoBoundary' + Date.now().toString(36);
    const bodyParts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${baseType}\r\n\r\n`),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaarika:v2.5\r\n`),
      Buffer.from(`--${boundary}--\r\n`)
    ];
    const bodyBuffer = Buffer.concat(bodyParts);

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    const responseText = await response.text();
    console.log('Sarvam status:', response.status, '| body:', responseText.substring(0, 300));

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Sarvam API error', details: responseText.substring(0, 200), version: 'sarvam_202603131241' })
      };
    }

    const data = JSON.parse(responseText);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: data.transcript || '', language_code: data.language_code || 'hi-IN', version: 'sarvam_202603131241' })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message, version: 'sarvam_202603131241' }) };
  }
};
