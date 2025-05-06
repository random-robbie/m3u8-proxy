# M3U8 Proxy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight Node.js proxy server for M3U8 playlists that rewrites URLs to route all HLS traffic through your server. Useful for circumventing region restrictions, adding custom headers, or debugging video streaming issues.

## Features

- 🔄 Proxies M3U8 playlists and all their associated media segments
- 🔀 Handles both absolute and relative URLs in playlists
- 📋 Supports custom HTTP headers like X-Forwarded-For and User-Agent
- 🧩 Works with HLS live streams and VOD content
- 🔍 Detailed logging for debugging
- 📱 Compatible with various media players (VLC, web browsers, etc.)

## Installation

```bash
# Clone the repository
git clone https://github.com/random-robbie/m3u8-proxy.git

# Navigate to the directory
cd m3u8-proxy

# Install dependencies
npm install express axios
```

## Usage

### Starting the server

```bash
node m3u8-proxy.js
```

This will start the proxy server on port 3000 (or the port specified in your environment variable `PORT`).

### Proxying an M3U8 playlist

Access your proxy with:

```
http://localhost:3000/proxy?url=https://example.com/playlist.m3u8
```

### With custom headers

You can add optional parameters:

- `ip` - Sets the X-Forwarded-For header
- `ua` - Sets the User-Agent header

Example:

```
http://localhost:3000/proxy?url=https://example.com/playlist.m3u8&ip=123.45.67.89&ua=Mozilla/5.0
```

### In media players

1. **VLC**: Media > Open Network Stream > paste the proxy URL
2. **MPV**: `mpv http://localhost:3000/proxy?url=https://example.com/playlist.m3u8`
3. **Web player**: Use any HLS-compatible web player with the proxy URL

## How It Works

The proxy:

1. Fetches the original M3U8 playlist
2. Parses and modifies all URLs in the playlist to point to the proxy
3. Handles media segments (.ts files, encryption keys, etc.) separately
4. Preserves content types and headers for proper playback

## Advanced Configuration

Edit the `m3u8-proxy.js` file to:

- Change the default port
- Add additional headers
- Implement custom authentication
- Modify caching behavior

## Use Cases

- Bypass geographic restrictions (when legal)
- Debug streaming issues with detailed logs
- Add custom headers required by certain streaming services
- Test different client configurations

## Security Considerations

This proxy is designed for personal use and testing. If deploying to production:

- Add proper authentication
- Consider rate limiting
- Be aware of legal implications in your jurisdiction

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built using Express.js and Axios
- Inspired by various HLS proxy implementations

---

Created by [random-robbie](https://github.com/random-robbie) - Star this repo if you find it useful!
