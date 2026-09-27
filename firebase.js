// core/firebase.js — gerado a partir do monólito; edite aqui a partir de agora.

export const firebaseConfig = {
  apiKey: "AIzaSyDWzXgW5PFOkuZas0QFQFStiGg_fVs_iyA",
  authDomain: "meu-planner-rotina.firebaseapp.com",
  databaseURL: "https://meu-planner-rotina-default-rtdb.firebaseio.com",
  projectId: "meu-planner-rotina",
  storageBucket: "meu-planner-rotina.firebasestorage.app",
  messagingSenderId: "286056248817",
  appId: "1:286056248817:web:2365b794accb1cdc468050",
  measurementId: "G-Y4PQ172L0Y"
};

firebase.initializeApp(firebaseConfig);
export const db = firebase.database();
// === FIM DA CONEXÃO ===
