/* global VideoDecoder, EncodedVideoChunk */
import React, { useState, useRef, useEffect } from 'react';
import MP4Box from 'mp4box';

const PickleballAnalyzer = () => {
  const [url, setUrl] = useState(
    process.env.PUBLIC_URL + '/pbvideo/sample.mp4'
  );

  // Metadata from JSON: name, fps, motion, nframes
  const [fileName, setFileName] = useState('');
  const [fps, setFps] = useState(30);
  const [motionData, setMotionData] = useState([]);
  const [numFrames, setNumFrames] = useState(0);

  // Thumbnail states
  const [thumbImage, setThumbImage] = useState(null);
  const [thumbError, setThumbError] = useState(false);

  // Decoded frames and current index
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  const canvasRef = useRef(null);
  const decoderRef = useRef(null);

  // Load JSON metadata
  useEffect(() => {
    const jsonUrl = url.replace(/\.mp4$/, '.json');
    fetch(jsonUrl)
      .then(res => {
        if (!res.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Not JSON');
        }
        return res.json();
      })
      .then(data => {
        setFileName(data.name || url.split('/').pop());
        setFps(typeof data.fps === 'number' ? data.fps : 30);
        setMotionData(Array.isArray(data.motion) ? data.motion : []);
        setNumFrames(typeof data.nframes === 'number' ? data.nframes : 0);
      })
      .catch(err => {
        console.error('JSON load error:', err);
        setFileName(url.split('/').pop());
        setFps(30);
        setMotionData([]);
        setNumFrames(0);
      });
  }, [url]);

  // Load thumbnail
  useEffect(() => {
    const img = new Image();
    img.onload = () => setThumbImage(img);
    img.onerror = () => setThumbError(true);
    img.src = url.replace(/\.mp4$/, '.jpg');
  }, [url]);

  // Initialize WebCodecs + MP4Box demux
  useEffect(() => {
    let mp4boxFile = MP4Box.createFile();

    const decoder = new VideoDecoder({
      output: frame => setFrames(prev => [...prev, frame]),
      error: err => console.error('Decoder error:', err)
    });
    decoderRef.current = decoder;

    mp4boxFile.onReady = info => {
      const track = info.tracks.find(t => t.video);
      if (!track) return;
      decoder.configure({ codec: track.codec });
      mp4boxFile.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (id, user, samples) => {
      samples.forEach(sample => {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sample.cts,
          data: new Uint8Array(sample.data)
        });
        decoder.decode(chunk);
      });
    };

    fetch(url)
      .then(res => {
        const reader = res.body.getReader();
        let offset = 0;
        const pump = () => reader.read().then(({ done, value }) => {
          if (done) {
            mp4boxFile.flush();
            return;
          }
          const buf = value.buffer;
          buf.fileStart = offset;
          offset += buf.byteLength;
          mp4boxFile.appendBuffer(buf);
          return pump();
        });
        return pump();
      })
      .catch(err => console.error('Video fetch error:', err));

    return () => {
      decoder.close();
      mp4boxFile.flush();
      mp4boxFile = null;
      frames.forEach(f => f.close());
    };
  }, [url]);

  // Draw on canvas when frame changes
  useEffect(() => {
    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || !frames[currentFrame]) return;

      const bitmap = await createImageBitmap(frames[currentFrame]);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    }
    draw();
  }, [currentFrame, frames]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame(i => Math.min(frames.length - 1, i + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame(i => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length]);

  // Canvas resize and CSS layout
  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ width: '100%', padding: 16, boxSizing: 'border-box' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: frames.length === 0 && thumbError ? 'black' : 'none'
        }}
      >
        {/* Initial overlay */}
        {frames.length === 0 && (
          <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div
              style={{ position: 'absolute', inset: 0 }}
            >
              {!thumbError && thumbImage && (
                <img
                  src={url.replace(/\.mp4$/, '.jpg')}
                  alt="thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                textAlign: 'center'
              }}
            >
              <div style={{ marginBottom: 8 }}>Video: {fileName}</div>
              <div style={{ marginBottom: 8 }}>Frames: {numFrames}</div>
              <div style={{ marginBottom: 16 }}>FPS: {fps}</div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: '4px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }}
              />
            </div>
          </>
        )}
        {/* Video frame canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>
      {/* URL input */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Enter local video path"
          style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
      </div>
    </div>
  );
};

export default PickleballAnalyzer;
