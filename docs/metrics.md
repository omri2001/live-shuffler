# Metrics

Each track in your library is scored from 0 to 100 on every metric. When you set slider weights, the queue allocates slots proportionally — so setting Hip-Hop to 60 and Jazz to 40 means roughly 60% of your queue will be top hip-hop tracks and 40% top jazz.

Scores combine two signals:

- **Genre tags** from the track's artists and album artists (primary signal)
- **Audio features** like tempo, energy, and danceability from [ReccoBeats](https://reccobeats.com/) (secondary boost)

---

## Hebrew

**Type:** Binary (0 or 100)

Detects Hebrew-language music. Returns 100 if any of these match:

- Track or album name contains Hebrew characters (unicode range `\u0590-\u05FF`)
- Any artist name contains Hebrew characters
- Artist or album genres contain "hebrew" or "israeli"

---

## Non-English

**Type:** Binary (0 or 100)

Detects non-English-language music. Returns 100 if any of these match:

- Track, album, or artist name contains non-ASCII characters
- Genres match known non-English markers: latin, reggaeton, k-pop, j-pop, french, german, spanish, arabic, turkish, brazilian, afrobeat, bollywood, mizrahi, and many more

---

## Hip-Hop

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "hip hop", "rap", or "trap" | 75 |
| Album genres contain "hip hop", "rap", or "trap" | 60 |
| Subgenre bonus: gangsta rap, drill, grime, crunk | +10 |
| Speechiness boost (rap = high speechiness) | +0–15 |

---

## Pop

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "pop" | 70 |
| Album genres contain "pop" | 55 |
| Danceability boost | +0–15 |
| Valence (positivity) boost | +0–15 |

---

## Metal

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "metal", "metalcore", or "deathcore" | 75 |
| Album genres contain "metal", "metalcore", or "deathcore" | 60 |
| Subgenre bonus: death metal, black metal, thrash, doom, groove, nu, progressive | +15 |
| Energy boost | +0–10 |
| Low valence (dark/aggressive) boost | +0–5 |

---

## Jungle

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "jungle" | 75 |
| Album genres contain "jungle" | 60 |
| Subgenre bonus: breakcore, breakbeat, ragga jungle | +10 |
| Tempo >= 160 BPM | +15 |

---

## Drum & Bass

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "drum and bass", "dnb", "d&b", or "liquid funk" | 75 |
| Album genres contain the same | 60 |
| Subgenre bonus: neurofunk, jump up, liquid dnb | +10 |
| Tempo 165–185 BPM | +15 |

---

## Dubstep

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "dubstep", "brostep", or "riddim" | 75 |
| Album genres contain the same | 60 |
| Subgenre bonus: bass music, filthstep, tearout | +10 |
| Energy boost | +0–10 |
| Tempo 135–150 BPM | +10 |

---

## Jazz

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "jazz" | 75 |
| Album genres contain "jazz" | 60 |
| Subgenre bonus: bebop, swing, fusion, smooth jazz, nu jazz, acid jazz | +10 |
| Acousticness boost | +0–10 |
| Instrumentalness boost | +0–10 |

---

## Chill

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "chill", "lo-fi", "ambient", "downtempo", "chillwave", or "lounge" | 70 |
| Album genres contain the same | 55 |
| Low energy boost (inverse) | +0–15 |
| Acousticness boost | +0–10 |
| Tempo < 100 BPM | +10 |
| Tempo 100–120 BPM | +5 |

---

## Dance

**Type:** Graduated (0–100)

| Signal | Score |
|--------|-------|
| Artist genres contain "dance", "edm", "house", "techno", "trance", or "electro" | 70 |
| Album genres contain the same | 55 |
| Subgenre bonus: deep house, tech house, progressive house, euro dance | +10 |
| Danceability boost | +0–20 |
| Energy boost | +0–5 |

---

## Adding Your Own Metric

Create a new `.yml` file in `backend/app/metrics/`. The filename becomes the metric name.

For example, `backend/app/metrics/rock.yml`:

```yaml
type: graduated
genres:
  primary: [rock, alternative rock, indie rock]
  artist_score: 75
  album_score: 60
subgenres:
  keywords: [classic rock, punk rock, grunge]
  bonus: 10
audio_boosts:
  - feature: energy
    weight: 10
```

No code changes needed — it auto-appears in the UI and all score outputs on restart.

## YAML Reference

Full schema with all possible fields:

```yaml
# --- Type (required) ---
type: graduated      # "binary" (0 or 100) or "graduated" (0-100 composite score)

# --- Binary-only fields ---
text_regex: "[\u0590-\u05FF]"   # Regex matched against track name, album name, and artist names
genre_keywords:                  # List of keywords to match in artist/album genres
  - hebrew
  - israeli

# --- Graduated fields ---
genres:
  primary: [jazz]    # Genre keywords to match — this is the main signal
  artist_score: 75   # Base score when a primary keyword matches the track's artist genres
  album_score: 60    # Base score when a primary keyword matches album-level genres (weaker signal)

subgenres:
  keywords: [bebop, swing, fusion]  # Additional genre keywords for a bonus on top of the base score
  bonus: 10                         # Points added when any subgenre keyword matches

audio_boosts:                    # List of audio feature boosts, each adds 0 to `weight` points
  - feature: energy              # Audio feature name (energy, danceability, valence, speechiness, acousticness, instrumentalness, liveness, tempo)
    weight: 15                   # Multiplied by the feature value (0.0-1.0) to get bonus points
    invert: false                # If true, uses (1 - value) — e.g. low energy = high score for chill

tempo:                           # List of tempo ranges, only the first matching range applies
  - min: 165                     # Minimum BPM (inclusive, defaults to 0)
    max: 185                     # Maximum BPM (inclusive, defaults to infinity)
    bonus: 15                    # Points added when track tempo falls in this range
```

For metrics that need custom logic beyond what YAML supports, you can use the `@scorer` decorator in `backend/app/services/scoring.py`.
