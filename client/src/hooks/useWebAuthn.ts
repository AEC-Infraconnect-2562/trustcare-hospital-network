import { useCallback, useState } from "react";

/**
 * WebAuthn Biometric Confirmation Hook
 * Uses the Web Authentication API to require fingerprint/face unlock
 * before displaying sensitive QR codes in the Patient Wallet.
 * 
 * Falls back gracefully if WebAuthn is not supported.
 */

export interface WebAuthnState {
  isSupported: boolean;
  isRegistered: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

const CREDENTIAL_STORAGE_KEY = "trustcare_webauthn_credential_id";

function getStoredCredentialId(): string | null {
  try {
    return localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCredentialId(id: string) {
  try {
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, id);
  } catch {
    // localStorage not available
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useWebAuthn() {
  const [state, setState] = useState<WebAuthnState>({
    isSupported: typeof window !== "undefined" && !!window.PublicKeyCredential,
    isRegistered: !!getStoredCredentialId(),
    isAuthenticating: false,
    error: null,
  });

  /**
   * Register a new WebAuthn credential (passkey) for biometric confirmation.
   * This creates a resident credential that can be used for future authentication.
   */
  const register = useCallback(async (userId: string, userName: string): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      setState(prev => ({ ...prev, error: "WebAuthn is not supported on this device" }));
      return false;
    }

    setState(prev => ({ ...prev, isAuthenticating: true, error: null }));

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const createOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "TrustCare Hospital Network",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use built-in biometric
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: createOptions,
      }) as PublicKeyCredential;

      if (credential) {
        const credentialId = bufferToBase64(credential.rawId);
        storeCredentialId(credentialId);
        setState(prev => ({ ...prev, isRegistered: true, isAuthenticating: false }));
        return true;
      }

      setState(prev => ({ ...prev, isAuthenticating: false, error: "Registration failed" }));
      return false;
    } catch (err: any) {
      const message = err?.name === "NotAllowedError" 
        ? "การลงทะเบียนถูกยกเลิก" 
        : err?.message || "Registration error";
      setState(prev => ({ ...prev, isAuthenticating: false, error: message }));
      return false;
    }
  }, []);

  /**
   * Authenticate using the registered WebAuthn credential.
   * Returns true if biometric verification succeeds.
   */
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      // If WebAuthn not supported, allow through (graceful fallback)
      return true;
    }

    const storedId = getStoredCredentialId();
    if (!storedId) {
      // Not registered, allow through
      return true;
    }

    setState(prev => ({ ...prev, isAuthenticating: true, error: null }));

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const getOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: base64ToBuffer(storedId),
          type: "public-key",
          transports: ["internal"],
        }],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: getOptions,
      }) as PublicKeyCredential;

      if (assertion) {
        setState(prev => ({ ...prev, isAuthenticating: false }));
        return true;
      }

      setState(prev => ({ ...prev, isAuthenticating: false, error: "Authentication failed" }));
      return false;
    } catch (err: any) {
      const message = err?.name === "NotAllowedError"
        ? "การยืนยันตัวตนถูกยกเลิก"
        : err?.message || "Authentication error";
      setState(prev => ({ ...prev, isAuthenticating: false, error: message }));
      return false;
    }
  }, []);

  /**
   * Remove the stored credential (unregister biometric)
   */
  const unregister = useCallback(() => {
    try {
      localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
      setState(prev => ({ ...prev, isRegistered: false }));
    } catch {
      // ignore
    }
  }, []);

  return {
    ...state,
    register,
    authenticate,
    unregister,
  };
}
