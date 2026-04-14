import express from 'express';
import ytdl from 'ytdl-core';
import sanitize from 'sanitize-filename';

const app = express();
const port = process.env.PORT || 3100;

function extractYouTubeId(url) {
  const match = url.match(/[?&]v=([\w-]{11})/);
  return match ? match[1] : null;
}

app.get('/watch', async (req, res) => {
  const host = req.hostname;
  if (!host.endsWith('novaa.dev')) {
    return res.status(404).send('Not found');
  }
  const videoId = extractYouTubeId(req.url);
  if (!videoId) {
    return res.status(400).send('Invalid YouTube link');
  }
  if (!req.query.format) {
    try {
      const info = await ytdl.getInfo(videoId);
      const formats = ytdl.filterFormats(info.formats, 'audioandvideo').concat(ytdl.filterFormats(info.formats, 'audioonly'));
      let html = `<h2>Select format for download</h2><form method="GET">
        <input type="hidden" name="v" value="${videoId}">
        <select name="format">`;
      for (const f of formats) {
        html += `<option value="${f.itag}">${f.container} - ${f.qualityLabel || f.audioBitrate + 'kbps'} - ${f.mimeType}</option>`;
      }
      html += `</select><button type="submit">Download</button></form>`;
      res.send(html);
    } catch (e) {
      res.status(500).send('Failed to fetch video info');
    }
    return;
  }
  try {
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: req.query.format });
    if (!format) return res.status(400).send('Invalid format');
    const title = sanitize(info.videoDetails.title);
    const author = sanitize(info.videoDetails.author.name);
    const filename = `${title} - ${author}.${format.container}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format.mimeType.split(';')[0]);
    res.setHeader('X-Download-Time', new Date().toISOString());
    res.setHeader('X-YouTube-Link', `https://www.youtube.com/watch?v=${videoId}`);
    res.setHeader('X-Video-Title', title);
    res.setHeader('X-Video-Author', author);
    let downloaded = 0;
    const stream = ytdl.downloadFromInfo(info, { format });
    stream.on('progress', (chunkLength, downloadedSoFar, totalSize) => {
      downloaded = downloadedSoFar;
    });
    stream.pipe(res);
  } catch (e) {
    res.status(500).send('Download failed');
  }
});

app.listen(port, () => {
  console.log(`YouTube Downloader listening on port ${port}`);
});
