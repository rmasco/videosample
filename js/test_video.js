/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

(async function main() {
  var localStream = null
  const localVideo = document.getElementById('js-local-stream');
  const localAudio = document.getElementById('js-local-audio');
  const audioInputSelect = document.querySelector('select#audioSource');
  const audioOutputSelect = document.querySelector('select#audioOutput');
  const videoSelect = document.querySelector('select#videoSource');
  const selectors = [audioInputSelect, audioOutputSelect, videoSelect];
  
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
  await localVideo.play().catch(console.error);


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
    localAudio.play();
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
})();
