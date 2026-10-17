/*
 * 잉크저택 서비스워커 — 교실 와이파이가 끊겨도 수업이 멈추지 않게 한다.
 *
 * 전략:
 *  - 앱 셸(HTML/JS/CSS): stale-while-revalidate. 네트워크가 되면 갱신, 안 되면 캐시로 진행.
 *  - 에셋(이미지/오디오): cache-first. 한 번 받은 배경·캐릭터는 다시 받지 않는다.
 *  - 학생 글은 localStorage 에 있으므로 서비스워커와 무관하게 보존된다.
 */
const VERSION = 'ink-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

// 첫 화면에 반드시 필요한 것만 미리 받는다. 뒷 단계 배경까지 받으면 첫 로딩이 느려진다.
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined) // 한 파일이 없어도 설치를 막지 않는다
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// glb(3D 단서)도 cache-first — 개당 20MB 라 두 번 받게 하면 교실 와이파이가 죽는다
const isAsset = (url) => /\.(webp|png|jpg|svg|mp3|ogg|woff2?|glb)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 외부 요청은 건드리지 않는다

  if (isAsset(url)) {
    // cache-first
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request)
            .then((res) => {
              if (res.ok) {
                const copy = res.clone();
                caches.open(ASSETS).then((c) => c.put(request, copy));
              }
              return res;
            })
            .catch(() => hit ?? Response.error()),
      ),
    );
    return;
  }

  // 앱 셸: stale-while-revalidate + 오프라인 시 index.html 로 폴백
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit ?? caches.match('./index.html').then((f) => f ?? Response.error()));
      return hit ?? net;
    }),
  );
});
