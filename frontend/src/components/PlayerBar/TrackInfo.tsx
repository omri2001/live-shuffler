import type { Track } from '../../types/spotify';

export default function TrackInfo({ track }: { track: Track | null }) {
  if (!track) {
    return (
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-12 h-12 rounded bg-spotify-dark-lighter" />
        <div>
          <p className="text-sm text-spotify-gray">No track playing</p>
        </div>
      </div>
    );
  }

  const albumArt = track.album.images[track.album.images.length - 1]?.url;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      {albumArt ? (
        <img src={albumArt} alt={track.album.name} className="w-12 h-12 rounded" />
      ) : (
        <div className="w-12 h-12 rounded bg-spotify-dark-lighter" />
      )}
      <div className="text-left overflow-hidden">
        <p className="text-sm font-medium text-spotify-white truncate">{track.name}</p>
        <p className="text-xs text-spotify-gray truncate">
          {track.artists.map(a => a.name).join(', ')}
        </p>
      </div>
    </div>
  );
}
