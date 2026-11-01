/**
 * Legal texts: imprint, privacy policy and terms of use, German and English.
 *
 * Keep them true: every statement about data must match what the code and
 * the server actually do (see CLAUDE.md, "Legal pages"). Changing data
 * handling means changing this file and its `updated` date.
 */
import type { Lang } from '@/i18n'

/** A paragraph, or a bullet list when it is an array. */
export type Block = string | string[]
export interface Section {
  heading: string
  body: Block[]
}
export interface LegalDoc {
  title: string
  intro?: string
  sections: Section[]
}
export type LegalKind = 'imprint' | 'privacy' | 'terms'

export const LEGAL_UPDATED = '2026-11-01'

const PROVIDER = ['Martin Pfeffer', 'celox.io', 'Flughafenstraße 24', '12053 Berlin']
const MAIL = 'martin.pfeffer@celox.io'

const imprint: Record<Lang, LegalDoc> = {
  de: {
    title: 'Impressum',
    sections: [
      { heading: 'Angaben gemäß § 5 DDG', body: [PROVIDER.join('\n'), 'Deutschland'] },
      { heading: 'Kontakt', body: [`E-Mail: ${MAIL}\nTelefon: +49 151 590 824 65`] },
      { heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV', body: ['Martin Pfeffer, Anschrift wie oben'] },
      {
        heading: 'Verbraucherstreitbeilegung',
        body: ['Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).']
      },
      {
        heading: 'Haftung für Inhalte',
        body: [
          'Als Diensteanbieter bin ich für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich (§ 7 Abs. 1 DDG). Für Namen und andere Angaben, die Nutzerinnen und Nutzer selbst eingeben, bin ich nach §§ 8 bis 10 DDG erst ab Kenntnis einer konkreten Rechtsverletzung verantwortlich; solche Inhalte entferne ich dann umgehend.'
        ]
      },
      {
        heading: 'Urheberrecht',
        body: [
          'Gestaltung, Texte und Programmcode von mxtape stammen vom Anbieter; der Quellcode ist unter der MIT-Lizenz veröffentlicht.',
          'Die im Spiel abgespielten Musikstücke, Albumcover, Titel und Interpretennamen sind Werke und Marken der jeweiligen Rechteinhaber. Sie werden ausschließlich zum privaten Spielen im geschlossenen Kreis freigeschalteter Konten bereitgestellt. Wer Rechte an einem Werk hat und mit der Verwendung nicht einverstanden ist, schreibt bitte an die oben genannte E-Mail-Adresse – das Stück wird dann umgehend entfernt.'
        ]
      }
    ]
  },
  en: {
    title: 'Imprint',
    sections: [
      { heading: 'Provider (§ 5 DDG, German Digital Services Act)', body: [PROVIDER.join('\n'), 'Germany'] },
      { heading: 'Contact', body: [`E-mail: ${MAIL}\nPhone: +49 151 590 824 65`] },
      { heading: 'Responsible for content (§ 18 (2) MStV)', body: ['Martin Pfeffer, address as above'] },
      {
        heading: 'Consumer dispute resolution',
        body: ['I am neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board (§ 36 VSBG).']
      },
      {
        heading: 'Liability for content',
        body: [
          'As a service provider I am responsible for my own content under general law (§ 7 (1) DDG). For names and other details that users enter themselves, I am only responsible from the moment I learn of a specific infringement (§§ 8–10 DDG); I then remove such content without delay.'
        ]
      },
      {
        heading: 'Copyright',
        body: [
          'The design, texts and program code of mxtape are by the provider; the source code is published under the MIT license.',
          'The music, album covers, titles and artist names used in the game are works and marks of their respective rights holders. They are provided only for private play within the closed circle of approved accounts. If you hold rights to a work and do not agree with its use, please write to the e-mail address above and the track will be removed without delay.'
        ]
      }
    ]
  }
}

const privacy: Record<Lang, LegalDoc> = {
  de: {
    title: 'Datenschutzerklärung',
    intro: 'Welche personenbezogenen Daten mxtape verarbeitet, wozu, wie lange und welche Rechte du hast.',
    sections: [
      { heading: '1. Verantwortlicher', body: [[...PROVIDER, `E-Mail: ${MAIL}`].join('\n')] },
      {
        heading: '2. Worum es geht',
        body: [
          'mxtape ist ein privates Musikspiel. Spielen kann, wer sich mit einem Google-Konto oder mit E-Mail-Adresse und Passwort anmeldet und von mir freigeschaltet wurde, sowie Gäste, die über einen Raum-Link in eine laufende Runde kommen. Es gibt keine Werbung, keine Tracker von Drittanbietern und keinen Verkauf von Daten.'
        ]
      },
      {
        heading: '3. Hosting',
        body: [
          'mxtape läuft auf einem Server von Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaka, Zypern, in einem Rechenzentrum in der EU. Alle unten genannten Daten liegen dort. Mit dem Hoster besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und zuverlässigen Betrieb).'
        ]
      },
      {
        heading: '4. Server-Logdateien',
        body: [
          'Bei jedem Aufruf speichert der Webserver automatisch: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Statuscode, übertragene Datenmenge, Referrer und Browserkennung. Das dient dem Betrieb, der Fehlersuche und der Abwehr von Angriffen; zusätzlich werte ich die Logs in zusammengefasster Form aus (Aufrufe, Browser-Familien), ohne Nutzungsprofile zu bilden. Die Logdateien werden nach 14 Tagen automatisch gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.'
        ]
      },
      {
        heading: '5. Reichweitenmessung mit Umami',
        body: [
          'Ich messe die Nutzung mit der Open-Source-Software Umami, die ich selbst auf meinem Server in der EU betreibe (analytics.celox.io). Es werden keine Cookies gesetzt und keine Daten an Dritte übertragen. Erfasst werden aufgerufene Seiten, Herkunftsseite, Browser- und Gerätetyp sowie ungefähre Region; die IP-Adresse wird nicht gespeichert, zur Unterscheidung von Besuchen dient ein täglich wechselnder, nicht rückrechenbarer Wert. Ist in deinem Browser „Do Not Track“ aktiv, findet keine Messung statt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; da auf deinem Gerät nichts gespeichert oder ausgelesen wird, ist keine Einwilligung nach § 25 TDDDG nötig.'
        ]
      },
      {
        heading: '6. Anmeldung mit Google oder E-Mail',
        body: [
          'Du kannst dich mit deinem Google-Konto anmelden oder ein Konto mit E-Mail-Adresse und Passwort anlegen.',
          'Zum Anmelden wirst du zu Google weitergeleitet (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Dort gibst du dein Google-Konto ein; Google gibt mir daraufhin die Kennung deines Google-Kontos, deine E-Mail-Adresse, deinen Namen, die Adresse deines Profilbilds und die Bestätigung, dass die E-Mail-Adresse geprüft ist. Ein Passwort erhalte ich nie.',
          'Dein Profilbild lädt dein Browser direkt von den Servern von Google; dabei erfährt Google deine IP-Adresse. Google kann Daten auch in den USA verarbeiten; Google ist nach dem EU-US Data Privacy Framework zertifiziert. Für die Verarbeitung bei Google gilt dessen Datenschutzerklärung (policies.google.com/privacy).',
          'Mit E-Mail-Adresse: Du gibst Name, E-Mail-Adresse und Passwort ein. Das Passwort speichere ich nur als nicht umkehrbaren Hash (scrypt mit zufälligem Salt); im Klartext kenne ich es nie. Ich schicke dir einen Link, mit dem du bestätigst, dass dir die Adresse gehört. Erst danach sehe ich deine Anfrage. Wird der Link nicht innerhalb von 48 Stunden benutzt, lösche ich das unbestätigte Konto. Über „Passwort vergessen“ schicke ich dir einen Link, der eine Stunde und nur einmal gilt. Diese Mails laufen über den Mailserver des Hosters (siehe Abschnitt 3). Meldest du dich später mit einem Google-Konto derselben Adresse an, wird daraus dasselbe Konto.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO: Ohne Anmeldung kann ich dir kein eigenes Konto mit Verlauf und Erfolgen bereitstellen.'
        ]
      },
      {
        heading: '7. Konto und Freischaltung',
        body: [
          'Gespeichert werden: Google-Kennung (bei Anmeldung mit Google), E-Mail-Adresse, Name, Adresse des Profilbilds, bei Anmeldung mit E-Mail der Passwort-Hash und der Zeitpunkt der Bestätigung, Status (wartend, freigeschaltet, abgelehnt, gesperrt) sowie die Zeitpunkte der Anmeldung, der letzten Anmeldung und der Entscheidung.',
          'Für eine Nutzungsstatistik vermerke ich, an welchen Tagen ein freigeschaltetes Konto die App geöffnet hat – nur den Tag, keine Uhrzeit und keine Inhalte. Die Einträge werden nach 400 Tagen gelöscht, mit dem Konto sofort. Als Betreiber sehe ich daraus und aus den gespeicherten Runden nur Summen (zum Beispiel aktive Konten pro Tag, Runden pro Tag, wie oft ein Song richtig lag), keine Auswertung einzelner Personen. Einen Teil dieser Summen sehen auch alle Mitspieler in der Statistik unter „Alle zusammen“: Runden pro Tag, Spielmodi, Songs und wie oft sie richtig lagen, wie viele Personen welchen Erfolg haben, Tagesrunden pro Tag – ohne Namen, ohne Konten und ohne Uhrzeiten oder Wochentage der Runden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO, mein berechtigtes Interesse, die App zu verbessern und euch das gemeinsame Spiel zu zeigen.',
          'Neue Konten werden von Hand freigeschaltet; eine automatisierte Entscheidung findet nicht statt. Bei einer neuen Anfrage erhalte ich eine E-Mail mit Name und E-Mail-Adresse; der Versand läuft über den Mailserver des Hosters (siehe Abschnitt 3). Jede Entscheidung wird mit Zeitpunkt protokolliert.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, für das Protokoll Art. 6 Abs. 1 lit. f DSGVO (Nachvollziehbarkeit der Freischaltungen).'
        ]
      },
      {
        heading: '8. Spieldaten in deinem Konto',
        body: [
          'Damit Verlauf, Statistik und Erfolge auf jedem deiner Geräte gleich aussehen, speichere ich zu deinem Konto:',
          [
            'Verlauf: gespielte Runden mit Datum, Modus, Mitspielenden (Namen), Songs, Ergebnis und den einzelnen Zügen (bis zu 50 Runden)',
            'Erfolge und deren Fortschritt',
            'Einstellungen: Farbschema, Namen für die Schnellauswahl, zuletzt gespielte Songs, ausgeblendete Personen'
          ],
          'Namen von Mitspielenden gibst du selbst ein. Verwende am besten Vornamen oder Spitznamen und nur von Menschen, die damit einverstanden sind.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.'
        ]
      },
      {
        heading: '9. Räume, Gäste und Freunde',
        body: [
          'Öffnest du einen Raum, speichere ich den Raumcode, die Rundenoptionen, die Plätze (Konto oder Gastname), einen verschlüsselten Platzschlüssel und den jeweils aktuellen Spielstand. Mitspielende im Raum sehen Vornamen und Profilbilder der anderen. Räume werden 12 Stunden nach der letzten Aktivität mitsamt Gastnamen und Einladungen gelöscht; das Ergebnis bleibt im Verlauf der Mitspielenden mit Konto.',
          'Gäste geben nur einen Namen ein. Für sie wird ein Cookie gesetzt, das sie ihrem Platz zuordnet (14 Stunden gültig); darüber hinaus wird für Gäste nichts gespeichert.',
          'Andere Konten findest du über einen Teil des Namens oder die genaue E-Mail-Adresse; gezeigt werden nur Name und Profilbild, E-Mail-Adressen nie. Freundschaften und Einladungen bleiben gespeichert, bis eine Seite sie entfernt oder der Raum gelöscht wird.',
          'Spielst du die Tagesrunde, speichere ich deinen Stand Song für Song (Tag, Zahl der Songs, deine Serie, Beginn und Ende), damit du pausieren und auf jedem Gerät weiterspielen kannst. Deine Freunde sehen Serie und Stand mit Name und Profilbild; nach 60 Tagen wird alles gelöscht. Nach der Runde kannst du ausgewählten Freunden eine Mail schicken lassen: Sie enthält deinen Namen und deine Serie, deine Adresse und die der Freunde sieht niemand sonst, und es geht höchstens eine solche Mail pro Tag raus. Wer solche Mails nicht möchte, schaltet sie im Profil ab.',
          'Deine Erfolgspunkte (die Summe und wie viele Erfolge du hast) speichere ich, damit deine Freunde sich auf der Erfolge-Seite mit dir vergleichen können; sie sehen sie mit Name und Profilbild. Die Erfolge selbst und die Punkte anderer Leute auf deinem Konto werden nicht geteilt. Die Zahl wird bei jeder Änderung ersetzt und mit dem Konto gelöscht.',
          'Meldest du einen Song („Stimmt was nicht?“), speichere ich Song, Grund, deinen freiwilligen Hinweis und dein Konto, damit ich nachfragen kann. Meldungen bleiben gespeichert, bis du dein Konto löschst.',
          'Wünschst du dir einen Song („Song wünschen“), speichere ich Interpret, Titel, deine freiwillige Anmerkung und dein Konto; ich sehe deinen Namen beim Wunsch, du siehst in der Song-Übersicht, was daraus wurde. Offene Wünsche bleiben, bis ich sie entschieden habe; entschiedene lösche ich 90 Tage danach.',
          'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.'
        ]
      },
      {
        heading: '10. Cookies und Speicher im Browser',
        body: [
          'mxtape setzt nur Cookies, ohne die die App nicht funktioniert:',
          [
            'mx_session – hält dich angemeldet (30 Tage, nur für den Server lesbar)',
            'mx_oauth – schützt die Anmeldung bei Google (10 Minuten)',
            'mx_guest – ordnet Gäste ihrem Platz im Raum zu (14 Stunden)',
            'mx_known – merkt sich, dass dieses Gerät schon einmal mit E-Mail und Passwort angemeldet war, damit Fremde es nicht durch Fehlversuche aussperren können (180 Tage, nur für den Server lesbar)'
          ],
          'Im Speicher deines Browsers (localStorage, sessionStorage) liegen Design und Farbe, Sprache, eine laufende Runde, die zuletzt gewählten Rundenoptionen (in einer Lobby auch Bots und Teams, nur bis der Tab geschlossen wird), ein angefangener Raumbeitritt, welche Online-Runden schon in deinem Verlauf stehen, wann du die Erfolge einer Person zuletzt angesehen hast (für die Markierung „Neu“) und (nur bis der Tab geschlossen wird) welche Seiten du zuletzt geöffnet hast, damit „Zurück“ richtig führt; ein Service Worker speichert die App für schnelleres Laden. Diese Daten verlassen dein Gerät nicht, außer als Teil der Spieldaten in deinem Konto.',
          'Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich für den gewünschten Dienst) sowie Art. 6 Abs. 1 lit. b DSGVO.'
        ]
      },
      {
        heading: '11. Musik, Cover und Schriften',
        body: [
          'Musikdateien, Albumcover und Schriften liefert ausschließlich mein Server aus; dein Browser stellt dafür keine Anfragen an Dritte. Die Songdaten habe ich vorab von MusicBrainz und dem Cover Art Archive bezogen – dabei werden keine Daten von dir übertragen.'
        ]
      },
      {
        heading: '12. Speicherdauer und Löschen',
        body: [
          'Dein Konto und deine Spieldaten bleiben gespeichert, bis du sie löschst. Im Profil kannst du jederzeit nur die Spieldaten oder das ganze Konto löschen; beim Löschen des Kontos entfernt der Server sofort Konto, Sitzungen, Spieldaten, Freundschaften, Einladungen, Tagesrunden-Ergebnisse, Erfolgspunkte, Aktivitätstage, Song-Meldungen, Songwünsche und deine Räume.',
          'Abgelehnte und gesperrte Konten bewahre ich auf, damit die Entscheidung bei einer erneuten Anmeldung erhalten bleibt; auf Anfrage lösche ich sie.',
          'Der Server wird jede Nacht verschlüsselt gesichert; Sicherungen werden nach spätestens rund einem Monat überschrieben. Gelöschte Daten verschwinden daher spätestens dann auch aus den Sicherungen.'
        ]
      },
      {
        heading: '13. Deine Rechte',
        body: [
          'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine Kopie deiner Spieldaten kannst du im Profil selbst herunterladen. Für alles andere genügt eine E-Mail an die oben genannte Adresse.'
        ]
      },
      {
        heading: '14. Beschwerderecht',
        body: [
          'Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig für mich ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin.'
        ]
      },
      {
        heading: '15. Änderungen',
        body: ['Ändert sich, wie mxtape Daten verarbeitet, passe ich diese Erklärung an. Es gilt die jeweils hier veröffentlichte Fassung.']
      }
    ]
  },
  en: {
    title: 'Privacy policy',
    intro: 'Which personal data mxtape processes, why, for how long, and what rights you have.',
    sections: [
      { heading: '1. Controller', body: [[...PROVIDER, `E-mail: ${MAIL}`].join('\n')] },
      {
        heading: '2. What this is about',
        body: [
          'mxtape is a private music game. It can be played by people who sign in with a Google account or with an e-mail address and password and are approved by me, and by guests who join a running round through a room link. There are no ads, no third-party trackers and no sale of data.'
        ]
      },
      {
        heading: '3. Hosting',
        body: [
          'mxtape runs on a server of Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaca, Cyprus, in a data centre in the EU. All data mentioned below is stored there. A data processing agreement under Art. 28 GDPR is in place with the host. Legal basis: Art. 6 (1) (f) GDPR (legitimate interest in secure and reliable operation).'
        ]
      },
      {
        heading: '4. Server log files',
        body: [
          'With every request the web server automatically records: IP address, time, requested address, status code, amount of data transferred, referrer and browser identification. This serves operation, troubleshooting and defence against attacks; I also evaluate the logs in aggregated form (requests, browser families) without building usage profiles. Log files are deleted automatically after 14 days. Legal basis: Art. 6 (1) (f) GDPR.'
        ]
      },
      {
        heading: '5. Audience measurement with Umami',
        body: [
          'I measure usage with the open-source software Umami, which I run myself on my server in the EU (analytics.celox.io). No cookies are set and no data is passed to third parties. Recorded are the pages visited, the referring page, browser and device type and approximate region; the IP address is not stored, and visits are told apart by a value that changes daily and cannot be traced back. If "Do Not Track" is active in your browser, nothing is measured. Legal basis: Art. 6 (1) (f) GDPR; since nothing is stored on or read from your device, no consent under § 25 TDDDG is required.'
        ]
      },
      {
        heading: '6. Signing in with Google or e-mail',
        body: [
          'You can sign in with your Google account or create an account with an e-mail address and password.',
          'To sign in you are redirected to Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland). You enter your Google account there; Google then gives me your Google account ID, your e-mail address, your name, the address of your profile picture and the confirmation that your e-mail address is verified. I never receive a password.',
          'Your browser loads your profile picture directly from Google\'s servers, which tells Google your IP address. Google may also process data in the USA; Google is certified under the EU-US Data Privacy Framework. Google\'s own privacy policy applies to its processing (policies.google.com/privacy).',
          'With an e-mail address: you enter a name, an e-mail address and a password. I only store the password as an irreversible hash (scrypt with a random salt); I never know it in plain text. I send you a link to confirm that the address is yours; only then do I see your request. If the link is not used within 48 hours, I delete the unconfirmed account. "Forgot password" sends you a link that works for one hour and only once. These e-mails go through the host\'s mail server (see section 3). If you later sign in with a Google account of the same address, it becomes the same account.',
          'Legal basis: Art. 6 (1) (b) GDPR — without signing in I cannot provide you with your own account, history and achievements.'
        ]
      },
      {
        heading: '7. Account and approval',
        body: [
          'Stored are: Google account ID (when signing in with Google), e-mail address, name, profile picture address, for e-mail sign-in the password hash and the time of confirmation, status (waiting, approved, rejected, blocked) and the times of registration, last sign-in and the decision.',
          'For a usage statistic I note on which days an approved account opened the app – only the day, no time and no content. The entries are deleted after 400 days, with the account at once. As the operator I only see totals from this and from the stored rounds (for example active accounts per day, rounds per day, how often a song was placed right), no evaluation of individual people. Part of these totals every player sees too, in the statistics under “Everyone together”: rounds per day, game modes, songs and how often they were placed right, how many people hold which achievement, daily rounds per day – no names, no accounts and no times of day or weekdays of the rounds. The legal basis is Art. 6(1)(f) GDPR, my legitimate interest in improving the app and showing you the game you play together.',
          'New accounts are approved by hand; there is no automated decision. For each new request I receive an e-mail with name and e-mail address, sent via the host\'s mail server (see section 3). Every decision is logged with its time.',
          'Legal basis: Art. 6 (1) (b) GDPR, for the log Art. 6 (1) (f) GDPR (traceability of approvals).'
        ]
      },
      {
        heading: '8. Game data in your account',
        body: [
          'So that history, statistics and achievements look the same on all your devices, I store with your account:',
          [
            'History: rounds played with date, mode, co-players (names), songs, result and the individual turns (up to 50 rounds)',
            'Achievements and their progress',
            'Settings: theme, names for the quick picks, recently played songs, hidden people'
          ],
          'You enter the names of co-players yourself. Preferably use first names or nicknames, and only of people who agree.',
          'Legal basis: Art. 6 (1) (b) GDPR.'
        ]
      },
      {
        heading: '9. Rooms, guests and friends',
        body: [
          'When you open a room, I store the room code, the round options, the seats (account or guest name), an encrypted seat key and the current game state. People in the room see each other\'s first names and profile pictures. Rooms are deleted 12 hours after the last activity together with guest names and invitations; the result stays in the history of the players with an account.',
          'Guests only enter a name. A cookie links them to their seat (valid for 14 hours); beyond that nothing is stored for guests.',
          'You can find other accounts by part of the name or the exact e-mail address; only name and profile picture are shown, never e-mail addresses. Friendships and invitations stay stored until one side removes them or the room is deleted.',
          'If you play the daily round, I store your progress song by song (day, number of songs, your streak, start and end), so you can pause and carry on on any device. Your friends see the streak and the progress with your name and profile picture; everything is deleted after 60 days. After the round you can have an email sent to friends you choose: it contains your name and your streak, nobody else sees your address or theirs, and at most one such email goes out per day. Anyone who does not want these emails turns them off in the profile.',
          'I store your achievement points (the total and how many achievements you have) so your friends can compare with you on the achievements page; they see them with your name and profile picture. The achievements themselves and the points of other people on your account are not shared. The number is replaced on every change and deleted with the account.',
          'If you report a song ("Something wrong?"), I store the song, the reason, your optional note and your account so I can ask back. Reports stay stored until you delete your account.',
          'If you request a song ("Request a song"), I store artist, title, your optional note and your account; I see your name with the request, and you see in the song library what became of it. Open requests stay until I have decided; decided ones are deleted 90 days later.',
          'Legal basis: Art. 6 (1) (b) GDPR.'
        ]
      },
      {
        heading: '10. Cookies and browser storage',
        body: [
          'mxtape only sets cookies the app cannot work without:',
          [
            'mx_session — keeps you signed in (30 days, readable only by the server)',
            'mx_oauth — protects the sign-in with Google (10 minutes)',
            'mx_guest — links guests to their seat in a room (14 hours)',
            'mx_known — remembers that this device signed in with e-mail and password before, so strangers cannot lock it out with failed attempts (180 days, readable only by the server)'
          ],
          'Your browser\'s storage (localStorage, sessionStorage) holds the theme and colour, the language, a running round, the last chosen round options (in a lobby also bots and teams, only until the tab is closed), a room you were about to join, which online rounds are already in your history, when you last looked at a person’s achievements (for the "new" mark) and (only until the tab is closed) which pages you opened last, so that "back" leads the right way; a service worker caches the app so it loads faster. This data does not leave your device, except as part of the game data in your account.',
          'Legal basis: § 25 (2) no. 2 TDDDG (strictly necessary for the service you asked for) and Art. 6 (1) (b) GDPR.'
        ]
      },
      {
        heading: '11. Music, covers and fonts',
        body: [
          'Music files, album covers and fonts are served only by my server; your browser makes no requests to third parties for them. I obtained the song data in advance from MusicBrainz and the Cover Art Archive — no data about you is transferred.'
        ]
      },
      {
        heading: '12. Retention and deletion',
        body: [
          'Your account and game data are kept until you delete them. In your profile you can delete just the game data or the whole account at any time; deleting the account immediately removes account, sessions, game data, friendships, invitations, daily results, achievement points, activity days, song reports, song requests and your rooms from the server.',
          'I keep rejected and blocked accounts so that the decision still applies if you sign in again; I delete them on request.',
          'The server is backed up every night in encrypted form; backups are overwritten after about a month at the latest. Deleted data therefore also disappears from the backups by then.'
        ]
      },
      {
        heading: '13. Your rights',
        body: [
          'You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21). You can download a copy of your game data yourself in your profile. For anything else, an e-mail to the address above is enough.'
        ]
      },
      {
        heading: '14. Right to complain',
        body: [
          'You can complain to a data protection supervisory authority. The authority responsible for me is the Berlin Commissioner for Data Protection and Freedom of Information (Berliner Beauftragte für Datenschutz und Informationsfreiheit), Alt-Moabit 59–61, 10555 Berlin, Germany.'
        ]
      },
      {
        heading: '15. Changes',
        body: ['If the way mxtape processes data changes, I will update this policy. The version published here applies.']
      }
    ]
  }
}

const terms: Record<Lang, LegalDoc> = {
  de: {
    title: 'Nutzungsbedingungen',
    intro: 'Die Spielregeln für die App selbst. Sie gelten für alle, die mxtape mit Konto oder als Gast nutzen.',
    sections: [
      { heading: '1. Anbieter und Geltung', body: [`mxtape wird betrieben von Martin Pfeffer, Flughafenstraße 24, 12053 Berlin (siehe Impressum). Mit der Anmeldung oder dem Beitritt zu einem Raum als Gast erkennst du diese Bedingungen an.`] },
      {
        heading: '2. Leistung',
        body: [
          'mxtape ist ein kostenloses, privates Musikspiel. Ein Anspruch auf Zugang besteht nicht: Neue Konten schalte ich nach eigenem Ermessen frei, und ich kann eine Freischaltung jederzeit zurücknehmen. Ich darf Funktionen ändern, einschränken oder die App ganz einstellen.'
        ]
      },
      {
        heading: '3. Konto',
        body: [
          'Du meldest dich mit deinem eigenen Google-Konto oder deiner eigenen E-Mail-Adresse an; pro Person gibt es ein Konto. Dein Passwort hältst du geheim. Du bist dafür verantwortlich, dass niemand anderes über dein Gerät in deinem Namen spielt. Gäste brauchen kein Konto; sie nutzen nur den Raum, in den sie eingeladen wurden.'
        ]
      },
      {
        heading: '4. Erlaubte Nutzung',
        body: [
          'mxtape ist nur zum privaten, nicht gewerblichen Spielen gedacht. Nicht erlaubt ist insbesondere:',
          [
            'Musik, Cover oder andere Inhalte aufzunehmen, herunterzuladen, weiterzugeben oder öffentlich vorzuführen',
            'die Zugangssperre zu umgehen, die App automatisiert abzufragen oder ihren Betrieb zu stören',
            'beleidigende, diskriminierende oder rechtswidrige Namen zu verwenden',
            'Namen anderer Personen ohne deren Einverständnis einzugeben',
            'Raum-Links öffentlich zu verbreiten – teile sie nur mit Menschen, mit denen du spielen willst'
          ],
          'Wer einen Raum öffnet, entscheidet, wen er einlädt, und kann Personen vor dem Start entfernen.'
        ]
      },
      {
        heading: '5. Inhalte',
        body: [
          'Die Musik und die Albumcover gehören den jeweiligen Rechteinhabern; du erhältst daran keine Rechte. Jahreszahlen, Albumnamen und Anekdoten sind sorgfältig recherchiert, können aber Fehler enthalten. Hinweise nehme ich gern per E-Mail entgegen.'
        ]
      },
      {
        heading: '6. Verfügbarkeit',
        body: [
          'Ich bemühe mich um einen störungsfreien Betrieb, kann aber keine bestimmte Verfügbarkeit zusagen. Wartung, technische Störungen oder Ausfälle beim Hoster oder bei Google können die Nutzung zeitweise verhindern.'
        ]
      },
      {
        heading: '7. Haftung',
        body: [
          'Da mxtape unentgeltlich ist, hafte ich nur für Vorsatz und grobe Fahrlässigkeit. Diese Beschränkung gilt nicht für Schäden aus der Verletzung von Leben, Körper oder Gesundheit und nicht für eine Haftung nach dem Produkthaftungsgesetz.'
        ]
      },
      {
        heading: '8. Ende der Nutzung',
        body: [
          'Du kannst dein Konto jederzeit im Profil löschen. Bei Verstößen gegen diese Bedingungen kann ich Konten sperren oder Gäste aus Räumen entfernen.'
        ]
      },
      { heading: '9. Datenschutz', body: ['Wie mxtape mit deinen Daten umgeht, steht in der Datenschutzerklärung.'] },
      {
        heading: '10. Änderungen',
        body: [
          'Ich kann diese Bedingungen für die Zukunft ändern, etwa wenn neue Funktionen dazukommen. Über wesentliche Änderungen informiere ich in der App. Bist du nicht einverstanden, kannst du dein Konto löschen.'
        ]
      },
      {
        heading: '11. Recht',
        body: [
          'Es gilt deutsches Recht. Wenn du Verbraucherin oder Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat bist, bleiben die zwingenden Schutzvorschriften dieses Staates unberührt. Sollte eine Bestimmung unwirksam sein, bleiben die übrigen wirksam.'
        ]
      }
    ]
  },
  en: {
    title: 'Terms of use',
    intro: 'The rules for the app itself. They apply to everyone who uses mxtape with an account or as a guest.',
    sections: [
      { heading: '1. Provider and scope', body: ['mxtape is run by Martin Pfeffer, Flughafenstraße 24, 12053 Berlin, Germany (see imprint). By signing in or joining a room as a guest you accept these terms.'] },
      {
        heading: '2. The service',
        body: [
          'mxtape is a free, private music game. There is no entitlement to access: I approve new accounts at my discretion and may withdraw an approval at any time. I may change or limit features or discontinue the app.'
        ]
      },
      {
        heading: '3. Account',
        body: [
          'You sign in with your own Google account or your own e-mail address; there is one account per person. Keep your password to yourself. You are responsible for nobody else playing in your name on your device. Guests need no account; they only use the room they were invited to.'
        ]
      },
      {
        heading: '4. Permitted use',
        body: [
          'mxtape is meant only for private, non-commercial play. In particular, you may not:',
          [
            'record, download, pass on or publicly perform music, covers or other content',
            'get around the access restriction, query the app automatically or disrupt its operation',
            'use offensive, discriminatory or unlawful names',
            'enter other people\'s names without their consent',
            'spread room links publicly — share them only with people you want to play with'
          ],
          'Whoever opens a room decides whom to invite and can remove people before the start.'
        ]
      },
      {
        heading: '5. Content',
        body: [
          'The music and album covers belong to their respective rights holders; you acquire no rights in them. Years, album names and facts are researched carefully but may contain errors. I am glad to receive corrections by e-mail.'
        ]
      },
      {
        heading: '6. Availability',
        body: [
          'I try to keep the app running without interruption but cannot promise any particular availability. Maintenance, technical faults or outages at the host or at Google may prevent use at times.'
        ]
      },
      {
        heading: '7. Liability',
        body: [
          'Since mxtape is free of charge, I am liable only for intent and gross negligence. This limitation does not apply to damage from injury to life, body or health, nor to liability under the German Product Liability Act.'
        ]
      },
      {
        heading: '8. Ending use',
        body: ['You can delete your account in your profile at any time. If these terms are breached, I may block accounts or remove guests from rooms.']
      },
      { heading: '9. Privacy', body: ['How mxtape handles your data is described in the privacy policy.'] },
      {
        heading: '10. Changes',
        body: [
          'I may change these terms for the future, for example when new features are added. I will announce significant changes in the app. If you do not agree, you can delete your account.'
        ]
      },
      {
        heading: '11. Law',
        body: [
          'German law applies. If you are a consumer habitually resident in another country, the mandatory consumer protection rules of that country remain unaffected. Should a provision be invalid, the rest remain valid.'
        ]
      }
    ]
  }
}

export const LEGAL: Record<LegalKind, Record<Lang, LegalDoc>> = { imprint, privacy, terms }
