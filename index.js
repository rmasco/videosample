const Peer = window.Peer;

//パラメータを取得
dictParams = getParams(location.href)
const userId = dictParams['u']  // ユーザーID
const guestId = dictParams['g'] // ゲストID
const section = dictParams['s'] // セクションID (e.g. 202009081210)  
if(section != undefined){
  var limit_date = new Date(parseInt(section.substring(0, 4)), parseInt(section.substring(4, 6)) - 1, parseInt(section.substring(6, 8)), parseInt(section.substring(8, 10)), parseInt(section.substring(10, 12)));
  limit_date = new Date()// TODO テスト用のため削除
  var limit_time = limit_date.getTime();
}

(async function main() {

  // ビデオチャット機能
  const localVideo = document.getElementById('js-local-stream');
  const localId = document.getElementById('js-local-id');
  const callTrigger = document.getElementById('js-call-trigger');
  const closeTrigger = document.getElementById('js-close-trigger');
  const videoMuteTrigger = document.getElementById('js-video-mute-trigger');
  const audioMuteTrigger = document.getElementById('js-audio-mute-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
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
  const peerID = userId;

  // 再接続処理
  // 再接続を行った場合は、true
  // 再接続を行わなかった場合は、false
  const connect_last_connection = function(){
    // ローカルストレージから一時データ取得
    // 形式: limit_date
    //      remote_id
    const talk_json = localStorage.getItem('talk');
    // 一時データがなければ終了
    if(!talk_json) return false
    // 一時データをパース
    const talk_obj = JSON.parse(talk_json);
    // 制限時刻を過ぎているかチェック
    if(Math.floor((new Date(talk_obj.limit_date).getTime() - new Date().getTime()) / (1000)) > 0){
      // 接続時間内の場合は再接続するかどうか
      if(window.confirm("再接続しますか？ ID: " + talk_obj.remote_id )){
        // limitを再接続前のものに変更
        limit_date = new Date(talk_obj.limit_date);
        limit_time = limit_date.getTime();
        remote_id.value = talk_obj.remote_id;
        lasttime.textContent = '再接続待ち...';
        call()        
        return true;
      }else {
        return false;
      }
    } else {
      // 接続時間切れの場合クリア
      localStorage.removeItem('talk');
      return false;
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
  callTrigger.addEventListener('click', call);
  function call (){
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }
    const mediaConnection = peer.call(guestId, localStream);
    mediaConnection.on('stream', async stream => {

      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
      timer = setTimeout(function(){
        update_limit_time();
      }, 1000);
      
      let json = JSON.stringify({
        'remote_id': guestId,
        'limit_date': limit_date
      });
      localStorage.setItem('talk', json);
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      clearTimeout(timer);
    });

    const dataConnection = peer.connect(guestId);

    dataConnection.once('open', async () => {
      messages.textContent += `=== DataConnection has been opened ===\n`;
      sendTrigger.addEventListener('click', function(){
        onClickSend(dataConnection);
      });
      // 通話枠情報を送信する
      dataConnection.send({
        remote_id: userId,
        limit_date: limit_date
      });
    });

    dataConnection.on('data', recieve);

    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    closeTrigger.addEventListener('click', () => {
      closeDataConnection(dataConnection);
      closeMediaConnection(mediaConnection);
    });

    fileSendTrigger.addEventListener("change", function(e) {
      console.log(e.target.files)
      localFile = e.target.files[0]
      onClickFileSend(dataConnection)
     },false);
  }

  // 受信処理
  // ビデオ受信処理
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

    closeTrigger.addEventListener('click', () =>  closeMediaConnection(mediaConnection));
  });

  // データ接続受信処理
  // Register connected peer handler
  peer.on('connection', dataConnection => {
    dataConnection.once('open', async () => {
      messages.textContent += `=== DataConnection has been opened ===\n`;
      sendTrigger.addEventListener('click', function(){
        onClickSend(dataConnection);
      });
    });

    dataConnection.on('data', recieve);
    dataConnection.once('close', () => {
      messages.textContent += `=== DataConnection has been closed ===\n`;
      sendTrigger.removeEventListener('click', onClickSend);
    });

    // Register closing handler
    closeTrigger.addEventListener('click', () => close(dataConnection), {
      once: true,
    });

    fileSendTrigger.addEventListener("change", function(e) {
      console.log(e.target.files)
      localFile = e.target.files[0]
      onClickFileSend(dataConnection)
     },false);
  });
  const recieve = function(args) {
    if (args['msg']) {
      messages.textContent += `${args['name']}: ${args['msg']}\n`;        
    }else if(args['remote_id']) {
      let json = JSON.stringify({
        'remote_id': args['remote_id'],
        'limit_date': args['limit_date']
      });
      localStorage.setItem('talk', json);
    }else if(args['close']) {
      localStorage.removeItem('talk');
    }else {
      fileRecieved(args['file_name'], args['file'])
    }
  };
  const fileRecieved = function(file_name, file){
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.download = file_name;
    a.href = file;
    a.click();
    a.remove();
    URL.revokeObjectURL(file);
  }
  const closeDataConnection = async function(dataConnection) {
    // ローカルの通話枠を削除
    localStorage.removeItem('talk');
    // 明示的に切断されたことを通知する
    dataConnection.send({
      close: true
    });
    // send処理を待つ
    const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await _sleep(500);
    dataConnection.close(true)
  };
  const closeMediaConnection = async function(mediaConnection) {
    mediaConnection.close(true)
  };

  peer.on('error', console.error);  

  // 初期処理
  // 再接続処理
  // peerがopenしたら初期処理を開始
  peer.once('open', id => {
    localId.textContent = id
    result = connect_last_connection();
    if(!result && guestId){
        call();  
    }
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
})();

function getParams(params){
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const params_obj = {};
  let match;
  while(match = regex.exec(params)){
    params_obj[match[1]] = match[2];
  }
  return params_obj;
}