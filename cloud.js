import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
    getAuth, GoogleAuthProvider, browserLocalPersistence,
    setPersistence, onAuthStateChanged, signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
    getFirestore, doc, getDocFromServer, runTransaction
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './cloud-config.js';

export function createCloud() {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getFirestore(app);
    const schedule = uid => doc(database, 'users', uid, 'schedules', 'main');
    const labels = uid => doc(database, 'users', uid, 'labels', 'main');
    const eventsFrom = snapshot => snapshot.exists() ? snapshot.data().events : [];

    return {
        async start(onUser, onError) {
            await setPersistence(auth, browserLocalPersistence);
            onAuthStateChanged(auth, onUser, onError);
        },
        signIn() {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            return signInWithPopup(auth, provider);
        },
        signOut: () => signOut(auth),
        async loadEvents(uid) {
            return eventsFrom(await getDocFromServer(schedule(uid)));
        },
        async loadLabels(uid) {
            const snapshot = await getDocFromServer(labels(uid));
            return snapshot.exists() ? snapshot.data() : null;
        },
        saveLabels(uid, merge) {
            return runTransaction(database, async transaction => {
                const reference = labels(uid);
                const snapshot = await transaction.get(reference);
                const choices = merge(snapshot.exists() ? snapshot.data() : null);
                transaction.set(reference, choices);
                return choices;
            });
        },
        saveEvents(uid, merge) {
            // Merge against the latest server copy, including concurrent edits.
            return runTransaction(database, async transaction => {
                const reference = schedule(uid);
                const events = merge(eventsFrom(await transaction.get(reference)));
                transaction.set(reference, { events });
                return events;
            });
        }
    };
}
