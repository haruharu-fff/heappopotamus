// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCNKzSBWkIW1aUC2ySnHFa3ni4lbNLgtn4",
  authDomain: "heappopotamus-3cf93.firebaseapp.com",
  projectId: "heappopotamus-3cf93",
  // 他の設定も必要に応じて追加
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
