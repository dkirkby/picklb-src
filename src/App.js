import React, { useState, useRef, useEffect } from 'react';

const PickleballAnalyzer = () => {
  const [url, setUrl] = useState(
    process.env.PUBLIC_URL + '/pbvideo/sample.mp4'
  );
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fps, setFps] = useState(30);            // ← default until JSON loads
  const [motionData, setMotionData] = useState([]); // ← array of motion values

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load video and apply playback rate
  const loadVideo = () => {
    const video = videoRef.current;
    if (video) {
      video.load();
      video.playbackRate = playbackRate;
    }
  };

  // Sync playbackRate to the video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Whenever URL changes, fetch the JSON alongside it
  useEffect(() => {
    const jsonUrl = url.replace(/\.mp4$/, '.json');
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        // pull fps and motion out
        setFps(typeof data.fps === 'number' ? data.fps : 30);
        setMotionData(Array.isArray(data.motion) ? data.motion : []);
      })
      .catch(err => {
        console.error('Failed to load motion JSON:', err);
        // fallback
        setFps(30);
        setMotionData([]);
      });
  }, [url]);

  // Canvas overlay: inset rectangle + time + frame + motion
  useEffect(() => {
    const drawOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // match canvas to video display size
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // red inset rectangle
      ctx.beginPath();
      ctx.rect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.stroke();

      // compute time, frame, motion
      const currentTime = video.currentTime;
      const frameNumber = Math.floor(currentTime * fps);
      const motionVal =
        motionData.length > frameNumber ? motionData[frameNumber] : 0;

      // draw text
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'yellow';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Time: ${currentTime.toFixed(3)}s`, 10, canvas.height - 10 - 40);
      ctx.fillText(`Frame: ${frameNumber}`,     10, canvas.height - 10 - 20);
      ctx.fillText(`Motion: ${motionVal.toFixed(2)}`, 10, canvas.height - 10);
    };

    // attach listeners
    window.addEventListener('resize', drawOverlay);
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadeddata', drawOverlay);
      video.addEventListener('timeupdate',  drawOverlay);
      video.addEventListener('seeked',      drawOverlay);
    }
    drawOverlay();

    // cleanup
    return () => {
      window.removeEventListener('resize', drawOverlay);
      if (video) {
        video.removeEventListener('loadeddata', drawOverlay);
        video.removeEventListener('timeupdate',  drawOverlay);
        video.removeEventListener('seeked',      drawOverlay);
      }
    };
  }, [url, playbackRate, fps, motionData]);

  // Keyboard controls, now using dynamic fps for step size
  useEffect(() => {
    const handleKeyDown = (e) => {
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'ArrowRight':
          video.pause();
          video.currentTime += 1 / fps;
          break;
        case 'ArrowLeft':
          video.pause();
          video.currentTime -= 1 / fps;
          break;
        case 'ArrowUp':
          setPlaybackRate(rate => {
            const speeds = [0.1, 1, 10];
            const idx = speeds.indexOf(rate);
            return speeds[Math.min(idx + 1, speeds.length - 1)];
          });
          break;
        case 'ArrowDown':
          setPlaybackRate(rate => {
            const speeds = [0.1, 1, 10];
            const idx = speeds.indexOf(rate);
            return speeds[Math.max(idx - 1, 0)];
          });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fps]);  // ← rebind if fps changes

  return (
    <div style={{ width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      {/* Video + Canvas */}
      <div style={{ position: 'relative', width: '100%' }}>
        <video
          key={url}
          ref={videoRef}
          src={url}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          Your browser does not support the video tag.
        </video>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* URL input + Load */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginTop: '16px',
        }}
      >
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Enter local video path"
          style={{
            flexGrow: 1,
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <button
          onClick={loadVideo}
          style={{
            background: '#2563eb',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Load Video
        </button>
      </div>
    </div>
  );
};

export default PickleballAnalyzer;
