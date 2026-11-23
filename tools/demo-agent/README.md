# Demo agent (landing-page screenshots)

Produces the real app screenshots in `public/assets/screens/` without showing personal data or using Claude quota.

- `make-shop.sh` builds a demo web project at `~/Workspace/shop` (git history, a tag, an upstream, uncommitted "promo code" changes).
- `agent.mjs` is a mock Rift agent on `ws://127.0.0.1:7979/ws`. It proxies everything to the real agent (git, diffs, services, Chrome preview, simulator/emulator video) and fakes only the chat transcript, plan usage, project list, Mac name and account. On first run it pairs itself with the real agent as "Rift demo (screenshots)".
- `tap.mjs` taps/types/drags on a simulator through the agent (`node tap.mjs <deviceId> 0.5,0.9 text:hi drag:0.5,0.3,0.5,0.7`).
- `rpc.mjs` sends one RPC (`node rpc.mjs services.start '{"project":"…/shop","name":"web"}'`).

## Retake

```bash
npm install && ./make-shop.sh
node agent.mjs                                  # note the device id it prints
cd ~/Workspace/rift/app && flutter run -d <iPhone simulator id>
xcrun simctl status_bar <id> override --time 9:41 --batteryState charged --batteryLevel 100
# In the app's pair screen, paste: rift://pair?host=127.0.0.1:7979&code=DEMO
# Deep link to the project: xcrun simctl openurl <id> "rift://w/<url-encoded ~/Workspace/shop>/chat"
xcrun simctl io <id> screenshot shot.png
sips -s format jpeg -s formatOptions 82 -Z 1310 shot.png --out ../../public/assets/screens/<name>.jpg
```

Afterwards: `rift revoke <device id>`, delete `.token`, and `rm -rf ~/Workspace/shop` if you like.

## Anthropic policy (keep screenshots compliant)

- No plan name or plan usage in shots: the mock hides them by default (`DEMO_SHOW_PLAN=1` brings them back for internal testing only).
- Don't show Claude Code's mascot or logo: the app's chat avatar must be masked in any chat screenshot.
- Wording on the site: "runs Claude Code" in plain text only; no subscription, plan or "no API key" claims until Anthropic Sales approves.
  Sources: code.claude.com/docs/en/legal-and-compliance and code.claude.com/docs/en/agent-sdk/overview.
