import dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "idol-tracker-2026",
  appId: "1:47996752520:web:bc7ebc514f82846f3ec53d",
  storageBucket: "idol-tracker-2026.firebasestorage.app",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "idol-tracker-2026.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function getDB() {
  return db;
}

export interface ArtistDoc {
  id: string;
  name: string;
  lastCrawledAt?: string;
  [key: string]: any;
}

export interface ComebackDoc {
  id: string;
  artistName: string;
  artistId: string;
  releaseDate: string;
  title: string;
  [key: string]: any;
}

/**
 * Returns all active artists mapped to basic structures
 */
export async function getActiveArtists(): Promise<ArtistDoc[]> {
  const snapshot = await getDocs(collection(db, "artists"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ArtistDoc));
}

/**
 * Returns a batch of artists for rotation queue, sorted by lastCrawledAt ascending.
 */
export async function getActiveArtistsBatch(limitCount: number): Promise<ArtistDoc[]> {
  const artists = await getActiveArtists();
  
  // Sort in memory to cover both present and missing timestamps (empty values crawled first)
  artists.sort((a, b) => {
    const aTime = a.lastCrawledAt ? new Date(a.lastCrawledAt).getTime() : 0;
    const bTime = b.lastCrawledAt ? new Date(b.lastCrawledAt).getTime() : 0;
    return aTime - bTime;
  });

  return artists.slice(0, limitCount);
}

/**
 * Fetches recent comebacks (released in the last N days + future comebacks)
 */
export async function getRecentComebacks(daysLimit: number = 90): Promise<ComebackDoc[]> {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - daysLimit);
  const dateStr = limitDate.toISOString().split('T')[0];

  const q = query(
    collection(db, "comebacks"),
    where("releaseDate", ">=", dateStr)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ComebackDoc));
}
