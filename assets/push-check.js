(function () {
  'use strict';
  const button=document.getElementById('register'),consent=document.getElementById('consent'),status=document.getElementById('status');
  if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)document.getElementById('install-step').textContent='目前正在主畫面 App 中，將驗收這個 App 的通知登記。';
  const supported=location.origin==='https://cblcbl.netlify.app'&&'Notification' in window&&'PushManager' in window&&'serviceWorker' in navigator;
  if(!supported)status.textContent='請在正式官網及支援推播的瀏覽器使用；iPhone 須先加入主畫面。此裝置尚未登記。';
  consent.addEventListener('change',()=>{button.disabled=!supported||!consent.checked;});
  const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  async function authClient(config){
    if(!window.supabase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.onload=resolve;script.onerror=()=>reject(new Error('auth_unavailable'));document.head.appendChild(script);});
    return window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  }
  button.addEventListener('click',async()=>{
    if(!supported||!consent.checked)return;
    button.disabled=true;status.textContent='正在登記此裝置，請完成通知權限選擇。';
    try {
      if(await Notification.requestPermission()!=='granted')throw new Error('permission_denied');
      const config=window.CBL_PUSH_CONFIG;if(!config)throw new Error('config_unavailable');
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(config.vapidPublicKey)});
      const client=await authClient(config);let result=await client.auth.getSession();if(result.error)throw new Error('auth_unavailable');
      if(!result.data.session){result=await client.auth.signInAnonymously();if(result.error)throw new Error('auth_unavailable');}
      const response=await fetch(config.supabaseUrl+'/functions/v1/schedule-notifications',{method:'POST',headers:{'Content-Type':'application/json','apikey':config.supabasePublishableKey,'Authorization':'Bearer '+result.data.session.access_token},body:JSON.stringify({action:'enroll-test',subscription}),signal:AbortSignal.timeout(20000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'enrollment_failed');
      document.getElementById('code').textContent=data.code;document.getElementById('result').hidden=false;
      status.textContent=data.tested?'此裝置已送出測試，請回報是否收到；系統不會自動重送。':'已登記，請回報驗收代碼。管理人員核對前不會發送測試。';
    }catch(error){
      status.textContent=({permission_denied:'未允許通知。請在裝置設定允許後再試。',test_enrollment_closed:'聯盟尚未開放本次驗收登記，請通知管理人員開啟驗收。',unauthorized:'通知登入失效，請重新整理後再試。',auth_unavailable:'通知登入元件暫時無法使用，請稍後再試。',test_enrollment_limit:'本次驗收名額已滿，請聯絡管理人員。'})[error.message]||'裝置登記未完成，請確認網路及主畫面 App 狀態後再試。';
      button.disabled=!consent.checked;
    }
  });
})();
