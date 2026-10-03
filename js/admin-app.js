
import { initializeFirebase, signInUser, signUpUser, getCurrentUserClaims, onAuthChanged } from './modules/firebase.js';

const authView=document.getElementById('auth-view');
const deniedView=document.getElementById('access-denied');
const frame=document.getElementById('dashboard-frame');
const errorBox=document.getElementById('login-error');
const loginForm=document.getElementById('admin-login-form');
const loginButton=document.getElementById('login-btn');
const signupButton=document.getElementById('signup-btn');
const deniedMessage=document.getElementById('access-denied-message');
let adminAccess=false;
let dashboardOpened=false;
let firebaseReady=false;

function openDashboardWhenReady() {
 if(!adminAccess || dashboardOpened) return;
 const app=frame.contentWindow?.app;
 if(typeof app?.openAdminPanel==='function'){
   app.openAdminPanel();
   dashboardOpened=true;
 }
}

frame.addEventListener('load', openDashboardWhenReady);

try {
 await initializeFirebase();
 firebaseReady=true;
} catch(error) {
 showError('Could not connect to Firebase. Check your internet connection and configuration.');
 loginButton.disabled=true;
 signupButton.disabled=true;
}

loginForm.addEventListener('submit', async(event)=>{
 event.preventDefault();
 if(loginButton.disabled) return;

 const email=document.getElementById('admin-email-inp').value.trim();
 const password=document.getElementById('admin-pass-inp').value;
 loginButton.disabled=true;
 loginButton.textContent='Signing in...';
 try {
   const result=await signInUser(email,password);
   if(!result.success) {
     showError(result.error || 'Sign-in failed. Check your email and password.');
     return;
   }

   const token=await result.user.getIdTokenResult(true);
   if(token.claims.admin!==true) {
     authView.style.display='none';
     frame.style.display='none';
     deniedMessage.textContent='Sign-in succeeded, but this account does not have the Firebase admin role. Ask an administrator to assign the admin claim.';
     deniedView.style.display='block';
     return;
   }

   adminAccess=true;
   authView.style.display='none';
   deniedView.style.display='none';
   frame.style.display='block';
   openDashboardWhenReady();
 } catch(error) {
   console.error('Admin sign-in failed:',error);
   showError(error.message || 'Sign-in could not be completed. Please try again.');
 } finally {
   if(!adminAccess) {
     loginButton.disabled=false;
     loginButton.textContent='Sign In';
   }
 }
});

signupButton.addEventListener('click', async()=>{
 const email=document.getElementById('admin-email-inp').value.trim();
 const password=document.getElementById('admin-pass-inp').value;
 try {
   const result=await signUpUser(email,password);
   if(result.success){
     showError('Account created. Admin access still requires an administrator role.','info');
   }else{
     showError(result.error);
   }
 } catch(error) {
   showError(error.message || 'Account creation failed.');
 }
});

if(firebaseReady) onAuthChanged(async(user)=>{
 if(!user){
   adminAccess=false;
   dashboardOpened=false;
   authView.style.display='flex';
   deniedView.style.display='none';
   frame.style.display='none';
   return;
 }

 try {
   const claims=await getCurrentUserClaims();
   if(claims.admin===true){
     adminAccess=true;
     authView.style.display='none';
     deniedView.style.display='none';
     frame.style.display='block';
     openDashboardWhenReady();
   }else{
     adminAccess=false;
     authView.style.display='none';
     frame.style.display='none';
     deniedMessage.textContent='Sign-in succeeded, but this account does not have the Firebase admin role. Ask an administrator to assign the admin claim.';
     deniedView.style.display='block';
   }
 } catch(error) {
   adminAccess=false;
   authView.style.display='none';
   frame.style.display='none';
   deniedMessage.textContent='Could not verify administrator access. Check your connection and reload this page.';
   deniedView.style.display='block';
 }
});

function showError(msg,type='error'){
 errorBox.style.display='block';
 errorBox.textContent=msg;
 errorBox.classList.toggle('info',type==='info');
}
