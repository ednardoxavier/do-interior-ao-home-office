const { randomUUID } = require('node:crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) return res.status(503).json({ error: 'Credencial de pagamento não configurada.' });

  // O prefixo APP_USR- também pode aparecer em credenciais exibidas na área de testes.
  // Nunca inferir o ambiente a partir do prefixo do token.
  // Bloqueio explícito para evitar cobranças enquanto a integração é validada.
  if (process.env.CHECKOUT_TEST_MODE !== 'true') {
    return res.status(503).json({ error: 'Checkout bloqueado até a configuração explícita do ambiente de testes.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  const idempotencyKey = randomUUID();
  const payload = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: '29.90',
    external_reference: idempotencyKey,
    description: 'Do Interior ao Home Office - guia pratico e materiais exclusivos',
    payer: { email },
    items: [{ title: 'Do Interior ao Home Office - guia e materiais exclusivos', quantity: 1, unit_price: '29.90' }],
    config: { online: {
      success_url: 'https://do-interior-ao-home-office.vercel.app/?pagamento=retorno',
      failure_url: 'https://do-interior-ao-home-office.vercel.app/?pagamento=falha',
      pending_url: 'https://do-interior-ao-home-office.vercel.app/?pagamento=pendente',
      auto_return: 'all'
    } }
  };

  try {
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.checkout_url) {
      console.error('Mercado Pago create order failed', response.status, data?.message || data?.error || 'missing checkout_url');
      return res.status(502).json({ error: 'Não foi possível iniciar o checkout de teste.' });
    }
    const url = new URL(data.checkout_url);
    if (url.protocol !== 'https:' || !/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname)) {
      return res.status(502).json({ error: 'URL de checkout inválida.' });
    }
    return res.status(200).json({ checkout_url: url.href, mode: 'test' });
  } catch (error) {
    console.error('Checkout error:', error?.message);
    return res.status(502).json({ error: 'Serviço de pagamento temporariamente indisponível.' });
  }
};
