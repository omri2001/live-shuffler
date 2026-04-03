import { usePlayer } from '../../context/PlayerContext';
import TrackInfo from './TrackInfo';
import PlaybackControls from './PlaybackControls';
import ProgressSlider from './ProgressSlider';

export default function PlayerBar() {
  const { state } = usePlayer();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark-light border-t border-spotify-dark-lighter px-4 py-2">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        {/* Track Info - Left */}
        <TrackInfo track={state.currentTrack} />

        {/* Controls + Progress - Center */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <PlaybackControls />
          <ProgressSlider />
        </div>

        {/* Spacer - Right */}
        <div className="min-w-[200px]" />
      </div>
    </div>
  );
}
