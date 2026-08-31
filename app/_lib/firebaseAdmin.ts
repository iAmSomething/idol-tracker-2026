import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  try {
    initializeApp({
      projectId: "idol-tracker-2026",
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

export const adminDb = getFirestore();
