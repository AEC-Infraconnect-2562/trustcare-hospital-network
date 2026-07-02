import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Offline-first Patient Wallet using IndexedDB
 * Stores health cards locally so patients can display QR codes
 * even without internet connectivity.
 */

const DB_NAME = "trustcare_wallet";
const DB_VERSION = 1;
const STORE_CARDS = "health_cards";
const STORE_QR_CACHE = "qr_cache";
const STORE_META = "meta";

interface OfflineCard {
  id: number;
  cardType: string;
  displayName: string;
  displayNameEn?: string;
  documentCategory: string;
  credentialId: number;
  credentialStatus: string;
  credentialData: any;
  issuerHospitalName?: string;
  expiresAt?: string;
  createdAt: string;
  lastSyncedAt: string;
}

interface QRCacheEntry {
  cardId: number;
  qrDataUrl: string;
  qrData: string;
  presentationId: string;
  generatedAt: string;
  expiresAt?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        const store = db.createObjectStore(STORE_CARDS, { keyPath: "id" });
        store.createIndex("cardType", "cardType", { unique: false });
        store.createIndex("documentCategory", "documentCategory", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QR_CACHE)) {
        const qrStore = db.createObjectStore(STORE_QR_CACHE, { keyPath: "cardId" });
        qrStore.createIndex("generatedAt", "generatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllCards(): Promise<OfflineCard[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CARDS, "readonly");
    const store = tx.objectStore(STORE_CARDS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putCards(cards: OfflineCard[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CARDS, "readwrite");
    const store = tx.objectStore(STORE_CARDS);
    // Clear existing and re-add all
    store.clear();
    for (const card of cards) {
      store.put(card);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getCachedQR(cardId: number): Promise<QRCacheEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QR_CACHE, "readonly");
    const store = tx.objectStore(STORE_QR_CACHE);
    const request = store.get(cardId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putCachedQR(entry: QRCacheEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QR_CACHE, "readwrite");
    const store = tx.objectStore(STORE_QR_CACHE);
    store.put(entry);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function setMeta(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readwrite");
    const store = tx.objectStore(STORE_META);
    store.put({ key, value, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getMeta(key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readonly");
    const store = tx.objectStore(STORE_META);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export function useOfflineWallet() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCards, setOfflineCards] = useState<OfflineCard[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load offline cards on mount
  useEffect(() => {
    (async () => {
      try {
        const cards = await getAllCards();
        setOfflineCards(cards);
        const syncTime = await getMeta("lastSyncTime");
        setLastSyncTime(syncTime || null);
      } catch {
        // IndexedDB not available
      }
    })();
  }, []);

  /**
   * Sync online cards to IndexedDB for offline access
   */
  const syncCards = useCallback(async (onlineCards: any[]) => {
    if (!onlineCards || onlineCards.length === 0) return;
    setIsSyncing(true);
    try {
      const now = new Date().toISOString();
      const cardsToStore: OfflineCard[] = onlineCards.map((c: any) => ({
        id: c.id,
        cardType: c.cardType,
        displayName: c.displayName,
        displayNameEn: c.displayNameEn,
        documentCategory: c.documentCategory,
        credentialId: c.credentialId,
        credentialStatus: c.credentialStatus,
        credentialData: c.credentialData,
        issuerHospitalName: c.issuerHospitalName,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        lastSyncedAt: now,
      }));
      await putCards(cardsToStore);
      await setMeta("lastSyncTime", now);
      setOfflineCards(cardsToStore);
      setLastSyncTime(now);
    } catch (err) {
      console.error("Failed to sync cards to IndexedDB:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Cache a generated QR code for offline display
   */
  const cacheQR = useCallback(async (cardId: number, qrData: string, presentationId: string, expiresAt?: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 240 });
      await putCachedQR({
        cardId,
        qrDataUrl,
        qrData,
        presentationId,
        generatedAt: new Date().toISOString(),
        expiresAt,
      });
      return qrDataUrl;
    } catch (err) {
      console.error("Failed to cache QR:", err);
      return null;
    }
  }, []);

  /**
   * Get a cached QR code for offline display
   */
  const getOfflineQR = useCallback(async (cardId: number): Promise<QRCacheEntry | null> => {
    try {
      const cached = await getCachedQR(cardId);
      if (!cached) return null;
      // Check if expired
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        return null; // Expired
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  /**
   * Get the count of offline-available cards
   */
  const offlineCardCount = offlineCards.length;

  return {
    isOnline,
    offlineCards,
    offlineCardCount,
    lastSyncTime,
    isSyncing,
    syncCards,
    cacheQR,
    getOfflineQR,
  };
}
