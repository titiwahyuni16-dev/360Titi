export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Mendukung awalan KV_ maupun UPSTASH_REDIS_ otomatis dari Vercel
  const REDIS_URL =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.PENYIMPANAN_REST_API_URL;
  const REDIS_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.PENYIMPANAN_REST_API_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Variabel Database Vercel belum terbaca. Silakan Redeploy.' });
  }

  const headers = {
    Authorization: `Bearer ${REDIS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const [schoolsRes, evalsRes] = await Promise.all([
        fetch(`${REDIS_URL}/get/epkks_schools`, { headers }),
        fetch(`${REDIS_URL}/get/epkks_evals`, { headers }),
      ]);

      const schoolsData = await schoolsRes.json();
      const evalsData = await evalsRes.json();

      return res.status(200).json({
        schools: schoolsData.result ? JSON.parse(schoolsData.result) : null,
        evaluations: evalsData.result ? JSON.parse(evalsData.result) : [],
      });
    }

    if (req.method === 'POST') {
      const { action, evaluation, schools, evaluations } = req.body;

      if (action === 'ADD_EVAL' && evaluation) {
        const currentRes = await fetch(`${REDIS_URL}/get/epkks_evals`, { headers });
        const currentData = await currentRes.json();
        const list = currentData.result ? JSON.parse(currentData.result) : [];
        list.push(evaluation);

        await fetch(`${REDIS_URL}/set/epkks_evals`, {
          method: 'POST',
          headers,
          body: JSON.stringify(JSON.stringify(list)),
        });

        return res.status(200).json({ status: 'success', total: list.length });
      }

      if (action === 'SAVE_SCHOOLS' && Array.isArray(schools)) {
        await fetch(`${REDIS_URL}/set/epkks_schools`, {
          method: 'POST',
          headers,
          body: JSON.stringify(JSON.stringify(schools)),
        });
        return res.status(200).json({ status: 'success' });
      }

      if (action === 'REPLACE_EVALS' && Array.isArray(evaluations)) {
        await fetch(`${REDIS_URL}/set/epkks_evals`, {
          method: 'POST',
          headers,
          body: JSON.stringify(JSON.stringify(evaluations)),
        });
        return res.status(200).json({ status: 'success' });
      }

      return res.status(400).json({ error: 'Aksi tidak dikenali.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
