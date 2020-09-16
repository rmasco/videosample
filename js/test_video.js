'use strict';

(async function main() {
  //event handler
  document.querySelector("button#startTest").addEventListener("click", async (event) => {
    document.getElementById("container").style.display = "block";
    document.getElementById("startTest").style.display = "none";

    // ビデオ出力
    var localStream = null
    const localVideo = document.getElementById('js-local-stream');
    const localAudio = document.getElementById('js-local-audio');
    const audioInputSelect = document.querySelector('select#audioSource');
    const audioOutputSelect = document.querySelector('select#audioOutput');
    const videoSelect = document.querySelector('select#videoSource');
    const selectors = [audioInputSelect, audioOutputSelect, videoSelect];
    // マイク出力
    var audioctx = new AudioContext();
    var mode = 0;
    var timerId;
    var analyser = audioctx.createAnalyser();
    analyser.fftSize = 1024;

    var ctx = document.getElementById("graph").getContext("2d");
    const DrawGraph = () => {
        ctx.fillStyle = "rgba(34, 34, 34, 1.0)";
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle="rgba(255, 255, 255, 1)";
        var data = new Uint8Array(512);
        if(mode == 0) analyser.getByteFrequencyData(data); //Spectrum Data
        else analyser.getByteTimeDomainData(data); //Waveform Data
        if(mode!=0) ctx.beginPath();
        for(var i = 0; i < 256; ++i) {
            if(mode==0) {
                ctx.fillStyle = "rgba(204, 204, 204, 0.8)";
                ctx.fillRect(i*2, 256 - data[i], 1, data[i]);
            } else {
                ctx.lineTo(i*2, 256 - data[i]);
            }
        }
        if(mode!=0) {
            ctx.stroke();
        }
        requestAnimationFrame(DrawGraph);
    }
    timerId=requestAnimationFrame(DrawGraph);
    var getUserMedia = navigator.getUserMedia ? 'getUserMedia' :
    navigator.webkitGetUserMedia ? 'webkitGetUserMedia' :
    navigator.mozGetUserMedia ? 'mozGetUserMedia' :
    navigator.msGetUserMedia ? 'msGetUserMedia' :
    undefined;
    var micsrc;

    localStream = await navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true,
      })
      .catch(console.error);
    // Render local stream
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.playsInline = true;
    
    micsrc=audioctx.createMediaStreamSource(localStream);
    // スピーカーに出力はしないのでコメントアウト
    //micsrc.connect(audioctx.destination);
    micsrc.connect(analyser);

    await localVideo.play().catch(console.error);
    //await localAudio.play().catch(console.error);
    // 選択関連
    const getDevices = function() {
      navigator.mediaDevices.enumerateDevices().then(function(deviceInfos) { // 成功時
        // Handles being called several times to update labels. Preserve values.
        const values = selectors.map(select => select.value);
        selectors.forEach(select => {
          while (select.firstChild) {
            select.removeChild(select.firstChild);
          }
        });
        for (let i = 0; i !== deviceInfos.length; ++i) {
          const deviceInfo = deviceInfos[i];
          const option = document.createElement('option');
          option.value = deviceInfo.deviceId;
          if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
            audioInputSelect.appendChild(option);
          } else if (deviceInfo.kind === 'audiooutput') {
            option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
            audioOutputSelect.appendChild(option);
          } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
          } else {
            console.log('Some other kind of source/device: ', deviceInfo);
          }
        }
        selectors.forEach((select, selectorIndex) => {
          if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
          }
        });
      })
    }
    const changeAudioDestination = function(e){ 
      localAudio.pause();
      localAudio.currentTime = 0;
      localAudio.setSinkId(e.currentTarget.value).then(()=>{
        console.log('set ' + audio.sinkId);
      }).catch(error=>{
        console.log(error);
      })
      //localAudio.play();
    }

    const changeDevices = async function(){
      stopStreamedVideo(localVideo);
      const audioSource = audioInputSelect.value;
      const videoSource = videoSelect.value;
      const constraints = {
        audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
        video: {deviceId: videoSource ? {exact: videoSource} : undefined}
      };

      localStream = await navigator.mediaDevices
                                    .getUserMedia(constraints)
                                    .catch(console.error);
      // Render local stream
      localVideo.muted = true;
      localVideo.srcObject = localStream;
      localVideo.playsInline = true;
      
      micsrc=audioctx.createMediaStreamSource(localStream);
      // スピーカーに出力はしないのでコメントアウト
      //micsrc.connect(audioctx.destination);
      micsrc.connect(analyser);

      await localVideo.play().catch(console.error);
    }
    function stopStreamedVideo(videoElem) {
      let stream = videoElem.srcObject;
      let tracks = stream.getTracks();
      tracks.forEach(function(track) {
          track.stop();
      });
      videoElem.srcObject = null;
    }

    getDevices()
    audioInputSelect.onchange = changeDevices;
    audioOutputSelect.onchange = changeAudioDestination;
    videoSelect.onchange = changeDevices;
  });
})();
