# Personal editions

The API's optional `MXTAPE_MARTIN_EDITION_EMAIL` setting selects the gift edition
for one approved account. Leave it empty to disable it. `/api/session` and
`/api/me` expose `edition: "martin" | null`; the browser never selects an edition
from a display name or a URL. Pending accounts do not receive the edition.

The inline opening card and decorative background run only on the selected
account's device. There is no login popup. A photo-based classic 911 designer
sketch replaces the former generic SVG; its pen strokes are extracted from transparent grayscale and tinted to the
edition's gold in both themes, preserving the light gaps in the wheels. Its ink builds up once when the card appears.
The email sign-in returns this account to the top of its opening card.

They do not change game rules, room snapshots, TV displays or exported result
pictures. Reduced motion disables sketch reveals and rotating word details.
The settings page has an additional “Von Martin für Martin” dedication sleeve:
its sketch, light sweep and staggered lettering replay on every visit, then
settle into a static banner.

In `/opt/mxtape-api/.env`, set `MXTAPE_MARTIN_EDITION_EMAIL` to the intended address,
then restart the API after deploying. Remove the setting and restart to disable
the edition without changing or deleting the account.

## Operator provisioning

No public provisioning endpoint is provided. On the server, run as the service
user from `/opt/mxtape-api`:

```sh
sudo -u mxtape .venv/bin/python -m app.provision_account ADDRESS --name NAME
```

The password prompt does not echo. `--password-stdin` accepts a single line from
a secure pipe for remote provisioning. Never pass a password as an argument,
commit it, or put it in a deployment log. Use a SQLite online backup before
changing a live account, also as the service user (including WAL files).

Provisioning creates or updates the account, confirms its email, approves access,
stores the normal scrypt password hash and revokes old sessions. Existing
history, settings, achievements and linked Google identity are preserved. It
sends no mail. It refuses ambiguous duplicate addresses. An address configured
as an administrator retains the normal administrator policy; provisioning does
not itself grant administrator privileges.
