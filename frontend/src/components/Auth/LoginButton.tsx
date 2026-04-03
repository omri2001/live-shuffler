export default function LoginButton() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-spotify-dark">
      <h1 className="text-4xl font-bold mb-2 text-spotify-white">Live Shuffle</h1>
      <p className="text-spotify-gray mb-8">Connect your Spotify account to get started</p>
      <a
        href="/api/auth/login"
        className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-spotify-green text-black font-bold text-lg hover:bg-spotify-green-hover transition-colors no-underline"
      >
        Connect with Spotify
      </a>
    </div>
  );
}
