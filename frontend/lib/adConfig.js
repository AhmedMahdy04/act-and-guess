export const ADS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADS === 'true';
export const AD_IFRAME_DOCUMENT = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Advertisement</title></head><body>
<div id="container-a8c0c7f957a38d8b30939e74be60d4e2"></div>
<script async data-cfasync="false" src="https://pl29241156.profitablecpmratenetwork.com/a8c0c7f957a38d8b30939e74be60d4e2/invoke.js"></script>
</body></html>`;

const PREFERENCE_KEY = 'guess_game_ads_preference';
let pagePreference = null;

export function getAdPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY);
  } catch {
    return pagePreference;
  }
}

export function saveAdPreference(preference) {
  pagePreference = preference;
  try {
    window.localStorage.setItem(PREFERENCE_KEY, preference);
  } catch {
    // Use this page's choice if the browser blocks storage.
  }
  window.dispatchEvent(new Event(PREFERENCE_KEY));
}

export function subscribeToAdPreference(listener) {
  window.addEventListener(PREFERENCE_KEY, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(PREFERENCE_KEY, listener);
    window.removeEventListener('storage', listener);
  };
}
