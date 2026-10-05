// Public settings. The Clerk publishable key is designed to be public (the secret key never goes here).
// Leave clerkPublishableKey empty to run without sign-in (e.g. local testing).
window.GOLD_CONFIG = {
  // LINE Official Account "add friend" link (https://lin.ee/...) for the morning plan; empty hides the button
  lineAddFriendUrl: 'https://line.me/R/ti/p/@279arudw',
  // Web push public key (VAPID) — set by `node scripts/setup-push.js`; empty hides the notification switch
  vapidPublicKey: '',
  clerkPublishableKey: 'pk_test_ZGVsaWNhdGUtdGFwaXItMjEwMS5jbGVyay5hY2NvdW50cy5kZXYk',
};
