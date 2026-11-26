(function () {
  "use strict";

  // PWA 更新檢查獨立於推播面板，讓所有載入本檔的頁面都能自動更新。
  if ("serviceWorker" in navigator) {
    let reloading = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        });
      })
      .catch(() => {});
  }

  const teams = [
    ["OFFICIAL", "CBL 官方通知"],
    ...(window.CBL_SEASON3?.teams || []).map((team) => [team.channelId, team.displayName])
  ];

  const config = window.CBL_PUSH_CONFIG || {
    supabaseUrl: "https://iwwwpgdrasrhmrhncsim.supabase.co",
    supabasePublishableKey: "sb_publishable_2Ko8glEiFB6NfunRyCr_4A_c1c1fvmO",
    subscribeEndpoint: "https://iwwwpgdrasrhmrhncsim.supabase.co/functions/v1/push-subscribe",
    unsubscribeEndpoint: "https://iwwwpgdrasrhmrhncsim.supabase.co/functions/v1/push-unsubscribe",
    vapidPublicKey: "BA461i_ApeYPTt5PLjpC9JWvlXCRBlBn8i6RvJhasK0doPIpJM3YS01qQsCYq4DtvRug-j3VnCsHRtfmzfUqFxE"
  };

  window.CBL_PUSH_CONFIG = config;
  const panel = document.querySelector("[data-push-panel]");
  if (!panel) return;
  const options = panel.querySelector("[data-team-options]");
  const status = panel.querySelector("[data-push-status]");
  const enable = panel.querySelector("[data-enable-push]");
  const disable = panel.querySelector("[data-disable-push]");
  const toggle = panel.querySelector("[data-push-toggle]");
  const settings = panel.querySelector("[data-push-settings]");
  const summary = panel.querySelector("[data-push-device-summary]");
  const storageKey = "cbl-followed-teams";
  const names = new Map(teams);
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  let saved = [];
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(cached)) saved = cached.filter(id => names.has(id));
  } catch (_) {}
  let registered = null, device = null, checkingFailed = false, dirty = false, busy = false;

  function remember(ids) {
    saved = ids;
    try {
      if (ids.length) localStorage.setItem(storageKey, JSON.stringify(ids));
      else localStorage.removeItem(storageKey);
    } catch (_) {}
  }

  function setExpanded(expanded) {
    settings.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "收起設定" : "✦ 設定通知";
    if (expanded) refreshDevice();
  }
  toggle.addEventListener("click", () => setExpanded(settings.hidden));

  let authClient = null;
  let authClientPromise = null;

  function getAuthClient() {
    if (authClient) return Promise.resolve(authClient);
    if (authClientPromise) return authClientPromise;

    authClientPromise = new Promise((resolve, reject) => {
      const connect = () => {
        if (!window.supabase) {
          reject(new Error("auth_client_unavailable"));
          return;
        }
        authClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
        resolve(authClient);
      };

      if (window.supabase) {
        connect();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.onload = connect;
      script.onerror = () => reject(new Error("auth_client_unavailable"));
      document.head.appendChild(script);
    }).catch((error) => {
      authClientPromise = null;
      throw error;
    });

    return authClientPromise;
  }

  async function accessToken(createSession = false) {
    const client = await getAuthClient();
    let { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw new Error("auth_session_failed");
    if (!session && createSession) {
      const result = await client.auth.signInAnonymously();
      if (result.error || !result.data.session) throw new Error("anonymous_signin_failed");
      session = result.data.session;
    }
    return session?.access_token || null;
  }

  for (const [id, name] of teams) {
    const label = document.createElement("label");
    label.className = "team-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = id;
    const caption = document.createElement("span");
    caption.textContent = name;
    label.append(checkbox, caption);
    options.append(label);
  }
  const inputs = [...options.querySelectorAll("input")];
  const selectedTeams = () => inputs.filter(input => input.checked).map(input => input.value);
  const setSelection = ids => inputs.forEach(input => { input.checked = ids.includes(input.value); });
  setSelection(saved);
  const setStatus = (message) => { status.textContent = message; };
  const active = () => Boolean(registered?.length);
  const blocked = () => supported && Notification.permission === "denied";
  const changed = () => selectedTeams().slice().sort().join() !== (registered || []).slice().sort().join();

  function renderControls() {
    const subscribed = active();
    const needsPermission = supported && Notification.permission === "default";
    enable.textContent = subscribed ? (needsPermission ? "重新開啟通知" : "儲存通知選擇") : "開啟通知";
    enable.disabled = busy || !supported || blocked() || (subscribed && ((!needsPermission && !changed()) || !selectedTeams().length));
    disable.hidden = !subscribed;
    disable.disabled = busy;
    inputs.forEach(input => { input.disabled = busy; });
    if (!supported) summary.textContent = "此瀏覽器不支援網站推播。";
    else if (subscribed) {
      const channels = registered.map(id => names.get(id) || "已下架頻道").join("、");
      summary.textContent = (blocked() ? "通知權限已關閉；伺服器仍登記：" : needsPermission ? "尚未允許通知；伺服器仍登記：" : "目前訂閱：") + channels + (changed() ? "。勾選變更尚未儲存。" : "。");
    } else if (blocked()) summary.textContent = "通知權限已關閉；目前無法收件。請在裝置設定開啟後再確認訂閱。";
    else if (checkingFailed) summary.textContent = "暫時無法確認訂閱狀態。收起並重新打開設定可再查一次。";
    else if (registered && !device && saved.length) summary.textContent = "這台裝置沒有可用的通知登記。原球隊選擇已保留，可重新開啟通知。";
    else if (registered) summary.textContent = "這台裝置尚未訂閱。勾選後請點開啟通知。";
    else summary.textContent = "正在確認此裝置的訂閱狀態。";
  }

  function withTimeout(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("notification_timeout")), 10000); })])
      .finally(() => clearTimeout(timer));
  }

  function pushRequest(url, token, payload) {
    return fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": config.supabasePublishableKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
  }

  async function refreshDevice() {
    if (busy || !supported) { renderControls(); return; }
    busy = true;
    checkingFailed = false;
    registered = null;
    setStatus("只接收你在意的球隊消息。");
    renderControls();
    try {
      const registration = await withTimeout(navigator.serviceWorker.ready);
      device = await withTimeout(registration.pushManager.getSubscription());
      if (!device) registered = [];
      else {
        const token = await withTimeout(accessToken());
        if (!token) throw new Error("subscription_session_missing");
        const response = await pushRequest(config.supabaseUrl + "/rest/v1/rpc/cbl_push_read_device", token, { p_endpoint: device.endpoint });
        if (!response.ok) throw new Error("subscription_lookup_failed");
        const channels = await response.json();
        if (!Array.isArray(channels) || !channels.every(id => typeof id === "string")) throw new Error("invalid_subscription_status");
        registered = [...new Set(channels)];
      }
      if (active() && !dirty) setSelection(registered);
      if (active()) remember(registered.filter(id => names.has(id)));
    } catch (_) {
      checkingFailed = true;
    } finally {
      busy = false;
      renderControls();
    }
  }

  options.addEventListener("change", () => { dirty = true; renderControls(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !settings.hidden) refreshDevice();
  });

  function pushErrorMessage(error) {
    const code = error?.message || "";
    if (code === "permission_denied") return "通知權限被拒絕，請到瀏覽器或主畫面 App 設定中允許通知。";
    if (code === "auth_client_unavailable") return "通知登入元件尚未載入，請重新整理頁面後再試。";
    if (code === "auth_session_failed" || code === "anonymous_signin_failed") return "通知身分建立失敗，請重新整理頁面後再試。";
    if (code === "push_subscription_failed") return "無法建立瀏覽器推播訂閱，請確認通知權限後再試。";
    if (code === "subscribe_401") return "通知登入已失效，請重新整理頁面後再試。";
    if (code === "subscribe_400") return "通知資料格式不完整，請重新選擇球隊後再試。";
    if (code === "subscribe_409") return "此裝置的舊通知資料發生衝突，請重新整理後再試。";
    if (code === "subscribe_500") return "通知伺服器暫時無法寫入訂閱資料，請稍後再試。";
    if (code.startsWith("subscribe_")) return "通知伺服器回應異常（" + code.replace("subscribe_", "") + "），請稍後再試。";
    return "推播設定失敗，請重新整理頁面後再試。";
  }

  enable.addEventListener("click", async () => {
    if (busy) return;
    const teamIds = selectedTeams();
    if (!teamIds.length) return setStatus("請至少選擇一支球隊。");
    if (!config.vapidPublicKey) return setStatus("推播服務尚未設定完成，通知選擇未生效。");

    const updating = active();
    busy = true;
    renderControls();
    setStatus("正在設定通知…");
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("permission_denied");

      const registration = await withTimeout(navigator.serviceWorker.ready);
      let subscription = await withTimeout(registration.pushManager.getSubscription());
      if (!subscription) {
        try {
          subscription = await withTimeout(registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
          }));
        } catch (_) {
          throw new Error("push_subscription_failed");
        }
      }

      const token = await withTimeout(accessToken(true));
      const response = await pushRequest(config.subscribeEndpoint, token, { subscription, teamIds });
      if (!response.ok) throw new Error("subscribe_" + response.status);

      device = subscription;
      registered = teamIds;
      dirty = checkingFailed = false;
      remember(teamIds);
      setStatus((updating ? "已更新推播：" : "已開啟推播：") + teamIds.length + " 個通知頻道。");
    } catch (error) {
      setStatus(pushErrorMessage(error));
    } finally {
      busy = false;
      renderControls();
    }
  });

  disable.addEventListener("click", async () => {
    if (busy || !active()) return;
    busy = true;
    renderControls();
    setStatus("正在取消球隊推播…");
    try {
      const subscription = device;
      if (!subscription) throw new Error("subscription_missing");
      let deviceCleaned = true;
      const token = await withTimeout(accessToken());
      if (!token) throw new Error("subscription_session_missing");
      const response = await pushRequest(config.unsubscribeEndpoint, token, { endpoint: subscription.endpoint });
      if (!response.ok) throw new Error("unsubscribe_failed");
      try { deviceCleaned = await withTimeout(subscription.unsubscribe()); } catch (_) { deviceCleaned = false; }
      registered = [];
      dirty = checkingFailed = false;
      remember([]);
      setSelection([]);
      setStatus(deviceCleaned ? "已取消球隊推播。" : "已取消球隊推播，裝置端通知登記尚未清理完成。");
    } catch (_) {
      setStatus("取消尚未完成，請確認網路後再試；原球隊選擇已保留。");
    } finally {
      busy = false;
      renderControls();
    }
  });

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const rawData = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }
})();
