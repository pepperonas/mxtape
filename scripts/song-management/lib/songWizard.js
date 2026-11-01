/**
 * Shared flow of add-song.js and exchange-song.js:
 *   1. look up year + album (MusicBrainz, iTunes fallback)
 *   2. show the suggestion, let you correct every field (or accept with --yes)
 *   3. download the audio (yt-dlp), fetch the cover, upload both to the VPS
 *   4. caller writes songs.json / song-facts.json via songStore.saveAll()
 *
 * Flags shared by both scripts:
 *   --year 1984  --album "…"  --genre Pop  --fact "…"  --fact-en "…"   preset a field
 *   --exotic     mark as little-known (only drawn when a round allows exotics)
 *   --yes        accept the suggestion without questions
 *   --no-upload  keep MP3 and cover local (upload later with rsync)
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { lookupItunes, lookupRecording, fetchCover } from './musicData.js'
import { AUDIO_DIR, COVER_DIR } from './songStore.js'
import { rmsLevels, startFromLevels } from '../../audio-hosting/start-points.js'
import { downloadAndUploadSong, uploadFile } from '../../audio-hosting/download-single-song.js'

export const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Dance', 'House', 'Disco', 'R&B', 'Soul', 'Funk', 'Metal', 'Schlager', 'Reggae', 'Country']

/** argv → { positional: [...], flags: { year, album, genre, fact, factEn, yes, upload } } */
export function parseArgs(argv) {
  const positional = []
  const flags = { yes: false, upload: true, exotic: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    // `--` ends the options: everything after it is artist/title, even "--yes"
    // (the admin area copies wished songs as `add-song.js -- 'artist' 'title'`)
    if (a === '--') {
      positional.push(...argv.slice(i + 1))
      break
    }
    if (a === '--yes' || a === '-y') flags.yes = true
    else if (a === '--no-upload') flags.upload = false
    else if (a === '--exotic') flags.exotic = true
    else if (a === '--fact-en') flags.factEn = argv[++i]
    else if (['--year', '--album', '--genre', '--fact', '--search'].includes(a)) flags[a.slice(2)] = argv[++i]
    else positional.push(a)
  }
  if (flags.year !== undefined) flags.year = parseInt(flags.year, 10)
  return { positional, flags }
}

export function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())))
  return { ask, close: () => rl.close() }
}

/**
 * Suggest metadata for artist/title and let the user confirm or edit it.
 * Returns { meta: {title, artist, year, album, genre, fact, factEn}, cover: {releaseGroupId, itunesArtwork} }.
 */
export async function proposeSong({ artist, title, flags, prompt, current }) {
  console.log(`\n🔎 Suche „${artist} – ${title}“ bei MusicBrainz …`)
  let mb = { year: null, album: null, releaseGroupId: null, candidates: [] }
  try {
    mb = await lookupRecording(artist, title)
  } catch (e) {
    console.warn(`   ⚠️  MusicBrainz nicht erreichbar (${e.message})`)
  }
  const it = await lookupItunes(artist, title).catch(() => null)

  if (mb.candidates.length > 0) {
    console.log('   Treffer (frühestes Erscheinen zuerst):')
    for (const c of mb.candidates.slice(0, 5)) {
      console.log(`   • ${c.year}  ${c.artist} – ${c.title}${c.album ? `  [${c.album}]` : ''}${c.lengthS ? `  ${Math.floor(c.lengthS / 60)}:${String(c.lengthS % 60).padStart(2, '0')}` : ''}`)
    }
  } else {
    console.log('   Keine sicheren Treffer bei MusicBrainz.')
  }

  const meta = {
    title,
    artist,
    year: flags.year ?? mb.year ?? it?.year ?? current?.year ?? null,
    album: flags.album ?? mb.album ?? it?.album ?? null,
    genre: flags.genre ?? current?.genre ?? '',
    fact: flags.fact ?? '',
    factEn: flags.factEn ?? '',
    exotic: flags.exotic ?? false
  }

  if (!flags.yes) {
    console.log('\n📝 Vorschlag prüfen — Enter übernimmt den Wert in Klammern.')
    console.log('   Wichtig: das Jahr der ERSTveröffentlichung dieser Aufnahme, nicht das eines Remasters.\n')
    meta.title = (await prompt.ask(`Titel [${meta.title}]: `)) || meta.title
    meta.artist = (await prompt.ask(`Interpret [${meta.artist}]: `)) || meta.artist
    const y = await prompt.ask(`Jahr [${meta.year ?? '?'}]: `)
    if (y) meta.year = parseInt(y, 10)
    meta.album = (await prompt.ask(`Album [${meta.album ?? ''}]: `)) || meta.album
    console.log(`   Genres: ${GENRES.join(', ')}`)
    meta.genre = (await prompt.ask(`Genre [${meta.genre}]: `)) || meta.genre
    console.log('   „Wusstest du?“: ein Satz, nur wenn sicher wahr, ohne Jahreszahl. Leer = keiner.')
    meta.fact = (await prompt.ask('Fakt: ')) || meta.fact
    if (meta.fact) {
      console.log('   Derselbe Fakt auf Englisch (für die englische App). Leer = keiner.')
      meta.factEn = (await prompt.ask('Fakt (EN): ')) || meta.factEn
    }
    console.log('   Exot = kaum bekannt (Club-Track, Remix, Rarität); kommt nur, wenn die Runde Exoten erlaubt.')
    const ex = (await prompt.ask(`Exot? (j/n) [${meta.exotic ? 'j' : 'n'}]: `)).toLowerCase()
    if (ex) meta.exotic = ex.startsWith('j') || ex.startsWith('y')
  }

  if (!Number.isInteger(meta.year) || meta.year < 1900 || meta.year > new Date().getFullYear()) {
    throw new Error(`Kein gültiges Jahr (${meta.year}). Mit --year angeben.`)
  }
  for (const [label, text] of [['Der Fakt', meta.fact], ['Der englische Fakt', meta.factEn]]) {
    if (text && /\b(19|20)\d\d\b/.test(text)) {
      throw new Error(`${label} enthält eine Jahreszahl — die würde die Lösung verraten.`)
    }
  }
  if (meta.factEn && !meta.fact) throw new Error('Ein englischer Fakt braucht den deutschen Fakt (--fact).')
  return { meta, cover: { releaseGroupId: mb.releaseGroupId, itunesArtwork: it?.artwork ?? null } }
}

/** Download audio, fetch cover, upload both. Returns { audio: bool, cover: string|null }. */
export async function fetchMedia(song, coverInfo, { upload, search }) {
  // --search replaces only the YouTube query (some titles find nothing as written,
  // e.g. a filtered word or punctuation); the stored song keeps its real title
  const audio = Boolean(await downloadAndUploadSong(search ? { ...song, search } : song, { upload }))
  if (audio) {
    // Where the song becomes recognisable (quiet intros skipped)
    const file = path.join(AUDIO_DIR, `${song.id}.m4a`)
    const start = fs.existsSync(file) ? startFromLevels(rmsLevels(file)) : 0
    if (start > 0) song.startMs = start
    else delete song.startMs
  }
  const coverFile = path.join(COVER_DIR, `${song.id}.jpg`)
  const source = await fetchCover(coverInfo, coverFile)
  if (source) {
    console.log(`🖼️  Cover von ${source}`)
    if (upload) uploadFile(coverFile, 'covers')
  } else {
    console.warn('⚠️  Kein Cover gefunden — in der App erscheint ein Platzhalter.')
  }
  return { audio, cover: source }
}
