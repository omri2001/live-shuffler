export default function LoginButton() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-spotify-dark px-6">
      <div className="max-w-md w-full text-center">
        {/* Logo / Title */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-full bg-spotify-green mx-auto mb-5 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" fill="#000" />
              <circle cx="18" cy="16" r="3" fill="#000" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-spotify-white mb-3">Live Shuffler</h1>
          <p className="text-spotify-gray text-lg">Smart shuffle for your Spotify library</p>
        </div>

        {/* Features */}
        <div className="mb-10 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-spotify-green mt-0.5 shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9h12M9 3l6 6-6 6" /></svg>
            </span>
            <div>
              <p className="text-sm font-medium text-spotify-white">Weighted genre sliders</p>
              <p className="text-xs text-spotify-gray">Control your queue mix with 16 music metrics</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-spotify-green mt-0.5 shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9h12M9 3l6 6-6 6" /></svg>
            </span>
            <div>
              <p className="text-sm font-medium text-spotify-white">Real-time queue control</p>
              <p className="text-xs text-spotify-gray">Skip, reorder, and manage playback live</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-spotify-green mt-0.5 shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9h12M9 3l6 6-6 6" /></svg>
            </span>
            <div>
              <p className="text-sm font-medium text-spotify-white">Load from any source</p>
              <p className="text-xs text-spotify-gray">Liked songs, playlists, or albums</p>
            </div>
          </div>
        </div>

        {/* Login button */}
        <a
          href="/api/auth/login"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-spotify-green text-black font-bold text-lg hover:bg-spotify-green-hover transition-colors no-underline"
        >
          Connect with Spotify
        </a>

        <p className="text-spotify-gray/50 text-xs mt-6">Requires a Spotify Premium account</p>
      </div>
    </div>
  );
}
