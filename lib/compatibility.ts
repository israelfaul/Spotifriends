type CandidateSong = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  subgenres: string[];
};

export type CompatibilityResult = {
  score: number;
  exactSongMatches: number;
  artistMatches: number;
  sharedSubgenreCount: number;
  playlistBonusApplied: boolean;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function getSharedSubgenres(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(normalize));
  return a.map(normalize).filter((genre) => setB.has(genre));
}

export function calculateCompatibility(
  currentUserSongs: CandidateSong[],
  candidateSongs: CandidateSong[]
): CompatibilityResult {
  let rawScore = 0;
  let exactSongMatches = 0;
  let artistMatches = 0;
  let sharedSubgenreCount = 0;

  for (const mySong of currentUserSongs) {
    let bestMatchScore = 0;
    let bestMatchType: "song" | "artist" | "subgenre" | "none" = "none";
    let bestSharedSubgenreCount = 0;

    for (const otherSong of candidateSongs) {
      const sameSong =
        normalize(mySong.title) === normalize(otherSong.title) &&
        normalize(mySong.artist) === normalize(otherSong.artist);

      if (sameSong) {
        if (30 > bestMatchScore) {
          bestMatchScore = 30;
          bestMatchType = "song";
          bestSharedSubgenreCount = 0;
        }
        continue;
      }

      const sameArtist =
        normalize(mySong.artist) === normalize(otherSong.artist);

      if (sameArtist) {
        if (20 > bestMatchScore) {
          bestMatchScore = 20;
          bestMatchType = "artist";
          bestSharedSubgenreCount = 0;
        }
        continue;
      }

      const shared = getSharedSubgenres(mySong.subgenres, otherSong.subgenres);
      const subgenreScore = shared.length * 5;

      if (subgenreScore > bestMatchScore) {
        bestMatchScore = subgenreScore;
        bestMatchType = shared.length > 0 ? "subgenre" : "none";
        bestSharedSubgenreCount = shared.length;
      }
    }

    rawScore += bestMatchScore;

    if (bestMatchType === "song") {
      exactSongMatches += 1;
    } else if (bestMatchType === "artist") {
      artistMatches += 1;
    } else if (bestMatchType === "subgenre") {
      sharedSubgenreCount += bestSharedSubgenreCount;
    }
  }

  const playlistBonusApplied =
    exactSongMatches >= 2 ||
    artistMatches >= 2 ||
    sharedSubgenreCount >= 4;

  if (playlistBonusApplied) {
    rawScore += 10;
  }

  // Max possible:
  // 5 songs * 30 = 150
  // + playlist bonus 10
  // = 160
  const percentage = Math.round((rawScore / 160) * 100);

  return {
    score: Math.min(percentage, 100),
    exactSongMatches,
    artistMatches,
    sharedSubgenreCount,
    playlistBonusApplied,
  };
}