const Peer = window.Peer;
const LIMIT_SEND_FILE_SIZE_MB = 1
const ERROR_MESSAGE_UNEXCEPTED_ERROR = "予期せぬエラーが発生しました。"

//パラメータを取得
dictParams = getParams(location.href)
const userId = dictParams['u']  // ユーザーID
var guestId = dictParams['g']   // ゲストID
var section = dictParams['s']   // セクションID (e.g. 202009081210)  
if(section != undefined){
  var limit_date = new Date(parseInt(section.substring(0, 4)), parseInt(section.substring(4, 6)) - 1, parseInt(section.substring(6, 8)), parseInt(section.substring(8, 10)), parseInt(section.substring(10, 12)));
  var limit_time = limit_date.getTime();
}

(async function main() {

  // ビデオチャット機能
  var localStream = null
  const localVideo = document.getElementById('js-local-stream');
  const localId = document.getElementById('js-local-id');
  const closeTrigger = document.getElementById('js-close-trigger');
  const videoMuteTrigger = document.getElementById('js-video-mute-trigger');
  const audioMuteTrigger = document.getElementById('js-audio-mute-trigger');
  const remoteVideo = document.getElementById('js-remote-stream');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');
  // 選択関連
  const audioInputSelect = document.querySelector('select#audioSource');
  const audioOutputSelect = document.querySelector('select#audioOutput');
  const videoSelect = document.querySelector('select#videoSource');
  const selectors = [audioInputSelect, audioOutputSelect, videoSelect];
  // メッセージ機能
  const fileSendTrigger = document.getElementById('js-file-send-trigger');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const lasttime = document.getElementById('lasttime');

  // ID
  const peerID = userId;
  // 接続中のconnectionのID
  var connectionId = null
  
  // ボタンを通話中の活性状態にする
  const changeActiveStateWhileTalking = function() {
    closeTrigger.removeAttribute("disabled");
    closeTrigger.style.color = "white";
    sendTrigger.removeAttribute("disabled");
    sendTrigger.style.color = "white";
    fileSendTrigger.removeAttribute("disabled");
    fileSendTrigger.style.color = "white";
  };
  // ボタンを非通話中の活性状態にする
  const changeActiveStateWhileNotTalking = function() {
    closeTrigger.setAttribute("disabled", true);
    closeTrigger.style.color = "gray";
    sendTrigger.setAttribute("disabled", true);
    sendTrigger.style.color = "gray";
    fileSendTrigger.setAttribute("disabled", true);
    fileSendTrigger.style.color = "gray";
  };

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
      // 接続時間内の場合は再接続するかどうか確認する
      var divMessage = document.getElementById('modal_reconnect_title');
      divMessage.innerText = "再接続しますか？ ID: " + talk_obj.remote_id
      var divButton = document.getElementById('modal_recconect_button_div');
      divButton.innerHTML = ""
      // はい
      const modalButtonYes = document.createElement("button");
      modalButtonYes.classList.add('btn','btn-danger');
      modalButtonYes.id = "modal_recconect_yes"
      modalButtonYes.innerText = "はい"
      divButton.appendChild(modalButtonYes)
      modalButtonYes.addEventListener('click', function() {
        // limitを再接続前のものに変更
        limit_date = new Date(talk_obj.limit_date);
        limit_time = limit_date.getTime();
        lasttime.textContent = '再接続待ち...';
        call(talk_obj.remote_id);
        guestId = talk_obj.remote_id;
        // モーダルダイアログを隠す
        $('body').removeClass('modal-open'); 
        $('.modal-backdrop').remove();
        $('#modal_reconnect').modal('hide');
        return true;
      });
      // いいえ
      const modalButtonNo = document.createElement("button");
      modalButtonNo.classList.add('btn','btn-default');
      modalButtonNo.id = "modal_recconect_no"
      modalButtonNo.innerText = "いいえ"
      divButton.appendChild(modalButtonNo)
      modalButtonNo.addEventListener('click', function() {
        // モーダルダイアログを隠す
        $('body').removeClass('modal-open'); 
        $('.modal-backdrop').remove();
        $('#modal_reconnect').modal('hide');
        return false;
      });
      $('#modal_reconnect').modal();      
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
      lasttime.textContent = '残り時間: 0秒';
    }
  }

  // メッセージ送信処理
  const onClickSend = function(dataConnection) {
    if(localText.value == "") {
      return;
    }
    const data = {
      name: peerID,
      msg: localText.value
    };
    dataConnection.send(data);

    //messages.textContent += `You: ${data.msg}\n`;
    outputMessage(`You: ${data.msg}`);
    localText.value = '';
  };
  // ファイル送信処理
  const onClickFileSend = function(dataConnection, localFile) {
    var reader = new FileReader()
    reader.onload = () => {
      if (localFile.size > (LIMIT_SEND_FILE_SIZE_MB * 1024 * 1024)) {
        window.alert(LIMIT_SEND_FILE_SIZE_MB + "MB以上のファイルは送信できません。");
        return;
      }
      const data = {
        name: peerID,
        file_name: localFile.name,
        file: reader.result,
        size: localFile.size 
      };
      dataConnection.send(data);
      // 自分にも表示
      fileRecieved("You", localFile.name, reader.result,  localFile.size)
    };
    reader.readAsDataURL(localFile)
  };

  // ビデオ Mute機能
  isVideoMute = false
  videoMuteTrigger.addEventListener('click', () => {
    try {
      isVideoMute = !isVideoMute
      var tracks = localStream.getTracks();
      tracks.forEach(track => {
        if(track.kind == "video") {
          if(isVideoMute){
            track.enabled = false
            videoMuteTrigger.innerText = "video mute 解除";
          }else {
            track.enabled = true
            videoMuteTrigger.innerText = "video mute";
          }      
        }
      })
    } catch (error) {
      window.confirm(ERROR_MESSAGE)
    }
  });
  isAudioMute = false
  audioMuteTrigger.addEventListener('click', () => {
    try {
      isAudioMute = !isAudioMute
      var tracks = localStream.getTracks();
      tracks.forEach(track => {
        if(track.kind == "audio") {
          if(isAudioMute){
            track.enabled = false
            audioMuteTrigger.innerText = "audio mute 解除";
          }else {
            track.enabled = true
            audioMuteTrigger.innerText = "audio mute";
          }      
        }
      })
    } catch (error) {
      window.confirm(ERROR_MESSAGE_UNEXCEPTED_ERROR)
    }
  });

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

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

  const peer = (window.peer = new Peer(peerID, {
    key: '976b1d6d-589e-48f6-8a9c-8f67e8062a7c',
    debug: 3,
  }));

  function call (remote_id){
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }
    const mediaConnection = peer.call(remote_id, localStream);
    audioInputSelect.onchange = function(){ 
      changeDevices(mediaConnection);      
    }
    videoSelect.onchange = function(){ 
      changeDevices(mediaConnection);      
    }
    mediaConnection.on('stream', async stream => {
      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
      connectionId = mediaConnection._options.connectionId;
      timer = setTimeout(function(){
        update_limit_time();
      }, 1000);
      
      let json = JSON.stringify({
        'remote_id': remote_id,
        'limit_date': limit_date
      });
      localStorage.setItem('talk', json);

      // mediaを接続して初めてデータを接続する
      const dataConnection = peer.connect(remote_id);
      var sendObj = {handleEvent: function() {
        onClickSend(dataConnection)
      }}
      var fileSendObj = {handleEvent: function(e) { 
        onClickFileSend(dataConnection, e.target.files[0])
       }}
      var closeObj = {handleEvent: function() {
        closeDataConnection(dataConnection);
        closeMediaConnection(mediaConnection);
      }}    
      dataConnection.once('open', async () => {
        //messages.textContent += `=== DataConnection has been opened ===\n`;
        outputMessage(`=== DataConnection has been opened ===`);

        sendTrigger.addEventListener('click', sendObj)
        fileSendTrigger.addEventListener('change', fileSendObj)
        closeTrigger.addEventListener('click', closeObj)
        // 通話枠情報を送信する
        dataConnection.send({
          remote_id: userId,
          section: section
        });
        // 通話開始時にボタンの活性状態を変更する
        changeActiveStateWhileTalking()
      });
  
      dataConnection.on('data', recieve);
      dataConnection.once('close', () => {
        //messages.textContent += `=== DataConnection has been closed ===\n`;
        outputMessage(`=== DataConnection has been closed ===\n`);

        sendTrigger.removeEventListener('click', sendObj);
        fileSendTrigger.removeEventListener('change', fileSendObj);
        closeTrigger.removeEventListener('click', closeObj);
        changeActiveStateWhileNotTalking()
      });
    });

    mediaConnection.once('close', () => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      clearTimeout(timer);
    });
  }

  // 受信処理
  // ビデオ受信処理
  // Register callee handler
  peer.on('call', mediaConnection => {
    // 受信を後勝ちにするため、受信毎にボタンを削除→生成
    var divButton = document.getElementById('modal_button_div');
    divButton.innerHTML = ""
    // はい
    const modalButtonYes = document.createElement("button");
    modalButtonYes.classList.add('btn','btn-danger');
    modalButtonYes.id = "modal_yes"
    modalButtonYes.innerText = "はい"
    divButton.appendChild(modalButtonYes);
    modalButtonYes.addEventListener('click', function() {
      onClickCallRecieved(mediaConnection);
    });
    // いいえ
    const modalButtonNo = document.createElement("button");
    modalButtonNo.classList.add('btn','btn-default');
    modalButtonNo.id = "modal_no"
    modalButtonNo.innerText = "いいえ"
    divButton.appendChild(modalButtonNo);
    modalButtonNo.addEventListener('click', function() {
      onClickCallRefused(mediaConnection);
    });

    $('#modal_response').modal();
  });

  const onClickCallRecieved = function(mediaConnection) {
    mediaConnection.answer(localStream);
    connectionId = mediaConnection._options.connectionId;
    audioInputSelect.onchange = function(){ 
      changeDevices(mediaConnection);      
    }
    videoSelect.onchange = function(){ 
      changeDevices(mediaConnection);      
    }
    mediaConnection.on('stream', async stream => {
      // Render remote stream for callee
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
    });

    var closeMediaObj = {handleEvent: function() {
      closeMediaConnection(mediaConnection);
    }}
    closeTrigger.addEventListener('click', closeMediaObj);

    mediaConnection.once('close', () => {
      if(connectionId == mediaConnection._options.connectionId){
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        clearTimeout(timer);
        closeTrigger.removeEventListener('click', closeMediaObj);
      }
    });
    $('body').removeClass('modal-open'); 
    $('.modal-backdrop').remove();
    $('#modal_response').modal('hide');
  };
  const onClickCallRefused = function(mediaConnection) {
    mediaConnection.close(true)
    $('body').removeClass('modal-open'); 
    $('.modal-backdrop').remove();
    $('#modal_response').modal('hide');
  };

  // データ接続受信処理
  // Register connected peer handler
  peer.on('connection', dataConnection => {
    var sendObj = {handleEvent: function() {
      onClickSend(dataConnection)
    }}
    var fileSendObj = {handleEvent: function(e) {
      onClickFileSend(dataConnection, e.target.files[0])
     }}
    var closeDataObj = {handleEvent: function() {
      closeDataConnection(dataConnection);
    }}     
    dataConnection.once('open', async () => {
      //messages.textContent += `=== DataConnection has been opened ===\n`;
      outputMessage(`=== DataConnection has been opened ===`);
      sendTrigger.addEventListener('click', sendObj)
      fileSendTrigger.addEventListener('change', fileSendObj)
      closeTrigger.addEventListener('click', closeDataObj)
      changeActiveStateWhileTalking()
    });
    dataConnection.on('data', recieve);
    dataConnection.once('close', () => {
      //messages.textContent += `=== DataConnection has been closed ===\n`;
      outputMessage(`=== DataConnection has been closed ===`);
      sendTrigger.removeEventListener('click', sendObj)
      fileSendTrigger.removeEventListener('change', fileSendObj)
      closeTrigger.removeEventListener('click', closeDataObj)
      changeActiveStateWhileNotTalking()
      //location.reload()
    });
  });
  const recieve = function(args) {
    if (args['msg']) {
      //messages.textContent += `${args['name']}: ${args['msg']}\n`;
      outputMessage(`${args['name']}: ${args['msg']}`) 
    }else if(args['remote_id']) {

      // かけ直す際に使用 
      guestId = args['remote_id']
      section = args['section']
      limit_date = new Date(parseInt(section.substring(0, 4)), parseInt(section.substring(4, 6)) - 1, parseInt(section.substring(6, 8)), parseInt(section.substring(8, 10)), parseInt(section.substring(10, 12)));
      limit_time = limit_date.getTime();
      let json = JSON.stringify({
        'remote_id': args['remote_id'],
        'limit_date': limit_date
      });
      localStorage.setItem('talk', json);
      // 通話を受け取った際に制限時間を設定
      timer = setTimeout(function(){
        update_limit_time();
      }, 1000);
    }else if(args['close']) {
      localStorage.removeItem('talk');
    }else {
      fileRecieved(args['name'], args['file_name'], args['file'], args['size'])
    }
  };
  const fileRecieved = function(name, file_name, file, size){
    const p = document.createElement("p");
    const a = document.createElement("a");
    p.appendChild(a);
    messages.appendChild(p);
    a.download = file_name;
    a.href = file;
    a.textContent = name + ": " + file_name + " (" + getDispFileSize(size) + ")" 
  }
  const outputMessage = function(message){
    const p = document.createElement("p");
    messages.appendChild(p);
    p.textContent = message
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
  const changeAudioDestination = function(){ 
    remoteVideo.setSinkId(audioOutputSelect.value)
      .then(function() {
        console.log('setSinkID Success');
      })
      .catch(function(err) {
        console.error('setSinkId Err:', err);
      });
  }

  const changeDevices = async function(mediaConnection){
    const audioSource = audioInputSelect.value;
    const videoSource = videoSelect.value;
    const constraints = {
      audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
      video: {deviceId: videoSource ? {exact: videoSource} : undefined}
    };
    localStream = await navigator.mediaDevices
                                  .getUserMedia(constraints)
                                  .catch(console.error);
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.playsInline = true;
    await localVideo.play().catch(console.error);
    if(mediaConnection.remoteStream != undefined && mediaConnection.remoteStream.active){
      mediaConnection.replaceStream(localStream);
    }
  }

  // 初期処理
  // 再接続処理
  // peerがopenしたら初期処理を開始
  changeActiveStateWhileNotTalking()
  getDevices()
  audioOutputSelect.onchange = changeAudioDestination;
  peer.once('open', id => {
    localId.textContent = id
    result = connect_last_connection();
    if(!result && guestId){
        call(guestId);  
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

function getDispFileSize(byte){
  mb_size = (byte / 1024 / 1024).toFixed(1) 
  if(mb_size == "0.0") {
    kb_size = (byte / 1024).toFixed(1) 
    if(kb_size == "0.0") {
      return byte + " Byte"
    }else{
      return kb_size + " KB"
    }
  }else{
    return mb_size + " MB"
  }
}