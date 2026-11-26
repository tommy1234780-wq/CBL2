(function(){
  'use strict';
  const refresh=document.getElementById('refresh'),access=document.getElementById('access'),panel=document.getElementById('monitor-data');
  const put=(id,value)=>{document.getElementById(id).textContent=value;};
  const time=value=>value?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value)):'尚無紀錄';
  function monitorAlerts(data){
    const alerts=[],deadline=data.pendingDeadlines||{};
    if(data.enabled&&data.cronActive){
      const checked=Date.parse(data.lastCheckedAt),serverNow=Date.parse(data.serverNow);
      if(Number.isFinite(serverNow)&&(!Number.isFinite(checked)||serverNow-checked>300000))alerts.push('排程超過 5 分鐘未更新，請確認雲端排程及工作紀錄。');
      else if(!Number.isFinite(serverNow))alerts.push('目前無法確認排程檢查時間是否正常。');
    }
    if(deadline.dueSoon>0)alerts.push(`${deadline.dueSoon} 項待發工作將於 5 分鐘內到期。最近截止：${time(deadline.nextExpiry)}。`);
    if(deadline.overdue>0)alerts.push(`${deadline.overdue} 項未完成工作已過截止時間，請核對原因，不建議直接重送。`);
    return alerts;
  }
  const outcomes={sending:'處理中',sent:'推播服務已接受',retry:'等待重試',unknown:'結果不明，待確認',expired:'裝置失效',failed:'未能交付'};
  const errors={subscription_expired:'裝置訂閱失效',provider_temporary_failure:'服務暫時異常',provider_rejected:'服務拒絕請求',delivery_uncertain_review_required:'結果不明，不自動重送',worker_interrupted_review_required:'工作中斷，需人工確認',release_resource_404:'正式站尚缺發布檔案',release_source_mismatch:'正式站資料與發布標記不一致',homepage_release_mismatch:'首頁與資料版本不一致',worker_release_mismatch:'快取版本尚未更新',release_changed_before_send:'處理期間有新版發布，等待重新核對'};
  let client=null,loading=false;
  async function loadClient(config){
    if(!window.supabase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
    return window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  }
  async function load(){
    if(loading)return;loading=true;refresh.disabled=true;
    try{
      const config=window.CBL_PUSH_CONFIG;if(!config)throw new Error('config');
      client=client||await loadClient(config);const sessionResult=await client.auth.getSession();
      if(sessionResult.error)throw new Error('auth');const session=sessionResult.data.session;
      if(!session){panel.hidden=true;access.textContent='請先從管理員登入頁登入，再返回此頁重新整理。';return;}
      const response=await fetch(config.supabaseUrl+'/functions/v1/schedule-notifications',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','apikey':config.supabasePublishableKey,'Authorization':'Bearer '+session.access_token},body:'{"action":"status"}',signal:AbortSignal.timeout(15000)});
      if(response.status===401||response.status===403){panel.hidden=true;access.textContent='目前登入身分沒有此管理權限，請使用官網管理員帳號登入。';return;}
      const data=await response.json();if(!response.ok)throw new Error('server');
      panel.hidden=false;access.textContent='僅供管理員查閱；此頁不會發送通知或更改啟用設定。';
      const queue=data.queue||{},notifications=data.notifications||{};
      put('pending',(queue.pending||0)+(queue.retry||0));put('sending',queue.sending||0);put('accepted',notifications.sent||0);put('unknown',queue.unknown||0);put('failed',queue.failed||0);put('expired',queue.expired||0);
      put('last-checked',time(data.lastCheckedAt));put('last-success',time(data.lastSuccessAt));put('revision',data.revision?data.revision.slice(0,12):'尚未建立基準');
      const attention=(queue.unknown||0)+(queue.failed||0);
      const alerts=monitorAlerts(data);
      put('system-state',data.error||attention||alerts.length?'需檢查':data.enabled&&data.cronActive?'已啟用':data.enabled?'排程未啟用':'尚未啟用正式發送');
      put('system-detail',data.error?(errors[data.error]||'處理異常，請聯盟管理人員核對雲端紀錄。'):attention?`${attention} 項工作未能確認交付，請聯盟管理人員檢查；系統不會盲目重送結果不明的通知。`:data.enabled&&data.cronActive?'依正式賽程版本自動處理；收件仍取決於裝置權限與網路。':'正式自動推播維持停用，既有官網查詢功能不受影響。');
      const alertList=document.getElementById('monitor-alerts');
      alertList.replaceChildren(...alerts.map(message=>{const item=document.createElement('li');item.textContent=message;return item;}));
      alertList.hidden=!alerts.length;
      const history=document.getElementById('history');history.replaceChildren();
      for(const item of data.recent||[]){const row=document.createElement('tr');for(const value of [time(item.created_at),item.title||'賽程通知',outcomes[item.status]||'待確認',item.attempts,item.provider_status||'未取得',item.last_error?(errors[item.last_error]||'請管理人員核對'):item.status==='sent'?'不代表手機已讀':'']){const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell);}history.appendChild(row);}
      if(!history.children.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='尚無自動賽程通知紀錄。';row.appendChild(cell);history.appendChild(row);}
    }catch{panel.hidden=true;access.textContent='狀態暫時無法載入，請重新整理或確認管理員登入。';}
    finally{loading=false;refresh.disabled=false;}
  }
  refresh.addEventListener('click',load);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
  setInterval(()=>{if(document.visibilityState==='visible')load();},60000);load();
})();
