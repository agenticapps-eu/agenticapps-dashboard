# Tasks

## 1. Prepare

- [ ] Confirm a working tailnet across the dev machine and a second device
- [ ] Start the daemon with `--bind tailscale` and confirm it detects the interface
- [ ] Confirm the printed pair URL carries the Tailscale hostname, not loopback

## 2. Verify pairing and rendering

- [ ] Pair the second device via the one-click URL
- [ ] Confirm the SPA accepts the Tailscale hostname as a valid agent URL
- [ ] Confirm the home page renders every registered project from the second device
- [ ] Confirm a single-project view renders fully, including panels that spawn subprocesses

## 3. Verify the boundary holds

- [ ] Confirm a client outside the Tailscale CIDR is rejected
- [ ] Confirm `--no-enforce-cidr` is required to bypass it, and is not the default
- [ ] Confirm token rotation from the dev machine surfaces the re-pair prompt on the second device

## 4. Record

- [ ] Record the evidence, including device, tailnet, and daemon version
- [ ] Spin any defect out into its own change
