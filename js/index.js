try {
  const Peer = window.Peer;
  const API_KEY = "976b1d6d-589e-48f6-8a9c-8f67e8062a7c"
  const LIMIT_SEND_FILE_SIZE_MB = 1
  const ERROR_MESSAGE_UNEXCEPTED_ERROR = "予期せぬエラーが発生しました。"
  const ERROR_MESSAGE_USE_ID = "ユーザーIDを指定してください。"
  const ERROR_MESSAGE_USER_TOKEN = "ユーザーTokenを指定してください。"
  const ERROR_MESSAGE_SECTION = "正しい日付を指定してください。"
  const ERROR_MESSAGE_UNAVAILABLE_ID = "ビデオの起動に失敗しました。現在開いているビデオ画面を全て閉じてから再度お試しください。"
  const ERROR_MESSAGE_CHANGE_DEBICE = "デバイスの変更に失敗しました。画面を更新して再接続してください。"

  //パラメータを取得
  dictParams = getParams(location.href)
  const userId = dictParams['u']  // ユーザーID
  if(userId == undefined){
    throw new Error(ERROR_MESSAGE_USE_ID);
  }
  const token = dictParams['t']   // トークン
  if(token == undefined){
    throw new Error(ERROR_MESSAGE_USER_TOKEN);
  }

  var guestId = dictParams['g']   // ゲストID
  var section = dictParams['s']   // セクションID (e.g. 202009081210)  
  if(section != undefined){
    if(convertSectionToLimitDate(section).toString()==="Invalid Date"){
      throw new Error(ERROR_MESSAGE_SECTION);
    }
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
    var localMediaConnection = null
    var mediaConnectionId = null 
    var dataConnectionId = null
    

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
    // サーバーに認証情報を要求
    $.post('https://testvideosample.com/authenticate/',
    {
      peerId: peerID,
      sessionToken: token
    }, function(credential) {
      // ボタンを通話中の活性状態にする
      const changeActiveStateWhileTalking = function() {
        closeTrigger.removeAttribute("disabled");
        sendTrigger.removeAttribute("disabled");
        fileSendTrigger.removeAttribute("disabled");
      };
      // ボタンを非通話中の活性状態にする
      const changeActiveStateWhileNotTalking = function() {
        closeTrigger.setAttribute("disabled", true);
        sendTrigger.setAttribute("disabled", true);
        fileSendTrigger.setAttribute("disabled", true);
      };

      // 再接続処理
      // 再接続を行った場合は、true
      // 再接続を行わなかった場合は、false
      const connectLastConnection = function(){
        return new Promise((resolve, reject) => {
          // ローカルストレージから一時データ取得
          // 形式: section
          //      remoteId
          const talkJson = localStorage.getItem('talk');
          // 一時データがなければ終了
          if(!talkJson) return resolve(false);
          // 一時データをパース
          const talkObj = JSON.parse(talkJson);
          // 制限時刻を過ぎているかチェック
          var limitTime = convertSectionToLimitTime(talkObj.section);
          var nowTime = new Date().getTime();
          if(Math.floor((limitTime - nowTime) / 1000) > 0){
            // 接続時間内の場合は再接続するかどうか確認する
            var divMessage = document.getElementById('modal_reconnect_title');
            divMessage.innerText = "再接続しますか？ ID: " + talkObj.remoteId
            var divButton = document.getElementById('modal_recconect_button_div');
            divButton.innerHTML = ""
            // はい
            const modalButtonYes = document.createElement("button");
            modalButtonYes.classList.add('btn','btn-danger');
            modalButtonYes.id = "modal_recconect_yes"
            modalButtonYes.innerText = "はい"
            divButton.appendChild(modalButtonYes)
            modalButtonYes.addEventListener('click', function() {
              // sectionを再接続前のものに変更
              section = talkObj.section
              guestId = talkObj.remoteId;
              lasttime.textContent = '再接続待ち...';
              call(talkObj.remoteId);
              // モーダルダイアログを隠す
              $('body').removeClass('modal-open'); 
              $('.modal-backdrop').remove();
              $('#modal_reconnect').modal('hide');
              return resolve(true);
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
              return resolve(false);
            });
            $('#modal_reconnect').modal();      
          } else {
            // 接続時間切れの場合クリア
            localStorage.removeItem('talk');
            return resolve(false);
          }
        });
      }

      // 制限時間を更新して、時間切れであれば終了する
      let timer;
      const updateLimitTime = function(){
        const nowDate = new Date();
        console.log(nowDate);
        const nowTimestamp = nowDate.getTime();
        var limitTime = convertSectionToLimitTime(section)
        console.log(limitTime);
        console.log(nowTimestamp);
        console.log(limitTime - nowTimestamp);
        console.log((limitTime - nowTimestamp) / (1000));
        const diffTime = Math.floor((limitTime - nowTimestamp) / (1000));
        console.log(diffTime);
        console.log('残り時間: ' + diffTime + '秒');
        if(diffTime > 0){
          lasttime.textContent = '残り時間: ' + diffTime + '秒';
          setTimeout(function(){
            timer = updateLimitTime();
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
            fileName: localFile.name,
            file: reader.result,
            size: localFile.size 
          };
          dataConnection.send(data);
          // 自分にも表示
          fileRecieved("You", localFile.name, reader.result,  localFile.size)
        };
        reader.readAsDataURL(localFile)
        fileSendTrigger.value = ""
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
                videoMuteTrigger.innerHTML = '<i class="fas fa-video"></i>';
              }else {
                track.enabled = true
                videoMuteTrigger.innerHTML = '<i class="fas fa-video-slash"></i>';
              }      
            }
          })
        } catch (error) {
          window.alert(ERROR_MESSAGE_UNEXCEPTED_ERROR);
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
                audioMuteTrigger.innerHTML = '<i class="fas fa-volume-up"></i>';
              }else {
                track.enabled = true
                audioMuteTrigger.innerHTML = '<i class="fas fa-volume-mute"></i>';
                }      
            }
          })
        } catch (error) {
          window.alert(ERROR_MESSAGE_UNEXCEPTED_ERROR)
        }
      });
      // Peer接続
      var peer = new Peer(peerID, {
        key: API_KEY,
        credential: credential,
        debug: 3,
      });
      function call (remoteId){
        // Note that you need to ensure the peer has connected to signaling server
        // before using methods of peer instance.
        if (!peer.open) {
          return;
        }
        const mediaConnection = peer.call(remoteId, localStream);
        localMediaConnection = mediaConnection
        mediaConnection.on('stream', async stream => {
          // Render remote stream for caller
          remoteVideo.srcObject = stream;
          remoteVideo.playsInline = true;
          await remoteVideo.play().catch(console.error);
          mediaConnectionId = mediaConnection.id;
          timer = setTimeout(function(){
            updateLimitTime();
          }, 1000);
          
          let json = JSON.stringify({
            'remoteId': remoteId,
            'section': section
          });
          localStorage.setItem('talk', json);

          // mediaを接続して初めてデータを接続する
          const dataConnection = peer.connect(remoteId);
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
            dataConnectionId = dataConnection.id;
            sendTrigger.addEventListener('click', sendObj)
            fileSendTrigger.addEventListener('change', fileSendObj)
            closeTrigger.addEventListener('click', closeObj)
            // 通話枠情報を送信する
            dataConnection.send({
              remoteId: userId,
              section: section
            });
            // 通話開始時にボタンの活性状態を変更する
            changeActiveStateWhileTalking()
          });
      
          dataConnection.on('data', recieve);
          dataConnection.once('close', () => {
            if(dataConnectionId == dataConnection.id){
              outputMessage(`=== DataConnection has been closed ===\n`);
              sendTrigger.removeEventListener('click', sendObj);
              fileSendTrigger.removeEventListener('change', fileSendObj);
              closeTrigger.removeEventListener('click', closeObj);
              changeActiveStateWhileNotTalking()
            }
          });
        });

        mediaConnection.once('close', () => {
          if(mediaConnectionId == mediaConnection.id){
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            remoteVideo.srcObject = null;
            clearTimeout(timer);
          }
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
        localMediaConnection = mediaConnection
        mediaConnectionId = mediaConnection.id;
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
          if(mediaConnectionId == mediaConnection.id){
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
        dataConnectionId = dataConnection.id;
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
          if(dataConnectionId == dataConnection.id){
            outputMessage(`=== DataConnection has been closed ===`);
            sendTrigger.removeEventListener('click', sendObj)
            fileSendTrigger.removeEventListener('change', fileSendObj)
            closeTrigger.removeEventListener('click', closeDataObj)
            changeActiveStateWhileNotTalking()
            //location.reload()
          }
        });
      });
      const recieve = function(args) {
        if (args['msg']) {
          //messages.textContent += `${args['name']}: ${args['msg']}\n`;
          outputMessage(`${args['name']}: ${args['msg']}`) 
        }else if(args['remoteId']) {

          // かけ直す際に使用 
          guestId = args['remoteId']
          section = args['section']
          let json = JSON.stringify({
            'remoteId': args['remoteId'],
            'section': section
          });
          localStorage.setItem('talk', json);
          // 通話を受け取った際に制限時間を設定
          timer = setTimeout(function(){
            updateLimitTime();
          }, 1000);
        }else if(args['close']) {
          localStorage.removeItem('talk');
        }else {
          fileRecieved(args['name'], args['fileName'], args['file'], args['size'])
        }
      };
      const fileRecieved = function(name, fileName, file, size){
        const p = document.createElement("p");
        const a = document.createElement("a");
        p.appendChild(a);
        messages.appendChild(p);
        a.download = fileName;
        a.href = file;
        a.textContent = name + ": " + fileName + " (" + getDispFileSize(size) + ")" 
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
            window.alert(ERROR_MESSAGE_CHANGE_DEBICE);
            return;
          });
      }

      const changeDevices = async function(){
        const audioSource = audioInputSelect.value;
        const videoSource = videoSelect.value;
        const constraints = {
          audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
          video: {deviceId: videoSource ? {exact: videoSource} : undefined}
        };
        localStream.getTracks().forEach(track => track.stop());
        localStream = await navigator.mediaDevices
                                      .getUserMedia(constraints)
                                      .catch(function(){
                                        console.error;
                                        window.alert(ERROR_MESSAGE_CHANGE_DEBICE);
                                        return;
                                      });
        localVideo.muted = true;
        localVideo.srcObject = localStream;
        localVideo.playsInline = true;
        await localVideo.play().catch(console.error);
        if(localMediaConnection != null && localMediaConnection.remoteStream != undefined && localMediaConnection.remoteStream.active){
          localMediaConnection.replaceStream(localStream);
        }
      }

      // 初期処理
      // 再接続処理
      // peerがopenしたら初期処理を開始
      changeActiveStateWhileNotTalking()
      getDevices()
      audioOutputSelect.onchange = changeAudioDestination;
      audioInputSelect.onchange = changeDevices;
      videoSelect.onchange = changeDevices;
      peer.once('open', id => {
        localId.textContent = id
        connectLastConnection().then(result=>{
          if(!result && guestId){
            call(guestId);  
          }
        }).catch(error => {
          //
        });
      });
      peer.on("error", (error) => {
        if(error.type == "unavailable-id"){
          window.alert(ERROR_MESSAGE_UNAVAILABLE_ID);
          return;
        }
      });
    }).fail(function() {
      window.alert(ERROR_MESSAGE_UNAVAILABLE_ID);
    });
  })();

} catch(e) {
  window.alert(e.message);
}

function getParams(params){
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const paramsObj = {};
  let match;
  while(match = regex.exec(params)){
    paramsObj[match[1]] = match[2];
  }
  return paramsObj;
}

function getDispFileSize(byte){
  mbSize = (byte / 1024 / 1024).toFixed(1) 
  if(mbSize == "0.0") {
    kbSize = (byte / 1024).toFixed(1) 
    if(kbSize == "0.0") {
      return byte + " Byte"
    }else{
      return kbSize + " KB"
    }
  }else{
    return mbSize + " MB"
  }
}

function convertSectionToLimitDate(section){
  return new Date(parseInt(section.substring(0, 4)), parseInt(section.substring(4, 6)) - 1, parseInt(section.substring(6, 8)), parseInt(section.substring(8, 10)), parseInt(section.substring(10, 12)))
}

function convertSectionToLimitTime(section){
  var limitDate = convertSectionToLimitDate(section);
  return limitDate.getTime();
}