<div align="center">

<a href="https://mxtape.celox.io"><img src="docs/banner.png" alt="mxtape — Hear it. Date it. Place it. · mxtape.celox.io" width="100%"></a>

# 📼 mxtape

[English](README.md) · **Deutsch**

**Das Musik-Zeitleistenspiel für eure Runde: Song hören, Jahr raten, an die richtige Stelle der Zeitleiste legen – auf einem Handy, das herumgeht, oder jede:r auf dem eigenen Gerät, im selben Raum oder quer durch die Stadt.**

<p>
  <a href="https://mxtape.celox.io"><img alt="Spielen: mxtape.celox.io" height="56" src="https://img.shields.io/badge/%E2%96%B6%EF%B8%8F_Spielen-mxtape.celox.io-C2185B?style=for-the-badge"></a>
</p>

<h3>👉 <a href="https://mxtape.celox.io">mxtape.celox.io</a> — mit Google oder E-Mail anmelden oder als Gast nur per Link in den Raum von Freunden</h3>

<p>Neu hier? <a href="https://mxtape.celox.io/about"><b>mxtape.celox.io/about</b></a> stellt das Spiel vor und beantwortet die häufigen Fragen – mit einer kleinen Zeitleiste zum Ausprobieren, ganz ohne Konto.</p>

<!-- BADGES:BIG — version, tests, lines of code and songs; readme.test.ts keeps them true, scripts/readme-badges.mjs rewrites them. -->
[![version](https://img.shields.io/badge/version-0.28.8-C2185B?style=for-the-badge&logo=semver&logoColor=white)](https://github.com/pepperonas/mxtape/releases/latest)
[![tests](https://img.shields.io/badge/tests-1182-2E9E5B?style=for-the-badge&logo=vitest&logoColor=white)](#tests-und-ci)
[![lines of code](https://img.shields.io/badge/lines%20of%20code-33.2k-4B6BDF?style=for-the-badge&logo=typescript&logoColor=white)](pwa/src)
[![test code](https://img.shields.io/badge/test%20code-14.0k-2E9E5B?style=for-the-badge&logo=typescript&logoColor=white)](#tests-und-ci)
[![songs](https://img.shields.io/badge/songs-800-FF8A3D?style=for-the-badge&logo=applemusic&logoColor=white)](#die-songsammlung)

[![Donate with PayPal](https://img.shields.io/badge/PayPal-support%20this%20project-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.com/donate/?business=martin.pfeffer@celox.io&currency_code=EUR&item_name=mxtape)

</div>

<!-- Project status — the GitHub badges are live and update themselves. -->

[![CI](https://img.shields.io/github/actions/workflow/status/pepperonas/mxtape/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/pepperonas/mxtape/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/pepperonas/mxtape?color=C2185B&logo=github&logoColor=white)](https://github.com/pepperonas/mxtape/releases/latest)
[![Release date](https://img.shields.io/github/release-date/pepperonas/mxtape?color=C2185B&logo=github&logoColor=white)](https://github.com/pepperonas/mxtape/releases/latest)
[![Last commit](https://img.shields.io/github/last-commit/pepperonas/mxtape?logo=git&logoColor=white)](https://github.com/pepperonas/mxtape/commits/main)
[![Commit activity](https://img.shields.io/github/commit-activity/m/pepperonas/mxtape?logo=git&logoColor=white)](https://github.com/pepperonas/mxtape/commits/main)
[![Code size](https://img.shields.io/github/languages/code-size/pepperonas/mxtape?logo=files&logoColor=white)](#aufbau)
[![Top language](https://img.shields.io/github/languages/top/pepperonas/mxtape?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Open issues](https://img.shields.io/github/issues/pepperonas/mxtape?logo=github&logoColor=white)](https://github.com/pepperonas/mxtape/issues)
[![Stars](https://img.shields.io/github/stars/pepperonas/mxtape?logo=github&logoColor=white)](https://github.com/pepperonas/mxtape/stargazers)
[![License](https://img.shields.io/github/license/pepperonas/mxtape?color=blue)](LICENSE)
[![Made by celox.io](https://img.shields.io/badge/made%20by-celox.io-C2185B)](https://celox.io)

<!-- Frontend -->

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Motion](https://img.shields.io/badge/Motion-springs-FFF312?logo=framer&logoColor=black)](https://motion.dev)
[![React Router](https://img.shields.io/badge/React%20Router-7-CA4245?logo=reactrouter&logoColor=white)](https://reactrouter.com)
[![Howler](https://img.shields.io/badge/Howler.js-HTML5%20audio-FF8A3D)](https://howlerjs.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](#installieren)
[![Material 3 Expressive](https://img.shields.io/badge/Material%203-Expressive-C2185B?logo=materialdesign&logoColor=white)](#design)
[![Languages](https://img.shields.io/badge/Languages-Deutsch%20%C2%B7%20English-4285F4?logo=googletranslate&logoColor=white)](#funktionen)
[![Roboto Flex](https://img.shields.io/badge/Type-Roboto%20Flex%20self--hosted-4285F4?logo=googlefonts&logoColor=white)](#design)

<!-- Backend & realtime -->

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2-D71F00?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-live%20rooms-010101?logo=socketdotio&logoColor=white)](#mehrspieler)
[![Google sign-in](https://img.shields.io/badge/Google-OAuth%20%2B%20PKCE-4285F4?logo=google&logoColor=white)](#zugang)
[![nginx](https://img.shields.io/badge/nginx-auth__request%20audio%20gate-009639?logo=nginx&logoColor=white)](#so-funktionierts)

<!-- Engineering practice -->

[![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Testing Library](https://img.shields.io/badge/Testing%20Library-React-E33332?logo=testinglibrary&logoColor=white)](https://testing-library.com)
[![pytest](https://img.shields.io/badge/pytest-server-0A9EDC?logo=pytest&logoColor=white)](https://pytest.org)
[![Conventional Commits](https://img.shields.io/badge/Commits-Conventional-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-303030?logo=semver&logoColor=white)](https://semver.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

<!-- What makes it fun -->

[![Modes](https://img.shields.io/badge/modes-own%20%C2%B7%20shared%20%C2%B7%20hardcore-C2185B)](#spielmodi)
[![Objection](https://img.shields.io/badge/Objection-steal%20the%20card-C2185B)](#spielmodi)
[![Multiplayer](https://img.shields.io/badge/multiplayer-own%20devices%2C%20up%20to%2010-FF8A3D)](#mehrspieler)
[![Guests](https://img.shields.io/badge/guests-join%20by%20link%2C%20no%20account-FF8A3D)](#mehrspieler)
[![Bots](https://img.shields.io/badge/bots-easy%20%C2%B7%20medium%20%C2%B7%20hard-795548)](#spielmodi)
[![Achievements](https://img.shields.io/badge/achievements-50-FFB74D)](#funktionen)
[![Tiebreak](https://img.shields.io/badge/draws-never%2C%20there%E2%80%99s%20a%20tiebreak-B71C1C)](#spielmodi)

<!-- What mxtape deliberately does not do -->

[![No Spotify](https://img.shields.io/badge/Spotify-not%20used-2E7D32?logo=spotify&logoColor=white)](#die-songsammlung)
[![No ads](https://img.shields.io/badge/Ads-none-2E7D32)](#grundsätze)
[![No third-party trackers](https://img.shields.io/badge/third--party%20trackers-none-2E7D32)](#grundsätze)
[![No physical cards](https://img.shields.io/badge/cards-virtual%20only-2E7D32)](#grundsätze)


> **Welches Jahr?**

mxtape ist ein privates Musikspiel für Gruppen. Eine Platte dreht sich, ein Song läuft, und wer dran ist, legt ihn in die eigene Zeitleiste – vor 1983? zwischen 1983 und 2008? Das Jahr kommt erst ans Licht, wenn die Karte liegt. Richtig gelegt, bleibt sie liegen; falsch gelegt, kann sie sich jemand anderes per Einspruch holen.

Es läuft als installierbare Web-App mit einer Oberfläche in **Material 3 Expressive** rund um ein einziges Erkennungszeichen: eine Schallplatte, die sich dreht, solange der Song läuft, und nach dem Aufdecken das Jahr auf ihrem Label zeigt.

---

## Inhalt

- [Screenshots](#screenshots)
- [Zugang](#zugang)
- [Spielmodi](#spielmodi)
- [Mehrspieler](#mehrspieler)
- [Funktionen](#funktionen)
- [Die Songsammlung](#die-songsammlung)
- [Design](#design)
- [Installieren](#installieren)
- [Entwicklung](#entwicklung)
- [Technik](#technik)
- [Aufbau](#aufbau)
- [Tests und CI](#tests-und-ci)
- [So funktioniert's](#so-funktionierts)
- [Deployment](#deployment)
- [Grundsätze](#grundsätze)
- [Fehlerbehebung](#fehlerbehebung)
- [Ausblick](#ausblick)
- [Entwickler](#entwickler)
- [Spenden](#spenden)
- [Lizenz](#lizenz)

---

## Screenshots

<img src="docs/screenshots/mockups.jpg" alt="Startseite mit der Neues-Spiel-Hülle, eine Karte zwischen 2008 und 2020 einordnen, das Aufdecken mit Cover und Anekdote, ein Mehrspieler-Raum mit QR-Code und das Jahrzehnt-Profil in der Statistik" width="100%">

<sub>Einzelne Bildschirme liegen in <a href="docs/screenshots">docs/screenshots</a>.</sub>

---

## Zugang

mxtape ist eine private App. Man meldet sich mit einem Google-Konto oder mit E-Mail und Passwort an (die Adresse wird vorher per Link bestätigt); neue Konten landen auf einer Warteliste und werden einzeln freigeschaltet. Wer als Gast eine Online-Runde gespielt hat, bekommt am Ende ein eigenes Konto angeboten. Erst danach sind Spiel und Musik erreichbar – auch die Musikdateien liefert der Server nur an freigeschaltete Sitzungen aus.

Die Produkt- und Hilfeseite **[/about](https://mxtape.celox.io/about)** (auch unter `/landing` und `/help`) ist wie die Rechtstexte für alle offen.

Die andere Ausnahme: **Gäste in einem Raum.** Wer einen Raum-Link öffnet, gibt einen Namen ein und spielt mit, ganz ohne Konto, solange der Raum offen ist.

## Spielmodi

| Modus | Ziel |
|-------|------|
| **Eigene Zeitleiste** | Jede:r baut eine eigene Zeitleiste. Wer zuerst die Zielzahl an Songs richtig liegen hat, gewinnt. |
| **Gemeinsame Zeitleiste** | Alle legen an dieselbe Zeitleiste. Sobald die Zielzahl erreicht ist, gewinnt, wer die meisten Karten gelegt hat. |
| **Hardcore** | Titel (+5), Interpret (+5) und Jahr (+5 exakt, +2 bei einem Jahr daneben, +1 bei zwei) raten. Wenn alle die Zielzahl an Songs gespielt haben, gewinnt die höchste Punktzahl. |

Vor jeder Runde legt ihr fest:

- **Länge:** kurz (5 Songs), normal (10) oder lang (15).
- **Jahrzehnte:** alle oder nur bestimmte, etwa nur 80er und 90er. Gehen deren Songs aus, kommen die übrigen dazu, damit die Runde nie stehen bleibt.
- **Musikrichtung und Auswahl:** Pop, Rock, Soul & R&B, Hip-Hop, Elektro, Sonstiges – und eine Auswahl: alle Songs, *Party-Klassiker*, *Deutschsprachig* oder *Eure Angstgegner* (die Songs, die bei euch schon falsch lagen, ab zehn Stück).
- **Bonus für Titel und Interpret** (Zeitleisten-Modi): Die Karte bleibt verdeckt, ihr hört nur. Wer beim Legen Titel und Interpret richtig nennt, bekommt einen Joker (höchstens drei); damit tauscht man einen Song, den man nicht legen will.
- **Einspruch** (Zeitleisten-Modi): Jede:r hat drei. Nach dem Legen bleibt die Karte verdeckt, und wer anderer Meinung ist, legt sie in eine andere Lücke. Lag die Person am Zug falsch und der Einspruch richtig, bekommt die Einspruch-Person die Karte. Ein Einspruch kostet immer einen der drei.
- **Exoten:** standardmäßig aus. Eingeschaltet kommen kaum bekannte Club-Tracks, Remixe und Raritäten dazu.
- **Teams** (ab vier Personen): Ein Team teilt sich Zeitleiste, Punkte und Einsprüche, die Mitglieder wechseln sich ab.

Songs aus euren letzten Runden kommen erst wieder, wenn nichts Neues mehr übrig ist; Songs starten dort, wo man sie erkennt (Stille und leise Intros werden übersprungen). **Unentschieden gibt es nicht:** Liegen am Ende mehrere vorne, folgt ein Stechen – nur sie spielen weiter, je ein Song pro Runde, bis genau eine:r führt. Allein? Dann spielen bis zu drei Bots (leicht, mittel, schwer) gegen dich.

## Mehrspieler

Statt ein Handy herumzureichen, spielt jede Person auf dem eigenen Gerät – im selben Raum oder jede:r bei sich zu Hause.

- **Raum öffnen:** Im Spielaufbau „Jeder sein Gerät“ wählen. Es gibt einen Link, einen QR-Code und einen Raumcode zum Abtippen.
- **Ohne Konto dabei:** Gäste geben nur einen Namen ein und spielen mit. Für sie wird nichts gespeichert; die Musik hören sie, solange der Raum offen ist.
- **Kein endloses Warten:** Online hat jeder Schritt ein Zeitlimit (ziehen 30 s, legen bis 30 s nach Songende, weiter 20 s); danach handelt das Spiel für den Spieler, nie der Host nach Belieben.
- **Einspruch online:** Nach dem Legen tippt jeder, der widersprechen darf, *Einspruch* oder *Kein Einspruch*; sonst deckt die Karte nach 10 Sekunden von selbst auf. Niemand kann für die anderen vorzeitig aufdecken.
- **Musik:** *Gemeinsam im Raum* – nur das Gerät dessen, der gerade dran ist, spielt (fällt es aus, übernimmt der Gastgeber), kein Echo. *Jeder bei sich* – alle Geräte spielen gleichzeitig (gemessen rund 20 ms auseinander).
- **Spielen:** Wer dran ist, legt oder rät auf dem eigenen Gerät, alle anderen sehen live mit und legen vom eigenen Handy Einspruch ein. Neu laden oder kurz offline gehen kostet nichts – jede:r kommt auf den eigenen Platz zurück.
- **Bots mit eigener Stärke:** Jeder Bot bekommt leicht, mittel oder schwer und würfelt zu Beginn jeder Runde seine Tagesform – ganz selten schlägt ein leichter Bot einen schweren (etwa eine Runde von hundert), ein mittlerer etwas öfter
- **TV-Modus:** In jeder Runde – auch an einem Handy – oben aufs Fernseher-Symbol tippen, dann auf dem Fernseher **mxtape.celox.io/tv** öffnen und den Code eintippen (mit Tablet oder Laptop geht auch der QR-Code). Der Fernseher zeigt die Runde groß, bleibt an und spielt die Musik; Play und Pause bleiben am Handy. Geht jederzeit, auch mitten in der Runde.
- **Bots und Teams online:** Der Gastgeber füllt die Runde mit bis zu drei Bots auf (sie spielen auf seinem Gerät) oder lost die Mitspielenden in Teams; Teammitglieder sind reihum dran, jede:r auf dem eigenen Handy.
- **Akku vom Gastgeber leer?** Nach 30 Sekunden kann jedes Konto im Raum das Spiel übernehmen; die Runde läuft auf dessen Gerät weiter.
- **Freunde:** Andere Konten per Name oder E-Mail suchen, als Freunde hinzufügen und direkt aus dem Raum einladen; die Einladung erscheint auf ihrer Startseite.
- Am Ende landet die Runde im Verlauf aller Mitspielenden mit Konto.

## Funktionen

- **800 Songs** von den 50ern bis heute, selbst gehostet, auf Wunsch mit zufälliger Startstelle
- **Tagesrunde:** jeden Tag dieselben Songs für alle, bis die erste Karte danebenliegt; die längste Serie unter deinen Freunden gewinnt den Tag. Ein Versuch: pausieren und auf jedem Gerät weiterspielen geht, neu starten nicht. Danach ausgewählten Freunden per Mail Bescheid geben (die das im Profil abbestellen können)
- **Ergebnis teilen** als Bild (WhatsApp und Co.) direkt vom Endbildschirm
- **Song melden** nach dem Aufdecken (falsches Jahr, falsche Version, schlechter Ton, falsches Cover); der Admin korrigiert das Jahr oder nimmt den Song heraus – sofort für alle Runden
- **Aufdecken mit Hintergrund:** Album-Cover groß im Vordergrund, Albumname und ein kurzes „Wusstest du?“
- **Doppeltipp kopiert:** Doppeltipp auf eine aufgedeckte Karte der Zeitleiste legt „Interpret – Titel“ in die Zwischenablage
- **Danke sagen:** am Ende der Startseite – Code auf GitHub ansehen, per PayPal spendieren oder auf Google Maps bewerten, jede Kachel mit eigener kleiner Animation
- **Übersichtliche Navigation:** fünf Ziele – Spielen, Rückblick (Runden und Statistik), Songs, Erfolge, Leute (Spieler und Freunde) – und alle Einstellungen mit einem Tipp hinter dem Zahnrad; auf breiten Bildschirmen zeigt die Seitenleiste ihre Beschriftungen
- **Mit Code beitreten:** den Raum-Code eintippen statt den Link zu öffnen
- **Alle zusammen:** die Statistik zeigt auch die Summen der ganzen Gruppe – Runden pro Tag, Modi, den Katalog nach Jahren, die Songs, an denen alle scheitern, die seltensten Erfolge; ohne Namen und ohne Uhrzeiten
- **Alle Songs:** den ganzen Katalog als Cover oder Liste durchstöbern, nach Jahr, Titel, Interpret, Album, Neuheit oder eurer Trefferquote sortieren, nach Jahrzehnt, Musikrichtung und Auswahl filtern und mit Tippfehler-Toleranz suchen („gronemeier“, „ac dc“, „queen 80er“); jeder Song öffnet sich mit Cover, Anekdote, 30 Sekunden zum Anhören und Kopieren-Knopf
- **Sofort sichtbar, wohin die Karte kommt:** Die Nachbarjahre leuchten auf, eine Positionsleiste zeigt `2008 — ? — 2020` in der Plakatschrift
- **Eine laufende Runde übersteht Neuladen** oder einen geschlossenen Tab und wird auf der Startseite angeboten
- **Farbe wählbar:** fünf Farben (Vinyl, Ozean, Lagune, Amethyst, Moos), jeweils hell und dunkel, alle auf Kontrast geprüft
- **Zurück führt zurück:** keine gestapelten Seiten, die Leiste springt immer zur Startseite zurück
- **Bots hören erst zu:** 3–6 Sekunden, bevor sie legen; das Lied läuft danach weiter
- **Einstellungen überstehen Neuladen:** Modus, Ziel, Jahrzehnte, Themen, Einspruch und Bonus bleiben gesetzt, in der Lobby auch Bots und Teams
- **Cover überall:** auf jeder aufgedeckten Karte der Zeitleiste, aufgefächert im Verlauf, als Raster im Rundendetail, verschwommen hinter dem Ergebnis und im Teilbild
- **Cover beim Aufdecken:** Das Album-Cover kommt groß nach vorne, mit dem Jahr darauf, die Platte gleitet dahinter heraus, die Farbe des Covers leuchtet hinter dem Plattenspieler
- **Admin-Statistik:** Nutzung (aktive Konten und Runden pro Tag, neue Konten, Uhrzeit, Wochentag), Spielweise, Katalog über die Jahre, am häufigsten falsch eingeordnete Songs, häufigste und seltenste Erfolge — nur Summen
- **Online-Erfolge für alle:** Mitspieler mit Konto sehen ihre Freischaltungen auf dem eigenen Gerät und sammeln sie im eigenen Konto
- **Nochmal mit denselben Leuten:** Wer zuletzt kam, fängt die nächste Runde an
- **Fehlertolerante Antworten** für Titel und Interpret, im Hardcore und beim Bonus: Tippfehler je nach Länge, Groß- und Kleinschreibung, andere Schreibweisen („und“ statt „&“, ohne „The“ oder Klammerteil, „Five“ für „5“, „ae“ für „ä“), ein Interpret von mehreren — ein einzelnes Wort, das auch in einem anderen Song steht („Crazy“ für „She Drives Me Crazy“), zählt aber nicht
- **50 Erfolge** in jedem Modus (seit v0.12.3 auch auf der Zeitleiste; ältere Runden werden nachgetragen), Verlauf jeder Runde mit Rangliste und allen Songs
- **Statistik:** Runden, Songs, Trefferquote und Spielzeit; ein Jahrzehnt-Profil als Spinnennetz mit bis zu drei Personen im Vergleich; Siege, Runden pro Woche, Spielmodi, die kniffligsten und die sichersten Songs
- **Spieler:** alle Personen mit Runden, Siegen und Trefferquote; umbenennen, zusammenführen, entfernen; eine Seite je Person
- Verlauf, Erfolge und Einstellungen hängen am Konto und sind auf jedem Gerät gleich
- Installierbare PWA, helles und dunkles Design
- **Deutsch und Englisch**, automatisch aus dem Browser erkannt und auf der Anmeldeseite und im Profil umschaltbar; Anekdoten in beiden Sprachen
- **Impressum, Datenschutzerklärung und Nutzungsbedingungen** direkt in der App, auch ohne Konto lesbar; Konto mit einem Tipp im Profil löschen

## Die Songsammlung

800 Songs, 39 davon als Exoten markiert. Quelle der Wahrheit ist [`docs/songs.json`](docs/songs.json), die Anekdoten stehen in [`docs/song-facts.json`](docs/song-facts.json) – 745 Songs haben ein „Wusstest du?“, jedes aus dem Wikipedia-Artikel des Songs geschrieben und dagegen geprüft, nichts aus dem Gedächtnis. Erscheinungsjahr und Album kommen von **MusicBrainz**, Cover aus dem **Cover Art Archive** (iTunes als Rückfall). Spotify wird nirgends benutzt.

```bash
node scripts/song-management/add-song.js "a-ha" "Take on Me"   # schlägt Jahr und Album vor, lädt Audio und Cover
./scripts/deployment/deploy.sh web
```

Audio ist AAC-LC mit 96 kbit/s, nach vier Minuten mit kurzer Ausblendung abgeschnitten. Details, Austauschen und Bearbeiten: [`scripts/audio-hosting/README.md`](scripts/audio-hosting/README.md).

## Design

Material 3 Expressive mit eigener Identität: **Vinyl-Magenta** als Primärfarbe, warmes Bernstein als Akzent. Die Platte ist das einzige Erkennungszeichen – sie dreht sich, solange der Song läuft, und gleitet nach dem Aufdecken hinter dem Album-Cover heraus, das Jahr steht in der Farbe des Ergebnisses auf dem Cover (ohne Cover bleibt es auf dem Label); alles drumherum bleibt ruhig. Im Hintergrund ziehen feine Klangwellen am unteren Bildrand entlang; startet ein Song, schwellen sie sanft an und pulsieren, bei Pause klingen sie langsam aus, statt abrupt stehen zu bleiben.

- Paletten werden aus Seeds **erzeugt** (`pwa/scripts/gen-tokens.mjs` → `pwa/src/styles/design-tokens.css`), nirgends sonst Rohfarben
- Echte Federn (Steifigkeit und Dämpfung) als eine Quelle für JS (`motion`) und CSS (`linear()`-Kurven)
- Seitenwechsel zeigen, wohin es geht (View Transitions API): zwischen den Zielen der Leiste ein Überblenden, Unterseiten gleiten von rechts herein und zurück nach rechts hinaus, die Runde und andere Vollbildseiten steigen von unten auf; eine Runde wächst aus ihrer Zeile in ihre Seite, das Bild eines Spielers fliegt in seine; Theme und Farbe wechseln als Kreis-Reveal
- Während Verlauf und Statistik laden, Platzhalter in der Form des Kommenden statt einer leeren Seite
- **Erfolgspunkte:** Jeder Erfolg bringt je nach Schwierigkeit 50–250 Punkte (insgesamt 6.950). Die Summe ergibt einen Rang wie eine Plattenauszeichnung — Demo, Single, Album, Gold, Platin, Diamant, Legende — samt Weg zum nächsten; eine Bestenliste vergleicht alle auf dem Konto und deine Freunde; Freischalt-Karte und Rundenende zeigen, was es gab
- Die Platte fährt hoch, wenn die Musik startet, und läuft bei Pause aus; die Rangliste am Rundenende füllt sich von unten, der Sieger zuletzt; seit dem letzten Besuch freigeschaltete Erfolge tragen „Neu“; das Jahrzehnt-Netz morpht beim Wechsel der Kennzahl; leere Seiten zeigen eine Platte halb aus der Hülle
- Online: eine abgerissene Verbindung sieht man sofort, nach 30 s wird die Person übersprungen, bis sie zurück ist; wer verlässt, ist aus der Runde
- Karte auf die Zeitleiste ziehen und bis zum Bestätigen in eine andere Lücke weiterziehen
- Dezente Vibration auf dem Handy beim Greifen, Ablegen und Aufdecken (abschaltbar)
- `prefers-reduced-motion` wird überall respektiert, Touch-Ziele mindestens 48 px
- Roboto Flex selbst gehostet, jedes Symbol ein eingebettetes SVG – keine Emoji in der Oberfläche
- **Nur eigene Bedienelemente:** Auswahlmenüs sind das eigene Dropdown, Dialoge der eigene Dialog, Kästchen und Schalter eigene – nie das `<select>` des Browsers, `confirm()`/`alert()`/`prompt()` oder native Kästchen, die auf jeder Plattform anders aussehen (ein Test wacht darüber)

## Installieren

mxtape ist eine Web-App: [mxtape.celox.io](https://mxtape.celox.io) öffnen und *Zum Startbildschirm hinzufügen* wählen (Android/Chrome) bzw. *Teilen → Zum Home-Bildschirm* (iOS/Safari). Danach startet sie im Vollbild wie eine App.

## Entwicklung

```bash
# Backend (Port 4274)
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # MX_DEV_LOGIN=true für lokale Anmeldung ohne Google
.venv/bin/uvicorn app.main:app --port 4274 --reload

# Frontend (Port 5174, leitet /api an das Backend weiter)
cd pwa && npm install && npm run dev
# lokal anmelden: http://127.0.0.1:5174/api/auth/dev-login?email=…&name=…
```

Durchgehend `127.0.0.1` verwenden – das Sitzungs-Cookie hängt am Host.

## Technik

Optionale persönliche Editionen werden vom Server einem freigegebenen Konto zugeordnet. Sie ergänzen ausschließlich dessen Oberfläche um eine Begrüßung und dezente Gestaltung; Spielregeln und die Ansicht anderer Mitspielender bleiben gleich. Einrichtung: [Persönliche Editionen](docs/personal-editions.md).

| Ebene | Wahl |
|-------|------|
| Oberfläche | React 19, TypeScript, Tailwind CSS 3.4, Motion (LazyMotion, nur `m.*`), React Router 7 (Data Router) |
| Audio | Howler.js, HTML5-Audio, `/audio/` auf derselben Herkunft hinter der Anmeldung |
| PWA | vite-plugin-pwa (Workbox), versionierter Cache, Navigationen zuerst übers Netz |
| API | FastAPI, SQLAlchemy 2, SQLite im WAL-Modus, uvicorn (ein Worker – die Raumverwaltung liegt im Speicher) |
| Echtzeit | WebSocket je Raumplatz, Platz vom Server gestempelt, Uhrenabgleich über den Median der Pings |
| Anmeldung | Google OAuth (Code-Flow mit PKCE) oder E-Mail + Passwort (scrypt, Bestätigungslink, Link zum Zurücksetzen); httpOnly-Sitzungs-Cookie, CSRF-Header |
| Betrieb | nginx auf einem VPS, `auth_request`-Sperre für Audio, systemd-Dienst |

## Aufbau

```
pwa/      React-19-PWA (Vite, Tailwind, motion)
  src/game/     reine Spielregeln: Legen, Raten, Einspruch, Stechen, Songauswahl, Statistik
  src/online/   Räume: Protokoll, Client, Gastgeber-Brücke, Rechte, Bereinigung
  src/screens/  eine Datei je Bildschirm
server/   FastAPI + SQLite: Google- und E-Mail-Login, Warteliste, Admin, Kontodaten, Audio-Freigabe, Räume (WebSocket), Freunde, Tagesrunde, Erfolgspunkte
docs/     songs.json – die Songdatenbank (Quelle der Wahrheit), Anekdoten, Screenshots
scripts/  Songs verwalten, Audio hosten, Deployment
```

## Tests und CI

| Suite | Was sie abdeckt |
|-------|-----------------|
| `cd pwa && npx vitest run` | Spielregeln, Zugablauf, Einspruch, Stechen, Statistik, Abgleich zwischen Geräten, Rechte und Bereinigung im Mehrspieler, Bildschirme |
| `cd server && .venv/bin/python -m pytest -q` | Anmeldung und Freischaltung, Versionierung der Daten, Audio-Freigabe, Räume und WebSocket, Freunde und Suche, Song-Meldungen, Tagesrunde, Erfolgspunkte unter Freunden |
| `npm test` (Repo-Wurzel) | Integrität der Songdaten |
| `cd pwa && npm run e2e` | zwei Browser spielen eine Online-Runde gegen die echte API (Beitreten, Legen, Kein Einspruch, Einspruch) |
| `cd pwa && npx tsc --noEmit` | Typen |

GitHub Actions führt alles bei jedem Push aus ([`ci.yml`](.github/workflows/ci.yml)). Die großen Zahlen oben hält `pwa/src/__tests__/readme.test.ts` ehrlich; `node scripts/readme-badges.mjs` zählt neu und schreibt sie um.

## So funktioniert's

- **Der Gastgeber rechnet, der Server vermittelt.** In einem Raum läuft das Spiel auf dem Gerät des Gastgebers mit genau denselben Regeln wie auf einem Gerät. Der Server hält Räume, Plätze und den letzten Spielstand und reicht Nachrichten weiter – keine Spielregel existiert doppelt.
- **Niemand kann spicken.** Vor dem Aufdecken trägt der Spielstand für die anderen Geräte den Song ohne Jahr, Album und Anekdote.
- **Musik nur für die, die sie hören dürfen.** nginx fragt vor jeder Audiodatei die API (`auth_request`): Freigeschaltete Sitzungen und Gäste eines offenen Raums kommen durch, alle anderen bekommen 401.
- **Kontodaten** (Verlauf, Erfolge, Einstellungen) liegen je Konto mit optimistischer Versionierung; gleichzeitige Änderungen von zwei Geräten werden zusammengeführt, nicht überschrieben.

## Deployment

```bash
./scripts/deployment/deploy.sh        # API und Web-App (führt vorher die Tests aus)
./scripts/deployment/deploy.sh api    # nur Backend
./scripts/deployment/deploy.sh web    # nur PWA
```

Einmalig auf dem Server: Geheimnisse in `/opt/mxtape-api/.env` (Vorlage `server/.env.example`) und die nginx-Locations aus `server/deploy/nginx-locations.conf`. Der Google-OAuth-Client (Webanwendung) braucht die Weiterleitungs-URI `https://mxtape.celox.io/api/auth/callback`; den Zustimmungsbildschirm veröffentlichen, sonst lässt Google nur eingetragene Testnutzer durch.

## Grundsätze

- **Ein Spiel, viele Bildschirme.** Die Regeln sind reine Funktionen; ein Gerät, der Gastgeber eines Raums und alle Gäste nutzen denselben Code.
- **Privat von Haus aus.** Nur mit Anmeldung, Freischaltung von Hand, Audio hinter dem Login, keine Werbung, keine Tracker von Drittanbietern (Seitenaufrufe zählt ein selbst gehostetes Umami ohne Cookies).
- **Nur virtuell.** Keine gedruckten Karten, kein Spotify – ein Handy, ein Song, eine Zeitleiste.

## Fehlerbehebung

**„Zugriff blockiert“ bei der Google-Anmeldung** – der Zustimmungsbildschirm steht noch im Testmodus; nur eingetragene Testnutzer kommen durch.

**Kein Ton nach dem Neuladen** – Handys blockieren automatisches Abspielen bis zum ersten Tippen. Auf die Platte oder den Play-Knopf tippen.

**Ein gescannter Raum-Link öffnet die Startseite** – auf dem Handy liegt noch eine App-Version von vor v0.7.2. mxtape einmal öffnen und neu laden; seitdem laden Raum-Links immer frisch.

**Alte Lesezeichen** – die Adressen waren bis v0.8.1 deutsch (`/verlauf`, `/raum/…`), die Domain bis v0.8.0 mxster.celox.io. Beides funktioniert weiter und leitet um.

## Ausblick

- Mehr Songs, besonders aus den 50ern und den 2020ern

Ideen und Fehlermeldungen gern als [Issue](https://github.com/pepperonas/mxtape/issues).

---

## Entwickler

**Martin Pfeffer** · [celox.io](https://celox.io)

GitHub: [@pepperonas](https://github.com/pepperonas) · E-Mail: [martin.pfeffer@celox.io](mailto:martin.pfeffer@celox.io)

mxtape hieß bis Oktober 2026 **mxster**; mxster.celox.io leitet hierher weiter.

---

## Spenden

Wenn mxtape euren letzten Spieleabend lauter gemacht hat, freue ich mich über einen Kaffee (oder eine neue Platte) per **PayPal**:

[![Spenden per PayPal](https://img.shields.io/badge/PayPal-Spenden-00457C?logo=paypal&logoColor=white&style=for-the-badge)](https://www.paypal.com/donate/?business=martin.pfeffer@celox.io&currency_code=EUR&item_name=mxtape)

Spenden werden nie erwartet – die App bleibt kostenlos und werbefrei.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE).

### Fremdkomponenten

| Komponente | Lizenz |
|------------|--------|
| [Roboto Flex](https://github.com/googlefonts/roboto-flex) – selbst gehostet in `pwa/public/fonts/` | SIL Open Font License 1.1 |
| React, React Router, Vite, Tailwind CSS, Motion, Howler.js, qrcode-generator | MIT |
| FastAPI, SQLAlchemy, uvicorn | MIT / BSD |
| Songdaten von [MusicBrainz](https://musicbrainz.org), Cover aus dem [Cover Art Archive](https://coverartarchive.org) | CC0 / je Bild |

Die Musik selbst ist nicht Teil dieses Repositorys und fällt nicht unter dessen Lizenz; die Audiodateien liegen auf dem Server und werden nur freigeschalteten Konten zum privaten Gebrauch ausgeliefert.
