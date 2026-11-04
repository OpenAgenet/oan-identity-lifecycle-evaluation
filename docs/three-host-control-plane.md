# Three-Host Control Plane

Two Windows laptops (A/B) and a Linux cloud host (C) communicate over a private network. A orchestrates locally and initiates SSH connections to B/C.

## Inventory and trust

Keep addresses, usernames, key paths, verified fingerprints, and local acceptance records in ignored `.local/` files. Never publish private keys, passwords, authorization URLs, or node identities. Use the existing toolchains. Store raw evidence in ignored `runs/`.

Create a dedicated Ed25519 key on A with `ssh-keygen -t ed25519 -f <EXPERIMENT_KEY>`; first verify that the destination does not exist. Protect the private key with local ACLs and an agent/passphrase where appropriate. Never copy it to B/C.

On B, start the already installed OpenSSH server from elevated PowerShell:

```powershell
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
Get-Service sshd
Get-NetTCPConnection -LocalPort 22 -State Listen
whoami
```

If absent, install the Windows OpenSSH Server capability before these commands. Limit the inbound TCP 22 firewall rule to A's authorized address. Audit existing broader rules rather than assuming a new narrow rule supersedes them.

## Windows public-key authorization

Inspect `C:\ProgramData\ssh\sshd_config` before selecting the authorized-key path. Default administrator-group rules use `C:\ProgramData\ssh\administrators_authorized_keys`; ordinary users normally use their personal `.ssh/authorized_keys`.

Append the generated public-key line without removing existing keys. Write the file explicitly as UTF-8. For the default administrator file, use the following ACL configuration in elevated PowerShell:

```powershell
$authorizedFile = 'C:\ProgramData\ssh\administrators_authorized_keys'
$acl = [Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$admins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$acl.SetOwner($admins)
foreach ($sid in @($admins, $system)) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
}
Set-Acl -LiteralPath $authorizedFile -AclObject $acl
```

Do not apply the administrator-file policy blindly to an ordinary user's file. Verify parent-directory permissions as well.

Obtain B's host fingerprint locally using `ssh-keygen -lf C:\ProgramData\ssh\ssh_host_ed25519_key.pub`. Compare any `ssh-keyscan` candidate with that independently obtained fingerprint before adding it to an experiment-specific known-hosts file.

```powershell
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o UserKnownHostsFile='<KNOWN_HOSTS>' -i '<EXPERIMENT_KEY>' '<B_USER>@<B_ADDRESS>' whoami
```

Check the returned machine and account, not merely TCP reachability. A host-key change requires independent investigation.

## Private network

Tailscale provides routable private addresses across NAT. Authenticate all three devices into the same tailnet. Retain ordinary OpenSSH and avoid enabling an exit node, subnet routing, or DNS takeover.

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' set --accept-dns=false --accept-routes=false
& 'C:\Program Files\Tailscale\tailscale.exe' status
& 'C:\Program Files\Tailscale\tailscale.exe' ip -4
```

On Linux, use the official repository matching the installed distribution if installation is necessary. Preserve existing services and SSH sessions. Authorize the device interactively; do not save temporary login URLs in Git.

Check `tailscale netcheck`, `tailscale status`, and repeated `tailscale ping` in all six directions. Distinguish direct connections from DERP relay paths. The original cloud configuration needed inbound UDP 41641, matching the actual tailscaled listener. Restrict cloud ingress to authorized public source addresses and inspect both security groups and host firewalls. Public egress changes require rule review.

Permit business-service ports only between the required peers. Do not change production listeners. Tailnet routing and its access policies must be checked separately from public security groups.

## Remote execution and acceptance

Pin C's existing verified SSH identity as well; do not overwrite its authorization files. When B has both LAN and private-network addresses, a verified HostKeyAlias may bind both to the same trusted key.

Explicitly invoke PowerShell on Windows. Encode remote commands with UTF-16LE Base64 for `powershell -NoProfile -NonInteractive -EncodedCommand`; this transport requirement does not change UTF-8 file encoding. Probe `whoami`, workspace access, Git, Node, Rust/Cargo, and the actual Python executable. Record versions rather than assuming identical installations.

Before measurement, record hardware, source commits, binary hashes, toolchains, clock estimates, network paths, and background-resource observations. Use the driver monotonic clock for elapsed durations.

After network setup, check service health, submit a signed registration and verify its results at both Discoveries. See [deployment and workload](three-host-experiment-plan.md).

Cleanup only owned experiment tasks, services, ports, and data. Remove only the dedicated key line when revoking access; preserve unrelated keys, production SSH, and other services.
