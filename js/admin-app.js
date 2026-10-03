
import { initializeFirebase, signInUser, signUpUser, getCurrentUserClaims, onAuthChanged } from './modules/firebase.js';

const authView=document.getElementById('auth-view');
const deniedView=document.getElementById('access-denied');
const frame=document.getElementById('dashboard-frame');
const errorBox=document.getElementById('login-error');

await initializeFirebase();

document.getElementById('login-btn').addEventListener('click', async()=>{
 const email=document.getElementById('admin-email-inp').value.trim();
 const password=document.getElementById('admin-pass-inp').value;
 const result=await signInUser(email,password);
 if(!result.success){showError(result.error);return;}
});

document.getElementById('signup-btn').addEventListener('click', async()=>{
 const email=document.getElementById('admin-email-inp').value.trim();
 const password=document.getElementById('admin-pass-inp').value;
 const result=await signUpUser(email,password);
 if(result.success){
   showError('Account created. Admin claim must be assigned manually from backend/CLI.','info');
 }else{
   showError(result.error);
 }
});

onAuthChanged(async(user)=>{
 if(!user){
   authView.style.display='flex';
   deniedView.style.display='none';
   frame.style.display='none';
   return;
 }
 const claims=await getCurrentUserClaims();
 if(claims.admin===true){
   authView.style.display='none';
   deniedView.style.display='none';
   frame.style.display='block';
   frame.onload=()=>{
      try{
        frame.contentWindow.app?.openAdminPanel?.();
      }catch(e){}
   }
 }else{
   authView.style.display='none';
   deniedView.style.display='block';
   frame.style.display='none';
   setTimeout(()=>window.location.href='index.html',3000);
 }
});

function showError(msg){
 errorBox.style.display='block';
 errorBox.textContent=msg;
}
