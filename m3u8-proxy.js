const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Add middleware to log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// For handling m3u8 playlist files
app.get('/proxy', async (req, res) => {
  try {
    // Get the original m3u8 URL from the query parameter
    const originalUrl = req.query.url;
    const forwardedIp = req.query.ip;
    const userAgent = req.query.ua;
    
    if (!originalUrl) {
      return res.status(400).send('Missing url parameter');
    }

    console.log(`Proxying URL: ${originalUrl}`);
    console.log(`IP: ${forwardedIp || 'Not provided'}`);
    console.log(`User-Agent: ${userAgent || 'Not provided'}`);
    
    // Check if this is a media file (.ts, .key, etc.) and redirect to media endpoint
    if (originalUrl.match(/\.(ts|key|aac|mp4|m4s|vtt)($|\?)/i)) {
      console.log('Detected media file, redirecting to /media endpoint');
      return res.redirect(`/media?url=${encodeURIComponent(originalUrl)}${forwardedIp ? '&ip='+encodeURIComponent(forwardedIp) : ''}${userAgent ? '&ua='+encodeURIComponent(userAgent) : ''}`);
    }
    
    // Parse the original URL to get its base
    let baseUrl, pathDirectory;
    try {
      const parsedUrl = new URL(originalUrl);
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const pathname = parsedUrl.pathname;
      pathDirectory = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      console.log(`Base URL: ${baseUrl}`);
      console.log(`Path Directory: ${pathDirectory}`);
    } catch (error) {
      console.error('URL parsing error:', error.message);
      return res.status(400).send(`Invalid URL format: ${error.message}`);
    }
    
    // Set up headers for the request
    const headers = {};
    if (forwardedIp) {
      headers['X-Forwarded-For'] = forwardedIp;
    }
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
    }
    
    // Add other potentially needed headers
    headers['Accept'] = '*/*';
    headers['Accept-Language'] = 'en-US,en;q=0.9';
    headers['Connection'] = 'keep-alive';
    
    console.log('Sending request with headers:', headers);
    
    // Fetch the original m3u8 playlist
    const response = await axios.get(originalUrl, { 
      headers,
      timeout: 10000, // 10 second timeout
      validateStatus: false // Don't throw on non-2xx responses
    });
    
    if (response.status !== 200) {
      console.error(`Source server returned status ${response.status}`);
      return res.status(response.status).send(`Source server error: ${response.statusText}`);
    }
    
    const playlist = response.data;
    console.log('Received playlist, length:', playlist.length);
    
    // Check if this is actually a playlist
    if (typeof playlist !== 'string' || !playlist.includes('#EXTM3U')) {
      console.error('Response does not appear to be an M3U8 playlist');
      // Forward the response as-is
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      return res.send(response.data);
    }
    
    console.log('First 100 chars:', playlist.substring(0, 100));
    
    // Replace URLs in the playlist
    let modifiedPlaylist = playlist;
    
    // Process absolute URLs (starting with http:// or https://)
    modifiedPlaylist = modifiedPlaylist.replace(
      /(https?:\/\/[^"\s\n]+)/g, 
      (match) => {
        // Don't modify URLs that are already pointing to our proxy
        if (match.includes(`${req.protocol}://${req.get('host')}`)) {
          return match;
        }
        // Encode the URL for use as a query parameter
        let proxyUrl = `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(match)}`;
        // Add optional parameters if they were provided
        if (forwardedIp) {
          proxyUrl += `&ip=${encodeURIComponent(forwardedIp)}`;
        }
        if (userAgent) {
          proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
        }
        return proxyUrl;
      }
    );
    
    // Process relative URLs for media files and sub-playlists
    modifiedPlaylist = modifiedPlaylist.replace(
      /^([^#][^:"\s\n]*\.(?:m3u8|ts|key|aac|mp4|m4s|vtt))/gm, 
      (match) => {
        let fullUrl;
        // Handle URLs that start with /
        if (match.startsWith('/')) {
          fullUrl = `${baseUrl}${match}`;
        } else {
          // Handle relative paths
          fullUrl = `${baseUrl}${pathDirectory}${match}`;
        }
        let proxyUrl = `${req.protocol}://${req.get('host')}/proxy?url=${encodeURIComponent(fullUrl)}`;
        // Add optional parameters if they were provided
        if (forwardedIp) {
          proxyUrl += `&ip=${encodeURIComponent(forwardedIp)}`;
        }
        if (userAgent) {
          proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
        }
        return proxyUrl;
      }
    );
    
    console.log('Modified playlist, first 100 chars:', modifiedPlaylist.substring(0, 100));
    
    // Set the appropriate content type
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(modifiedPlaylist);
    
  } catch (error) {
    console.error('Error proxying content:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

// For handling direct media segments (ts files) and encryption keys
app.get('/media', async (req, res) => {
  try {
    const mediaUrl = req.query.url;
    const forwardedIp = req.query.ip;
    const userAgent = req.query.ua;
    
    if (!mediaUrl) {
      return res.status(400).send('Missing url parameter');
    }
    
    console.log(`Proxying media: ${mediaUrl}`);
    
    // Set up headers for the request
    const headers = {};
    if (forwardedIp) {
      headers['X-Forwarded-For'] = forwardedIp;
    }
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
    }
    
    // Add potentially needed headers
    headers['Accept'] = '*/*';
    headers['Accept-Encoding'] = 'identity';  // Important for media files
    headers['Connection'] = 'keep-alive';
    
    console.log('Fetching media with headers:', headers);
    
    // Fetch the media segment or key
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      headers,
      responseType: 'arraybuffer',  // Important for binary data
      timeout: 30000, // 30 second timeout for media
      validateStatus: false,
      maxRedirects: 5
    });
    
    if (response.status !== 200) {
      console.error(`Media source returned status ${response.status}`);
      return res.status(response.status).send(`Media source error: ${response.statusText}`);
    }
    
    // Determine content type based on extension
    let contentType = response.headers['content-type'];
    if (!contentType) {
      if (mediaUrl.endsWith('.ts')) contentType = 'video/mp2t';
      else if (mediaUrl.endsWith('.m4s')) contentType = 'video/iso.segment';
      else if (mediaUrl.endsWith('.mp4')) contentType = 'video/mp4';
      else if (mediaUrl.endsWith('.aac')) contentType = 'audio/aac';
      else if (mediaUrl.endsWith('.vtt')) contentType = 'text/vtt';
      else if (mediaUrl.endsWith('.key')) contentType = 'application/octet-stream';
      else contentType = 'application/octet-stream';
    }
    
    // Forward the appropriate headers
    res.setHeader('Content-Type', contentType);
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    // Send the data directly
    res.send(response.data);
    
  } catch (error) {
    console.error('Error proxying media:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
    res.status(500).send(`Media proxy error: ${error.message}`);
  }
});

// Add a test route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>M3U8 Proxy Test</title></head>
      <body>
        <h1>M3U8 Proxy Server</h1>
        <p>Server is running! Use the /proxy endpoint to proxy m3u8 playlists.</p>
        <p>Usage: <code>/proxy?url=https://example.com/playlist.m3u8&ip=optional-ip&ua=optional-user-agent</code></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`M3U8 proxy server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log('Usage: http://localhost:3000/proxy?url=https://example.com/playlist.m3u8');
});
