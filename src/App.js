import React, { useState, useRef, useEffect } from 'react';

const FPS = 30;

const PickleballAnalyzer = () => {
  const [url, setUrl] = useState(
    process.env.PUBLIC_URL + '/pbvideo/sample.mp4'
  );
  const [playbackRate, setPlaybackRate] = useState(1);
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

  // Sync playbackRate
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Canvas overlay: rectangle + time and frame number
  useEffect(() => {
    const drawOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Inset rectangle
      ctx.beginPath();
      ctx.rect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Time and frame number
      const currentTime = video.currentTime;
      const timeText = currentTime.toFixed(3) + 's';
      const frameNumber = Math.floor(currentTime * FPS);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'yellow';
      ctx.textBaseline = 'bottom';
      // Display time above frame number
      ctx.fillText(`Time: ${timeText}`, 10, canvas.height - 10 - 20);
      ctx.fillText(`Frame: ${frameNumber}`, 10, canvas.height - 10);
    };

    window.addEventListener('resize', drawOverlay);
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadeddata', drawOverlay);
      video.addEventListener('timeupdate', drawOverlay);
      video.addEventListener('seeked', drawOverlay);
    }
    drawOverlay();
    return () => {
      window.removeEventListener('resize', drawOverlay);
      if (video) {
        video.removeEventListener('loadeddata', drawOverlay);
        video.removeEventListener('timeupdate', drawOverlay);
        video.removeEventListener('seeked', drawOverlay);
      }
    };
  }, [url, playbackRate]);

  // Keyboard controls
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
          video.currentTime += 1 / FPS;
          break;
        case 'ArrowLeft':
          video.pause();
          video.currentTime -= 1 / FPS;
          break;
        case 'ArrowUp':
          setPlaybackRate((rate) => {
            const speeds = [0.1, 1, 10];
            const idx = speeds.indexOf(rate);
            return speeds[Math.min(idx + 1, speeds.length - 1)];
          });
          break;
        case 'ArrowDown':
          setPlaybackRate((rate) => {
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
  }, []);

  return (
    <div style={{ width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      {/* Video with canvas overlay */}
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

      {/* URL input and load button */}
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
          onChange={(e) => setUrl(e.target.value)}
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
