import { initializeApp } from './vendor/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from './vendor/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from './vendor/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDlDq9k_MKsBuXlAvsPFoLxEkiLagDeS7M",
  authDomain: "thapa-fa09c.firebaseapp.com",
  projectId: "thapa-fa09c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loggedInForm = document.getElementById('logged-in-form');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const logoutButton = document.getElementById('logout-button');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    const showForm = (formId) => {
        [loginForm, registerForm, loggedInForm].forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(formId).classList.add('active');
    };

    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showForm('register-form');
    });

    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showForm('login-form');
    });

    loginButton.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return fetchAndDisplayUserData(user.uid);
            })
            .then(() => {
                alert('Login successful!');
            })
            .catch((error) => {
                console.error('Error:', error);
                alert(error.message);
            });
    });

    registerButton.addEventListener('click', () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const apiKey = document.getElementById('register-api-key').value;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return setDoc(doc(db, 'users', user.uid), {
                    emailID: email,
                    password: password,
                    apiKey: apiKey
                });
            })
            .then(() => {
                return fetchAndDisplayUserData(auth.currentUser.uid);
            })
            .then(() => {
                alert('Account created successfully!');
            })
            .catch((error) => {
                console.error('Error:', error);
                if (error.code === 'permission-denied') {
                    alert('Error creating account. Please check your Firestore security rules.');
                } else {
                    alert(error.message);
                }
            });
    });

    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            showForm('login-form');
        }).catch((error) => {
            console.error('Error:', error);
            alert(error.message);
        });
    });

    function fetchAndDisplayUserData(userId) {
        return getDoc(doc(db, 'users', userId))
            .then((docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    document.getElementById('email-display').textContent = data.emailID;
                    document.getElementById('api-key-display').textContent = data.apiKey;
                    showForm('logged-in-form');
                    
                    // Store API key in chrome.storage for use in background.js
                    return new Promise((resolve, reject) => {
                        chrome.storage.local.set({ apiKey: data.apiKey }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('Error storing API key:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                console.log('API Key stored in chrome.storage');
                                // Send a message to background.js to update the API_KEY
                                chrome.runtime.sendMessage({type: 'UPDATE_API_KEY', apiKey: data.apiKey}, response => {
                                    if (chrome.runtime.lastError) {
                                        console.error('Error sending message:', chrome.runtime.lastError);
                                        reject(chrome.runtime.lastError);
                                    } else {
                                        console.log('API Key update message sent successfully');
                                        resolve();
                                    }
                                });
                            }
                        });
                    });
                } else {
                    throw new Error("User data not found in Firestore");
                }
            });
    }

    // Check if user is already signed in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fetchAndDisplayUserData(user.uid)
                .catch((error) => {
                    console.error('Error fetching user data:', error);
                    alert('Error fetching user data. Please try logging in again.');
                    showForm('login-form');
                });
        } else {
            showForm('login-form');
        }
    });
});