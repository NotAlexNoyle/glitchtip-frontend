# Marketing hero stills

Shoots the two homepage hero images (the issue list and a tall issue detail)
from a running GlitchTip frontend against the local "Acme Shop" demo org. The
hero animates them with CSS, so there is no video, cursor or loading state.

1. Serve the frontend you want to show (current master plus any design MRs),
   proxied to the local backend.
2. Mint a session cookie for the dev user (cache session engine) and save it.
3. `OUT=stills SID=<sessionid> PWE=<chrome-headless-shell> node shoot.mjs`
4. `./encode.sh stills out 1900` writes hero-list and hero-detail as AVIF and
   WebP.
5. Copy them into `projects/marketing/public/assets/home/`.

The shooter freezes the browser clock just after the demo seed, hides issues
newer than that, and fills trend bars with fixed demo shapes. If the list
layout changes, re-measure `.hero3__hover` in `home.component.scss` so it
still sits over the top row.
