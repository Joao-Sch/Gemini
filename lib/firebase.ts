// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKcnO43jSbZXq3mh8AZbRNAaWnP2ShGRo",
  authDomain: "i9chat.firebaseapp.com",
  projectId: "i9chat",
  storageBucket: "i9chat.firebasestorage.app",
  messagingSenderId: "577404733880",
  appId: "1:577404733880:web:8a9558708ba1199d36674d",
  measurementId: "G-EJQN2EMT23"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };