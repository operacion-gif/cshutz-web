exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, contactData } = JSON.parse(event.body);

    // 1. Call Anthropic API
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      throw new Error(aiData.error?.message || 'AI API error ' + aiResponse.status);
    }

    const analysis = aiData.content[0].text;

    // 2. Send emails via Resend (only if contactData provided)
    if (contactData && process.env.RESEND_API_KEY) {
      const { nombre, empresa, email, telefono } = contactData;

      // Email to prospect
      const clientEmail = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'C·SHUTZ <operacion@cshutz.net>',
          to: [email],
          subject: `Tu Evaluación de Ciberseguridad · C·SHUTZ`,
          html: `
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#080909;color:#e8e8e8;padding:40px 32px;border-radius:8px;">
              <div style="font-family:Georgia,serif;font-size:22px;color:#2ecc71;letter-spacing:0.1em;margin-bottom:8px;">C·SHUTZ</div>
              <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#888;margin-bottom:32px;">Evaluación Preliminar · Ciberseguridad</div>
              <p style="font-size:15px;color:#ccc;line-height:1.7;">Estimado/a <strong style="color:#e8e8e8;">${nombre}</strong>,</p>
              <p style="font-size:14px;color:#aaa;line-height:1.8;">Gracias por completar nuestra evaluación de ciberseguridad. A continuación encontrarás los resultados preliminares para <strong style="color:#ccc;">${empresa}</strong>.</p>
              <div style="background:#0d1a0d;border:1px solid rgba(46,204,113,0.2);border-radius:8px;padding:24px;margin:24px 0;font-size:13px;line-height:1.8;color:#bbb;white-space:pre-wrap;">${analysis}</div>
              <p style="font-size:13px;color:#888;line-height:1.8;">Nuestro equipo se pondrá en contacto contigo pronto para conocer a fondo las necesidades de tu empresa y diseñar una solución ajustada a tu realidad.</p>
              <div style="margin-top:32px;padding-top:24px;border-top:1px solid #1a2a1a;font-size:11px;color:#555;letter-spacing:0.08em;text-transform:uppercase;">C·SHUTZ · Ciberseguridad Empresarial · cshutz.net</div>
            </div>
          `
        })
      });

      // Email to C·SHUTZ team
      const teamEmail = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'C·SHUTZ Sistema <operacion@cshutz.net>',
          to: ['operacion@cshutz.net'],
          subject: `Nuevo Lead: ${empresa} — Diagnóstico Completado`,
          html: `
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:8px;">
              <h2 style="color:#1a1a1a;font-size:18px;margin-bottom:4px;">Nuevo lead — Diagnóstico completado</h2>
              <p style="color:#666;font-size:13px;margin-bottom:24px;">Se recibió una solicitud de diagnóstico en cshutz.net</p>
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#888;width:120px;">Nombre</td><td style="padding:8px 0;color:#1a1a1a;font-weight:600;">${nombre}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Empresa</td><td style="padding:8px 0;color:#1a1a1a;font-weight:600;">${empresa}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Correo</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#2ecc71;">${email}</a></td></tr>
                <tr><td style="padding:8px 0;color:#888;">Teléfono</td><td style="padding:8px 0;color:#1a1a1a;">${telefono || 'No proporcionado'}</td></tr>
              </table>
              <div style="margin-top:24px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:20px;font-size:13px;line-height:1.8;color:#444;white-space:pre-wrap;">${analysis}</div>
              <p style="margin-top:20px;font-size:12px;color:#999;">C·SHUTZ · Sistema automático de diagnóstico</p>
            </div>
          `
        })
      });

      await Promise.allSettled([clientEmail, teamEmail]);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(aiData)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
