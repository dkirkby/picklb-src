/* global VideoDecoder, EncodedVideoChunk */
import React, { useState, useRef, useEffect } from 'react';
import MP4Box from 'mp4box';

const PickleballAnalyzer = () => {
  const [url, setUrl] = useState(
    process.env.PUBLIC_URL + '/pbvideo/sample.mp4'
  );

  // JSON data: fps, motion values
  const [fps, setFps] = useState(30);
  const [motionData, setMotionData] = useState([]);

  // decoded frames and current index
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  const canvasRef = useRef(null);
  const decoderRef = useRef(null);

  // Load JSON metadata (fps, motion)
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
        setFps(typeof data.fps === 'number' ? data.fps : 30);
        setMotionData(Array.isArray(data.motion) ? data.motion : []);
      })
      .catch(err => {
        console.error('JSON load error:', err);
        setFps(30);
        setMotionData([]);
      });
  }, [url]);

  // Initialize WebCodecs + MP4Box demux
  useEffect(() => {
    let cancelled = false;
    let mp4boxFile = MP4Box.createFile();

    const decoder = new VideoDecoder({
      output: frame => {
        setFrames(prev => [...prev, frame]);
      },
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
      for (const sample of samples) {
        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sample.cts,
          data: new Uint8Array(sample.data)
        });
        decoder.decode(chunk);
      }
    };

    fetch(url)
      .then(res => {
        const reader = res.body.getReader();
        let offset = 0;
        function pump() {
          return reader.read().then(({ done, value }) => {
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
        }
        return pump();
      })
      .catch(err => console.error('Video fetch error (stream):', err));

    return () => {
      cancelled = true;
      decoder.close();
      mp4boxFile.flush();
      mp4boxFile = null;
      // close leftover frames
      frames.forEach(f => f.close());
    };
  }, [url]);

  // Draw when frames load or currentFrame changes
  useEffect(() => {
    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || !frames[currentFrame]) return;

      const frame = frames[currentFrame];
      let bitmap;
      try {
        bitmap = await createImageBitmap(frame);
      } catch (err) {
        console.error('Bitmap error:', err);
        return;
      }
      // draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      // overlay
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      const time = (currentFrame / fps).toFixed(3);
      const motionVal = (motionData[currentFrame] ?? 0).toFixed(2);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'yellow';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Time: ${time}s`, 10, canvas.height - 40);
      ctx.fillText(`Frame: ${currentFrame}`, 10, canvas.height - 20);
      ctx.fillText(`Motion: ${motionVal}`, 10, canvas.height);
    }
    draw();
  }, [frames.length, currentFrame, fps, motionData]);

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

  // Canvas resize
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
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
      </div>
    </div>
  );
};

export default PickleballAnalyzer;
