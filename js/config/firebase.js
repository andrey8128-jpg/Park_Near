import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";

const firebaseConfig = {
    apiKey: "AIzaSyATLX5t2lmibbuiSXL_sWu_JnFFTb-nMqU",
    authDomain: "parknear-bef41.firebaseapp.com",
    databaseURL: "https://parknear-bef41-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "parknear-bef41",
    storageBucket: "parknear-bef41.firebasestorage.app",
    messagingSenderId: "1066552333578",
    appId: "1:1066552333578:web:e60e333cf877852eba16f3"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
