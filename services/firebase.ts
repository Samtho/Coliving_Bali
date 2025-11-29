import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, Timestamp } from "firebase/firestore";
import { IncidentRecord, IncidentStatus } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAdAaOHW4t88Q95Dfp-qJUr1PEBNzD5wyU",
  authDomain: "registro-v1.firebaseapp.com",
  projectId: "registro-v1",
  storageBucket: "registro-v1.firebasestorage.app",
  messagingSenderId: "176025333336",
  appId: "1:176025333336:web:c90b77bdd8188701c9642d",
  measurementId: "G-N0BFHD79TB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const convertTimestampToDate = (t: any): Date => {
  if (t && typeof t.toDate === 'function') {
    return t.toDate();
  } else if (t) {
    return new Date(t);
  }
  return new Date();
};

// Subscribe to real-time updates from Firestore
export const subscribeToIncidents = (onDataChange: (data: IncidentRecord[]) => void) => {
  // Ordenamos por createdAt descendente
  const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));
  
  // onSnapshot listens for changes in real-time
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const incidents = snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: convertTimestampToDate(data.updatedAt)
      } as IncidentRecord;
    });
    
    onDataChange(incidents);
  }, (error) => {
    console.error("Error connecting to Firebase:", error);
  });

  return unsubscribe;
};

// Add a new incident to Firestore
export const addIncidentToDb = async (incident: Omit<IncidentRecord, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, "incidents"), {
      ...incident,
      createdAt: Timestamp.fromDate(incident.createdAt),
      updatedAt: Timestamp.fromDate(incident.updatedAt)
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

// Update incident status in Firestore
export const updateIncidentStatusInDb = async (id: string, status: IncidentStatus) => {
  try {
    const incidentRef = doc(db, "incidents", id);
    await updateDoc(incidentRef, {
      status: status,
      updatedAt: Timestamp.now()
    });
  } catch (e) {
    console.error("Error updating document: ", e);
    throw e;
  }
};