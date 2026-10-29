(function () {
  'use strict';
  const C = window.MEMO_CLOUD_CONFIG || {};
  const PUBLIC_KEY = 'BORD9ldzvbFp6npi4D7cB_uioTI6htJhwuyW28fFXYGWTargra67968E1zm9ulamEq_hBnRbScES2FHCZo8SWRo';
  const FUNCTION_URL = (C.url || '').replace(/\/$/, '') + '/functions/v1/memo-push';
  const UI_ID = 'memo-push-controls';

  function setStatus(text, isError) {
    const status = document.getElementById('memo-push-status');
    if (status) { status.textContent = text; status.style.color = isError ? '#ae2834' : '#667085'; }
  }
  function decodeKey(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  async function session() {
    for (let i = 0; i < 40 && !window.MEMO_AUTH_CLIENT; i++) await new Promise(resolve => setTimeout(resolve, 250));
    const client = window.MEMO_AUTH_CLIENT;
    if (!client) throw new Error('로그인 연결이 아직 준비되지 않았어요. 페이지를 새로고침해 주세요.');
    const result = await client.auth.getSession();
    if (!result.data || !result.data.session) throw new Error('먼저 Google 계정으로 로그인해 주세요.');
    return result.data.session;
  }
  async function call(action, extra) {
    const current = await session();
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { apikey: C.anonKey, Authorization: 'Bearer ' + current.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, extra || {}))
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || ('서버 응답 오류 (' + response.status + ')'));
    return result;
  }
  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('이 브라우저는 웹 푸시를 지원하지 않아요.');
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('브라우저 알림 권한을 허용해 주세요.');
    }
    if (Notification.permission !== 'granted') throw new Error('브라우저 알림 권한이 차단되어 있어요.');
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) registration = await navigator.serviceWorker.register(new URL('sw.js', location.href).href);
    registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(PUBLIC_KEY) });
    await call('subscribe', { subscription: subscription.toJSON() });
    setStatus('이 기기의 닫힌 상태 알림이 등록됐어요.', false);
    const testButton = document.getElementById('memo-push-test');
    if (testButton) testButton.disabled = false;
  }
  async function testPush() {
    const result = await call('test');
    setStatus('테스트 푸시를 보냈어요. 잠시 뒤 알림을 확인해 주세요.', false);
    return result;
  }
  function mount() {
    const toolbar = document.getElementById('aside-cloud-toolbar');
    if (!toolbar || document.getElementById(UI_ID)) return;
    const wrap = document.createElement('span');
    wrap.id = UI_ID;
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    wrap.style.flexWrap = 'wrap';
    const enable = document.createElement('button');
    enable.type = 'button';
    enable.textContent = '닫힌 상태 알림 켜기';
    enable.addEventListener('click', async function () {
      enable.disabled = true;
      setStatus('알림 권한과 서버 등록을 확인하고 있어요.', false);
      try { await subscribe(); enable.textContent = '알림 구독됨'; }
      catch (error) { setStatus(error.message || '알림 등록에 실패했어요.', true); }
      finally { enable.disabled = false; }
    });
    const test = document.createElement('button');
    test.id = 'memo-push-test';
    test.type = 'button';
    test.textContent = '푸시 테스트';
    test.disabled = true;
    test.addEventListener('click', async function () {
      test.disabled = true;
      try { await testPush(); }
      catch (error) { setStatus(error.message || '테스트 푸시에 실패했어요.', true); }
      finally { test.disabled = false; }
    });
    const status = document.createElement('span');
    status.id = 'memo-push-status';
    status.setAttribute('role', 'status');
    status.style.fontSize = '12px';
    status.textContent = typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '알림 권한 허용됨 · 이 기기 등록 필요' : '브라우저를 닫아도 알림 받기';
    wrap.append(enable, test, status);
    toolbar.append(wrap);
  }
  if (document.body) new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  mount();
  document.addEventListener('DOMContentLoaded', mount);
  let tries = 0;
  const mountTimer = setInterval(function () { mount(); if (document.getElementById(UI_ID) || ++tries > 20) clearInterval(mountTimer); }, 500);
})();
