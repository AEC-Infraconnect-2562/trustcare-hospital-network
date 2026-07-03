import http from 'http';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Login
  const loginRes = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/auth/demo-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ openId: 'demo-patient-001' }));
  
  const setCookie = loginRes.headers['set-cookie'];
  const cookie = setCookie?.find(c => c.includes('app_session_id'));
  const token = cookie?.split(';')[0];
  console.log('Cookie:', token);
  
  // Step 2: Call auth.me
  const meRes = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/trpc/auth.me',
    method: 'GET',
    headers: { 'Cookie': token }
  });
  
  const meData = JSON.parse(meRes.body);
  console.log('Full response keys:', JSON.stringify(Object.keys(meData?.result?.data || {})));
  // superjson wraps data in { json, meta }
  const user = meData?.result?.data?.json || meData?.result?.data;
  console.log('User keys:', Object.keys(user || {}));
  console.log('avatarUrl:', user?.avatarUrl);
  console.log('name:', user?.name);
  console.log('systemRole:', user?.systemRole);
}

main().catch(console.error);
