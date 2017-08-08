/* jshint -W117 */
var BOSH_SERVICE = 'http://j100.server.lu:5280/http-bind',
    DOMAIN = window.location.hostname,
    CONFERENCEDOMAIN = 'conference.' + DOMAIN,
    ice_config = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]},
    RTC = null,
    RTCPeerConnection = null,
    AUTOACCEPT = true,
    PRANSWER = false, // use either pranswer or autoaccept
    RAWLOGGING = false,
	SEND_VIDEO = true,
    MULTIPARTY = true,
	NO_DTLS = true,
    localStream = null,
    connection = null,
    myroomjid = null,
    roomjid = null,
    list_members = [];
	gui = null;
var floor = Math.floor;

function setupGui(aGui)
{
	gui = aGui;
	var container = $('#'+gui.rmtVidContainerId);
	gui.remoteVidContainerHeight = container.innerHeight();
	gui.remoteVidContainerWidth = container.innerWidth();
}
	
function setStatus(txt) {
    console.log('status', txt);
    $('#status').text(txt);
}

function onConnect(status) {
    if (status == Strophe.Status.CONNECTING)
        setStatus('Connecting.');
     else if (status == Strophe.Status.CONNFAIL)
	 {
        setStatus('Connecting failed.');
		connection.reset();
	 }
     else if (status == Strophe.Status.DISCONNECTING)
	 {
        setStatus('Disconnecting.');
		var vids = $('#'+gui.rmtVidContainerId+' .remotevideo');
		vids.remove();
        if (localStream)
		{
            localStream.stop();
            localStream = null;
        }
	 }		
     else if (status == Strophe.Status.DISCONNECTED)
	 {
        setStatus('Disconnected.');
		connection.reset();
		gui.onDisconnected();
	 }
     else if (status == Strophe.Status.CONNECTED)
	 {
        setStatus('Connected.');
        connection.jingle.getStunAndTurnCredentials();

        // disco stuff
        if (connection.disco) 
		{
            connection.disco.addIdentity('client', 'web');
            connection.disco.addFeature(Strophe.NS.DISCO_INFO);
        }
        $(document).trigger('connected');
     }
}

function onHashChange() {
    setStatus('hashChange: ' + window.location.hash);
    if (Object.keys(connection.jingle.sessions).length === 0) {
        window.location.reload();
    }
}

function onJoinComplete() {
    setStatus('onJoinComplete');
    if (list_members.length < 1) {
        setStatus('waiting for peer');
        return;
    }
	var peernames = '';
	list_members.forEach(function(member)
	{
		peernames+=Strophe.getResourceFromJid(member);
		peernames+=', ';
	});
	if (peernames.length > 2)
		peernames = peernames.substr(0, peernames.length-2);
    setStatus('Initiating call to all peers in room:\n'+peernames);
    var i, sess, num;
    num = MULTIPARTY ? list_members.length : 1;
    for (i = 0; i < num; i++) 
	{
        connection.jingle.initiate(list_members[i], myroomjid);
		console.log('initiated call to', list_members[i]);
    }
}

function onPresence(pres) 
{
    var from = pres.getAttribute('from'),
        type = pres.getAttribute('type');
    if (type !== null) {
        return true;
    }
    if ($(pres).find('>x[xmlns="http://jabber.org/protocol/muc#user"]>status[code="201"]').length) {
        // http://xmpp.org/extensions/xep-0045.html#createroom-instant
        var create = $iq({type: 'set', to: roomjid})
                .c('query', {xmlns: 'http://jabber.org/protocol/muc#owner'})
                .c('x', {xmlns: 'jabber:x:data', type: 'submit'});
        connection.send(create); // fire away
    }
    if (from == myroomjid) {
        onJoinComplete();
    } else { // TODO: prevent duplicates
        list_members.push(from);
    }
    return true;
}

function onPresenceUnavailable(pres) {
    connection.jingle.terminateByJid($(pres).attr('from'));
    if (Object.keys(connection.jingle.sessions).length === 0) {
        setStatus('everyone left');
    }
    for (var i = 0; i < list_members.length; i++) {
        if (list_members[i] == $(pres).attr('from')) {
            list_members.splice(i, 1);
            break;
        }
    }
    return true;
}

function onPresenceError(pres) {
    setStatus('onPresError ' + pres);
    return true;
}

function doJoin() {
    var roomnode = null,
        pres;
    if (location.hash.length > 1) {
        roomnode = location.hash.substr(1).toLowerCase();
        if (roomnode.indexOf('/') != -1) {
            setStatus('invalid location, must not contain "/"');
            connection.disconnect();
            return;
        }
        if (roomnode.indexOf('@') != -1) { // allow #room@host
            roomjid = roomnode;
        }
    } else {
        roomnode = Math.random().toString(36).substr(2, 8);
        location.hash = roomnode;
    }
    if (roomjid === null) {
        roomjid = roomnode + '@' + CONFERENCEDOMAIN;
    }
    setStatus('Joining ' + location.hash);
    myroomjid = roomjid + '/' + Strophe.getNodeFromJid(connection.jid);
    list_members = [];
    console.log('joining', roomjid);

    // muc stuff
    connection.addHandler(onPresence, null, 'presence', null, null, roomjid, {matchBare: true});
    connection.addHandler(onPresenceUnavailable, null, 'presence', 'unavailable', null, roomjid, {matchBare: true});
    connection.addHandler(onPresenceError, null, 'presence', 'error', null, roomjid, {matchBare: true});
    connection.addHandler(onMessage, null, 'message', null, null, roomjid, {matchBare: true});
	
    pres = $pres({to: myroomjid })
            .c('x', {xmlns: 'http://jabber.org/protocol/muc'});
    connection.send(pres);
}

function onMediaReady(event, stream) {
    localStream = stream;
    connection.jingle.localStream = stream;
    for (var i = 0; i < localStream.getAudioTracks().length; i++) {
        setStatus('using audio device "' + localStream.getAudioTracks()[i].label + '"');
    }
    for (i = 0; i < localStream.getVideoTracks().length; i++) {
        setStatus('using video device "' + localStream.getVideoTracks()[i].label + '"');
    }
    // mute video on firefox and recent canary
    $('#minivideo')[0].muted = true;
    $('#minivideo')[0].volume = 0;

    RTC.attachMediaStream($('#minivideo'), localStream);

    doConnect();

    if (typeof hark === "function") {
        var options = { interval: 400 };
        var speechEvents = hark(stream, options);

//        speechEvents.on('speaking', function () {
//            console.log('speaking');
//        });

//        speechEvents.on('stopped_speaking', function () {
//            console.log('stopped_speaking');
//        });
        speechEvents.on('volume_change', function (volume, treshold) {
          //console.log('volume', volume, treshold);
            if (volume < -60) { // vary between -60 and -35
                $('#ownvolume').css('width', 0);
            } else if (volume > -35) {
                $('#ownvolume').css('width', '100%');
            } else {
                $('#ownvolume').css('width', (volume + 100) * 100 / 25 - 160 + '%');
            }
        });
    } else {
        console.warn('without hark, you are missing quite a nice feature');
    }
}

function onMediaFailure() {
    setStatus('media failure');
}

function onCallIncoming(event, sid) {
    setStatus('incoming call', sid);
    var sess = connection.jingle.sessions[sid];
    sess.sendAnswer();
    sess.accept();

    // alternatively...
    //sess.terminate(busy)
    //connection.jingle.terminate(sid);
}

function addVideo(ui, peerjid)
{
	var elements = $('#'+gui.rmtVidContainerId+' .remotevideo');
	var howMany = elements.length;
	if (howMany > 4)
	{
		alert("Sorry, no more than 4 people in conference are currently supported");
		return;
	}
	var parentTdSel = '#vidc'+(elements.length+1);
	$(ui).appendTo(parentTdSel);
	resizeVideos();
	$(parentTdSel+' .nick').text(Strophe.getResourceFromJid(peerjid));
}

function resizeVideos()
{
	var	elements = $('#'+gui.rmtVidContainerId+' .vid');
    var howMany = elements.length;
	var vidCont = $('#'+gui.rmtVidContainerId);
	var height = (howMany>2)?floor(gui.remoteVidContainerHeight/2):gui.remoteVidContainerHeight;
	var width = (howMany>1)?floor(gui.remoteVidContainerWidth/2-16):gui.remoteVidContainerWidth-10;
	height -= 20; //accout for the nickname below
	elements.each(function(vid)
	{
		vid = $(elements[vid]);
		var ar = vid[0].clientHeight?(vid[0].clientHeight / vid[0].clientWidth):0.5625; // 9:16
		var thisWidth = width;
		var thisHeight = floor(ar*width);
		if (thisHeight > height)
		{
			thisHeight = height;
			thisWidth = thisHeight/ar;
		}
		vid.height(thisHeight);
		vid.width(thisWidth);
	});
    // hardcoded layout for up to four videos
}

function removeVideo(sid)
{
	var viditem = $('#remotevideo_'+sid);
	if (!viditem)
	{
		console.log("removeVideo: Video element with sid", sid, "does not exist");
		return false;
	}
	viditem.remove();
	resizeVideos(0);
}

function onCallActive(event, ui, sid) 
{
    setStatus('call active ' + sid);
	var sess = connection.jingle.sessions[sid];
    addVideo(ui, sess.peerjid);
    sess.getStats(1000);
}

function onCallTerminated(event, sid, reason)
{
    setStatus('call terminated ' + sid + (reason ? (': ' + reason) : ''));
    if (Object.keys(connection.jingle.sessions).length === 0) {
        setStatus('all calls terminated');
    }
    removeVideo(sid);
}

function waitForRemoteVideo(videoElem, ui, sid) 
{
    var sess = connection.jingle.sessions[sid];
	if (!sess)
		return;
    videoTracks = sess.remoteStream.getVideoTracks();
    if (videoElem[0].currentTime > 0) {
        $(document).trigger('callactive.jingle', [ui, sid]);
        RTC.attachMediaStream(videoElem, sess.remoteStream); // FIXME: why do i have to do this for FF?
       // console.log('waitForremotevideo', sess.peerconnection.iceConnectionState, sess.peerconnection.signalingState);
    } else {
        setTimeout(function () { waitForRemoteVideo(videoElem, ui, sid); }, 100);
    }
}
//onRemoteStreamAdded -> waitForRemoteVideo (waits till time>0) -> onCallActive() -> addVideo()
function onRemoteStreamAdded(event, data, sid) {
    setStatus('Remote stream for session ' + sid + ' added.');
    if ($('#remotevideo_' + sid).length !== 0)
	{
        console.log('ignoring duplicate onRemoteStreamAdded...'); // FF 20
        return;
    }

	var ui = null;
	var videoTracks = data.stream.getVideoTracks();
	if (!videoTracks || (videoTracks.length < 1))
	{
		debugLog("Peer does not send video");
	    ui = $("<table class='remotevideo' id='remotevideo_" + sid+
		"'><tr><td class='vid video_novideo'><span>No video</span></td></tr><tr><td class='nicktd'><span class='nick' /></td></tr><tr><td></td></tr></table>");
		$(document).trigger('callactive.jingle', [ui, sid]);
	}
	else
	{
    // after remote stream has been added, wait for ice to become connected
    // old code for compat with FF22 beta
		ui = $("<table class='remotevideo' id='remotevideo_" + sid+
		"'><tr><td style='padding: 0px'><video autoplay='autoplay' class='vid' /></td></tr><tr><td class='nicktd'><span class='nick' /></td></tr><tr><td></td></tr></table>");
		RTC.attachMediaStream(ui.find('.vid'), data.stream);
		waitForRemoteVideo(ui.find('.vid'), ui, sid); //also attaches media stream once time > 0
    /* does not yet work for remote streams -- https://code.google.com/p/webrtc/issues/detail?id=861
    var options = { interval:500 };
    var speechEvents = hark(data.stream, options);

    speechEvents.on('volume_change', function (volume, treshold) {
      console.log('volume for ' + sid, volume, treshold);
    });
    */
	}
}

function onRemoteStreamRemoved(event, data, sid) {
    setStatus('Remote stream for session ' + sid + ' removed.');
}

function onIceConnectionStateChanged(event, sid, sess) {
//    console.log('ice state for', sid, sess.peerconnection.iceConnectionState);
//    console.log('sig state for', sid, sess.peerconnection.signalingState);

    // works like charm, unfortunately only in chrome and FF nightly, not FF22 beta
    /*
    if (sess.peerconnection.signalingState == 'stable' && sess.peerconnection.iceConnectionState == 'connected') {
        var el = $("<video autoplay='autoplay' style='display:none'/>").attr('id', 'largevideo_' + sid);
        $(document).trigger('callactive.jingle', [el, sid]);
        RTC.attachMediaStream(el, sess.remoteStream); // moving this before the trigger doesn't work in FF?!
    }
    */
}

function noStunCandidates(event) {
    setStatus('webrtc did not encounter stun candidates, NAT traversal will not work');
    console.warn('webrtc did not encounter stun candidates, NAT traversal will not work');
}

function onConnected(event) {
    doJoin();
    setTimeout(function () {
        $(window).bind('hashchange', onHashChange);
    }, 500);
}

$(window).bind('beforeunload', function () {
    if (connection && connection.connected) {
        // ensure signout
        $.ajax({
            type: 'POST',
            url: BOSH_SERVICE,
            async: false,
            cache: false,
            contentType: 'application/xml',
            data: "<body rid='" + connection.rid + "' xmlns='http://jabber.org/protocol/httpbind' sid='" + connection.sid + "' type='terminate'><presence xmlns='jabber:client' type='unavailable'/></body>",
            success: function (data) {
                console.log('signed out');
                console.log(data);
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log('signout error', textStatus + ' (' + errorThrown + ')');
            }
        });
    }
});

$(document).ready(function()
{
    RTC = setupRTC();
	if (NO_DTLS)
	{
		RTC.pc_constraints.optional.forEach(function(opt)
		{
			if (opt.DtlsSrtpKeyAgreement)
				delete opt.DtlsSrtpKeyAgreement;
		});
		RTC.pc_constraints = null;
	}
    connection = new Strophe.Connection(BOSH_SERVICE);

    connection.rawInput = function (data) { if (RAWLOGGING) console.log('RECV: ' + data); };
    connection.rawOutput = function (data) { if (RAWLOGGING) console.log('SEND: ' + data); };
    
    connection.jingle.ice_config = ice_config;
    if (RTC) {
        connection.jingle.pc_constraints = RTC.pc_constraints;
    }

    $(document).bind('connected', onConnected);
    $(document).bind('mediaready.jingle', onMediaReady);
    $(document).bind('mediafailure.jingle', onMediaFailure);
    $(document).bind('callincoming.jingle', onCallIncoming);
    $(document).bind('callactive.jingle', onCallActive);
    $(document).bind('callterminated.jingle', onCallTerminated);

    $(document).bind('remotestreamadded.jingle', onRemoteStreamAdded);
    $(document).bind('remotestreamremoved.jingle', onRemoteStreamRemoved);
    $(document).bind('iceconnectionstatechange.jingle', onIceConnectionStateChanged);
    $(document).bind('nostuncandidates.jingle', noStunCandidates);
//    $(document).bind('ack.jingle', function (event, sid, ack) {
//        console.log('got stanza ack for ' + sid, ack);
//    });
    $(document).bind('error.jingle', function (event, sid, err, stanza, orig) {
		if (err.source == 'transportinfo')
			err.source = 'transport-info (i.e. webrtc ice candidate)';
		if (!orig) orig = "(unknown)";
	
		if (err.isTimeout)
			console.error('Timeout getting response to "'+err.source+'" packet, session:'+sid+', orig-packet:\n', orig);
		else {
			if (!stanza)
				stanza = "(unknown)";	
			console.error('Error response to "'+err.source+'" packet, session:', sid,
				'\nerr-packet:\n', stanza, '\norig-packet:\n', orig.get());
		}
    });
//  $(document).bind('packetloss.jingle', function (event, sid, loss) {
//        console.warn('packetloss', sid, loss);
//    });
    if (RTC !== null) {
        RTCPeerconnection = RTC.peerconnection;
        if (RTC.browser == 'firefox') {
            connection.jingle.media_constraints.mandatory.MozDontOfferDataChannel = true;
        }
        //setStatus('please allow access to microphone and camera');
        //getUserMediaWithConstraints();
    } else {
        setStatus('webrtc capable browser required');
    }
});

function onMessage(msg)
{
	var from = Strophe.getResourceFromJid($(msg).attr('from'));
	var group = ($(msg).attr('type') == 'groupchat');
	var body = msg.getElementsByTagName('body');
	var txt = body[0].textContent;
	txt = from+(group?'(group)':'')+':\n'+txt.replace(/^[\n\r]+/mg, '')+'\n';
	var chat = document.getElementById('chat');
	chat.value = chat.value+txt;
	chat.scrollTop = chat.scrollHeight;
	return true;
}
