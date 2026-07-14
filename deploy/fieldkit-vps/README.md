# FieldKit VPS demo deployment

`fieldkit.giorgiy.org` remains the connected demo. GitHub Pages remains the static/offline mirror.

The GitHub workflow deploys an immutable release to:

```text
$FIELDKIT_VPS_PATH/releases/<git-sha>
$FIELDKIT_VPS_PATH/current -> releases/<git-sha>
```

Nginx must serve `$FIELDKIT_VPS_PATH/current` and must mount the parent directory (not only the old static directory) when it runs in Docker. This makes the `current` symlink swap visible immediately without restarting the web server.

## One-time VPS setup

Choose a non-root deployment user, for example `shepov`, and a directory such as `/srv/fieldkit`:

```bash
sudo install -d -o shepov -g shepov -m 0755 /srv/fieldkit/releases
sudo install -d -o shepov -g shepov -m 0755 /srv/fieldkit
```

Point the `fieldkit.giorgiy.org` static site root at `/srv/fieldkit/current`. The location block in [nginx-location.conf](nginx-location.conf) is suitable for inclusion in that domain's existing TLS server block.

Do not copy certificates into this deployment. TLS continues to be owned by the existing Nginx/Certbot configuration.

## GitHub configuration

In `george-shepov/FieldKit` → **Settings** → **Secrets and variables** → **Actions**, set these repository secrets:

| Secret | Value |
|---|---|
| `FIELDKIT_VPS_HOST` | VPS host name or IP |
| `FIELDKIT_VPS_USER` | deployment user, e.g. `shepov` |
| `FIELDKIT_VPS_PORT` | SSH port, normally `22` |
| `FIELDKIT_VPS_PATH` | `/srv/fieldkit` |
| `FIELDKIT_VPS_SSH_KEY` | private deploy key for that user |
| `FIELDKIT_VPS_KNOWN_HOSTS` | exact `ssh-keyscan -H <host>` output, reviewed before saving |

Set the `FIELDKIT_DEMO_URL` repository variable to `https://fieldkit.giorgiy.org` if it ever changes.

After CI succeeds on `main`, the workflow publishes the same commit to the VPS and verifies:

```text
https://fieldkit.giorgiy.org/fieldkit-release.json
```

That file contains the deployed commit, so the demo can be compared directly with GitHub Pages.
