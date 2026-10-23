const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// WHY: web replay and the feedback widget are not used (native app, no Replay/feedback integrations);
// excluding them keeps ~0.3 MB of JS out of the Hermes bundle.
module.exports = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
  includeWebFeedback: false,
});
