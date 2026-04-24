// Adsterra ad configuration
// Replace these with your real Adsterra codes when ready

export const AD_SLOTS = {
  // NOTE: Footer popunder removed — click-triggered ads break gameplay.
  // Only static display ads are used, placed in non-intrusive areas.

  // Large native / display ad — used on results, lobby, between rounds
  large: {
    scripts: [
      'https://pl29241156.profitablecpmratenetwork.com/a8c0c7f957a38d8b30939e74be60d4e2/invoke.js'
    ],
    html: '<div id="container-a8c0c7f957a38d8b30939e74be60d4e2"></div>',
    label: 'large-display'
  }
};

// Feature flag — set to false to hide all ads instantly
export const ADS_ENABLED = true;

