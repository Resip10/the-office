// Ad-hoc signs the macOS app (no Apple Developer ID). Unsigned Apple Silicon builds are reported
// as "damaged" by Gatekeeper; ad-hoc signed ones get the normal "Open Anyway" prompt instead.
// electron-builder 25 has no ad-hoc identity option, so this runs as its afterSign hook.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
