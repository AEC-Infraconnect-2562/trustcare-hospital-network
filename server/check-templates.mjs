import { listCredentialTemplates } from './db.ts';

async function main() {
  const templates = await listCredentialTemplates();
  console.log('Total templates:', templates.length);
  const ps = templates.filter(t => t.type === 'patient_summary');
  console.log('patient_summary templates:', ps.length);
  ps.forEach(t => console.log(' ', t.id, t.name, 'v'+t.version, 'hospital:', t.hospitalId));
  process.exit(0);
}
main();
