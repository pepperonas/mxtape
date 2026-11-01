import { defineMessages } from '../define'

export const wishText = defineMessages({
  de: {
    open: 'Song wünschen',
    missingQuestion: 'Fehlt dir ein Song?',
    missingHint: 'Wünsch ihn dir – Martin nimmt ihn auf, wenn es eine gute Aufnahme gibt.',
    dialogTitle: 'Song wünschen',
    intro: 'Welcher Song fehlt? Der Wunsch landet bei Martin; du siehst hier, was daraus wird.',
    artist: 'Interpret',
    title: 'Titel',
    note: 'Anmerkung (freiwillig)',
    noteHint: 'z. B. „für unsere Partyrunde“',
    cancel: 'Abbrechen',
    send: 'Wünschen',
    thanks: 'Danke, der Wunsch ist angekommen.',
    mineHeading: 'Deine Wünsche',
    status_open: 'Offen',
    status_added: 'Aufgenommen',
    status_declined: 'Nicht aufgenommen',
    wishFor: (q: string) => `„${q}“ wünschen`
  },
  en: {
    open: 'Request a song',
    missingQuestion: 'Missing a song?',
    missingHint: 'Ask for it – Martin adds it when there is a good recording.',
    dialogTitle: 'Request a song',
    intro: 'Which song is missing? The request goes to Martin; you see here what becomes of it.',
    artist: 'Artist',
    title: 'Title',
    note: 'Note (optional)',
    noteHint: 'e.g. “for our party round”',
    cancel: 'Cancel',
    send: 'Request',
    thanks: 'Thanks, your request arrived.',
    mineHeading: 'Your requests',
    status_open: 'Open',
    status_added: 'Added',
    status_declined: 'Not added',
    wishFor: (q: string) => `Request “${q}”`
  }
})
