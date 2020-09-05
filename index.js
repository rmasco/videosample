const Peer = window.Peer;

// const limit_date = new Date('2020/09/03 23:26:00');
// テストのため終了時刻を現在時刻から1分に設定
let limit_date = new Date();
limit_date.setSeconds(new Date().getSeconds() + 60);
let limit_time = limit_date.getTime();

(async function main() {
  // ビデオチャット機能
  const localVideo = document.getElementById('js-local-stream');
  const localId = document.getElementById('js-local-id');
  const callTrigger = document.getElementById('js-call-trigger');
  const closeTrigger = document.getElementById('js-close-trigger');
  const videoMuteTrigger = document.getElementById('js-video-mute-trigger');
  const audioMuteTrigger = document.getElementById('js-audio-mute-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
  const remoteId = document.getElementById('js-remote-id');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  // メッセージ機能
  const fileSendTrigger = document.getElementById('js-file-send-trigger');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const lasttime = document.getElementById('lasttime');

  // ID
  const index = Math.ceil( Math.random()*1000 );
  const peerID = 'test-' + index;

  // 再接続処理
  const get_last_connect = function(){
    // ローカルストレージから一時データ取得
    // 形式: limit_date
    //      remoteId
    const talk_json = localStorage.getItem('talk');
    // 一時データがなければ終了
    if(!talk_json) return
    // 一時データをパース
    const talk_obj = JSON.parse(talk_json);
    // 制限時刻を過ぎているかチェック
    if(Math.floor((new Date(talk_obj.limit_date).getTime() - new Date().getTime()) / (1000)) > 0){
      // 接続時間内の場合は再接続するかどうか
      if(window.confirm("再接続しますか？ ID: " + talk_obj.remoteId )){
        // limitを再接続前のものに変更
        limit_date = new Date(talk_obj.limit_date);
        limit_time = limit_date.getTime();
        remoteId.value = talk_obj.remoteId;
        lasttime.textContent = '再接続待ち...';
        // peerがopenしたら再接続
        peer.once('open', () => {
          callTrigger.click()
        });
      }
    } else {
      // 接続時間切れの場合クリア
      localStorage.removeItem('talk');
    }
  }

  // 制限時間を更新して、時間切れであれば終了する
  let timer;
  const update_limit_time = function(){
    const now_date = new Date();
    console.log(now_date);
    const now_timestamp = now_date.getTime();
    console.log(limit_time);
    console.log(now_timestamp);
    console.log(limit_time - now_timestamp);
    console.log((limit_time - now_timestamp) / (1000));
    const diff_time = Math.floor((limit_time - now_timestamp) / (1000));
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

  // メッセージ送信処理
  const onClickSend = function(dataConnection) {
    const data = {
      name: peerID,
      msg: localText.value
    };
    dataConnection.send(data);

    messages.textContent += `You: ${data.msg}\n`;
    localText.value = '';
  };
  // ファイル送信処理
  localFile = null
  const onClickFileSend = function(dataConnection) {
    var reader = new FileReader()
    reader.onload = () => {
      const data = {
        name: peerID,
        file_name: localFile.name,
        file: reader.result
      };
      dataConnection.send(data);
    };
    reader.readAsDataURL(localFile)
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
      
      let json = JSON.stringify({
        'remoteId': remoteId.value,
        'limit_date': limit_date
      });
      localStorage.setItem('talk', json);
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

    dataConnection.on('data', ({ name, msg, file_name, file}) => {
      if (msg) {
        messages.textContent += `${name}: ${msg}\n`;        
      }else{
        //messages.textContent += file  
        fileRecieved(file_name, file)
      }
    });

    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    closeTrigger.addEventListener('click', () => {
      mediaConnection.close(true)
      dataConnection.close()
    });

    fileSendTrigger.addEventListener("change", function(e) {
      console.log(e.target.files)
      localFile = e.target.files[0]
      onClickFileSend(dataConnection)
     },false);
  });

  // ビデオ Mute機能
  isVideoMute = false
  videoMuteTrigger.addEventListener('click', () => {
    try {
      isVideoMute = !isVideoMute
      var videoTrack = localStream.getVideoTracks()[0];
      if(isVideoMute){
        videoTrack.enabled = false
        // Todo ボタン表示の切り替え
      }else {
        videoTrack.enabled = true
        // Todo ボタン表示の切り替え
      }
    } catch (error) {
      // Todo メッセージ外だし
      window.confirm("予期せぬエラーが発生しました。")
    }
  });
  // オーディオ Mute機能
  isAudioMute = false
  audioMuteTrigger.addEventListener('click', () => {
    try {
      isAudioMute = ! isAudioMute
      var audioTrack = localStream.getAudioTracks()[0];
      if(isAudioMute){
        audioTrack.enabled = false
        // Todo ボタン表示の切り替え
      }else {
        audioTrack.enabled = true
        // Todo ボタン表示の切り替え
      }
    } catch (error) {
      // Todo メッセージ外だし
      window.confirm("予期せぬエラーが発生しました。")
    }
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

    dataConnection.on('data', ({ name, msg, file_name, file}) => {
      if (msg) {
        messages.textContent += `${name}: ${msg}\n`;        
      }else{
        //messages.textContent += file
        fileRecieved(file_name, file)
      }
    });

    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    // Register closing handler
    closeTrigger.addEventListener('click', () => dataConnection.close(), {
      once: true,
    });

    fileSendTrigger.addEventListener("change", function(e) {
      console.log(e.target.files)
      localFile = e.target.files[0]
      onClickFileSend(dataConnection)
     },false);
  });
  const fileRecieved = function(file_name, file){
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.download = file_name;
    a.href = file;
    a.click();
    a.remove();
    URL.revokeObjectURL(file);
  }

  peer.on('error', console.error);  

  // 再接続処理
  get_last_connect();

})();