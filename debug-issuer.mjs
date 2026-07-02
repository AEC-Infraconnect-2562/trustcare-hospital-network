import { decodeJwt } from 'jose';
import { appRouter } from './server/routers.ts';

async function main() {
  const caller = appRouter.createCaller({
    user: { id: 77, openId: 'test', email: 'test@test.com', name: 'Test', loginMethod: 'test', role: 'admin', systemRole: 'doctor', credentialEntitlements: {}, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), preferredLanguage: 'th', isActive: true },
    req: { protocol: 'https', headers: {}, ip: '127.0.0.1' },
    res: { clearCookie: () => {} },
  });
  const packet = await caller.portability.createPacket({
    context: 'cross_border',
    hisInput: {
      sourceFormat: 'db_view',
      sourceSystem: 'e2e-his',
      sourceOrganizationId: 'TH-HCODE-E2E',
      sourceOrganizationName: 'Trustcare E2E Hospital',
      mapperVersion: 'e2e',
      payload: {
        patient: { hn: 'HN-E2E-001', cid: '1101700203456', name: 'Somchai Jaidee', birthDate: '1985-03-15', sex: 'M' },
        allergies: [{ substance: 'Penicillin', severity: 'high', reaction: 'Anaphylaxis' }],
        medications: [{ code: 'TMT-123', name: 'Metformin 500mg', frequency: '1 tab twice daily' }],
        diagnoses: [{ code: 'E11', display: 'Type 2 diabetes mellitus' }],
      },
    },
    holderDid: 'did:key:e2e-patient',
    consent: { id: 'consent-e2e', patientId: 'patient-e2e', purpose: 'referral', requesterId: 'doctor-e2e', requesterRole: 'doctor', scopes: ['Patient.read'], status: 'granted', grantedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
  });
  const vpPayload = decodeJwt(packet.presentation.jwt);
  console.log('VP issuer (iss):', vpPayload.iss);
  const vp = vpPayload.vp;
  if (vp && vp.verifiableCredential) {
    for (const vcJwt of vp.verifiableCredential) {
      const vcPayload = decodeJwt(vcJwt);
      console.log('VC issuer (iss):', vcPayload.iss);
    }
  }
}
main().catch(e => console.error(e.message));
