const Peer = window.Peer;

// const limit_date = new Date('2020/09/03 23:26:00');
// テストのため終了時刻を現在時刻から1分に設定
const limit_date = new Date();
limit_date.setSeconds(new Date().getSeconds() + 60);
const limit = limit_date.getTime();

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const localId = document.getElementById('js-local-id');
  const callTrigger = document.getElementById('js-call-trigger');
  const closeTrigger = document.getElementById('js-close-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
  const remoteId = document.getElementById('js-remote-id');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const lasttime = document.getElementById('lasttime');

  const index = Math.ceil( Math.random()*1000 );
  const peerID = 'test-' + index;

  let timer;
  const update_limit_time = function(){
    const now_date = new Date();
    console.log(now_date);
    const now_timestamp = now_date.getTime();
    console.log(limit);
    console.log(now_timestamp);
    console.log(limit - now_timestamp);
    console.log((limit - now_timestamp) / (1000));
    var diff_time = Math.floor((limit - now_timestamp) / (1000));
    console.log(diff_time);
    console.log('残り時間: ' + diff_time + '秒');
    if(diff_time > 0){
      lasttime.textContent = '残り時間: ' + diff_time + '秒';
      setTimeout(function(){
        timer = update_limit_time();
      }, 1000);
    } else {
      // 時間切れ
      lasttime.textContent = 'トーク終了しました';
      // 切断
      closeTrigger.click();
    }
  }
  const onClickSend = function(dataConnection) {
    const data = {
      name: peerID,
      msg: localText.value
    };
    dataConnection.send(data);

    messages.textContent += `You: ${data.msg}\n`;
    localText.value = '';
  };

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const localStream = await navigator.mediaDevices
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


  const peer = (window.peer = new Peer(peerID, {
    key: '976b1d6d-589e-48f6-8a9c-8f67e8062a7c',
    debug: 3,
  }));

  // Register caller handler
  callTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const mediaConnection = peer.call(remoteId.value, localStream);

    mediaConnection.on('stream', async stream => {
      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
      timer = setTimeout(function(){
        update_limit_time();
      }, 1000);

    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      clearTimeout(timer);
    });

    const dataConnection = peer.connect(remoteId.value);

    dataConnection.once('open', async () => {
      messages.textContent += `=== DataConnection has been opened ===\n`;
      sendTrigger.addEventListener('click', function(){
        onClickSend(dataConnection);
      });
    });

    dataConnection.on('data', ({ name, msg }) => {
      messages.textContent += `${name}: ${msg}\n`;
    });

    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    closeTrigger.addEventListener('click', () => {
      mediaConnection.close(true)
      dataConnection.close()
    });
  });

  peer.once('open', id => (localId.textContent = id));

  // Register callee handler
  peer.on('call', mediaConnection => {
    if(window.confirm("応答しますか？")){
      mediaConnection.answer(localStream);
    } else {
      mediaConnection.close(true)
    }

    mediaConnection.on('stream', async stream => {
      // Render remote stream for callee
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      clearTimeout(timer);
    });

    closeTrigger.addEventListener('click', () => mediaConnection.close(true));
  });


  // Register connected peer handler
  peer.on('connection', dataConnection => {
    dataConnection.once('open', async () => {
      messages.textContent += `=== DataConnection has been opened ===\n`;

      sendTrigger.addEventListener('click', function(){
        onClickSend(dataConnection);
      });
    });

    dataConnection.on('data', ({ name, msg }) => {
      messages.textContent += `${name}: ${msg}\n`;
    });

    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    // Register closing handler
    closeTrigger.addEventListener('click', () => dataConnection.close(), {
      once: true,
    });

  });

  peer.on('error', console.error);  



})();