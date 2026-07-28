# Tasks

## 1. Prepare

- [ ] Fresh independent OpenSpec change review approves the revised artifacts before verification
- [ ] Confirm `decide-tailnet-ipv6-policy` is archived; boundary checks below follow its ratified policy
- [ ] Confirm a working tailnet across the dev machine and a second device
- [ ] Start the daemon with `--bind tailscale` and confirm it detects the interface
- [ ] Confirm the printed pair URL carries the Tailscale hostname, not loopback
- [ ] Record the deployed SPA origin scheme and agent URL scheme; confirm the browser can fetch that agent URL without a mixed-content exception, disabled security control, or development-only browser flag
- [ ] If an HTTPS SPA can reach only a plain-HTTP daemon URL, record a blocking product defect and do not continue to successful-verification or archive claims

## 2. Verify pairing and rendering

- [ ] Pair the second device via the one-click URL
- [ ] Confirm the SPA accepts the Tailscale hostname as a valid agent URL
- [ ] Confirm the fleet surface renders every registered project from the second device
- [ ] Confirm repo detail and workflow surfaces each render and refresh from the second device; include the agent-change surface only if one has shipped by then (`add-agent-board` was withdrawn on 2026-07-28)
- [ ] Confirm pairing the second browser does not invalidate the first browser's stored pairing
- [ ] Clear only one browser's local-storage pairing entry and confirm the other browser remains paired
- [ ] Inspect daemon state and confirm pairing creates no device roster or per-device revocation record
- [ ] Take one browser offline, rotate the token, and confirm it receives the re-pair prompt on its first request after returning
- [ ] Re-share a fresh one-click URL after rotation and confirm both browsers can pair again

## 3. Verify the boundary holds

- [ ] Confirm a client outside the Tailscale CIDR is rejected
- [ ] Confirm `--no-enforce-cidr` is required to bypass it, and is not the default
- [ ] Confirm address-family behaviour and documented workaround match the ratified `decide-tailnet-ipv6-policy`
- [ ] Confirm CIDR decisions use the raw socket address and ignore forwarding headers
- [ ] With controlled known socket-address inputs, confirm rejection diagnostics record the expected internal class and correlation identifier without retaining the peer address or changing the public response
- [ ] Confirm token rotation from the dev machine surfaces the re-pair prompt on the second device

## 4. Record

- [ ] Record the evidence, including device, tailnet, and daemon version
- [ ] Spin unrelated defects out; if the added multi-device requirement is false, do not archive until it is corrected or made true
