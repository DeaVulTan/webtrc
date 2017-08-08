var OriginalRtc = RTC;

function WebrtcMocker() {
    this.browser = 'chrome';
    this.pc_constraints = {};
}

WebrtcMocker.devices = {
    source: [
        {id:'1234', kind:'audio', label:'Mocker Microphone Device'},
        {id:'5678', kind:'video', label:'Mocker Camera Device'}
    ]
}

RTC = new WebrtcMocker;

function delayCall(cb, min) {
    if (!min)
        min = 100;
    setTimeout(cb, Math.round(Math.random(400))+min);
}

function PeerConnMocker(iceConf, peerConstr) {
    this.remoteDescription = null;
    this.localDescription = null;
    this.signalingState = 'closed';
    this._offerSdp = gOfferSdp;
    this._answerSdp = gOfferSdp;
}

PeerConnMocker.prototype.createOffer = function(succCb, errCb, constraints) {
    var self = this;
    delayCall(function() {
        succCb(new WebrtcMocker.prototype.RTCSessionDescription({type:'offer', sdp:self._offerSdp}));
    });
}

PeerConnMocker.prototype.createAnswer = function(succCb, errCb, constraints) {
    var self = this;
    delayCall(function() {
    if ((self.signalingState != 'have-remote-offer') || !self.remoteDescription)
        errCb("No remote description has been set");
       else
        succCb(new WebrtcMocker.prototype.RTCSessionDescription({type:'answer', sdp:self._answerSdp}));
    });
}

PeerConnMocker.prototype.setLocalDescription = function(desc, succCb, errCb) {
    var self = this;
    delayCall(function() {
        if (self.localDescription) {
            errCb("Already have local description");
            return;
        }
        if (self.remoteDescription && (desc.type !== 'answer')) {
            errCb('Already have remote desc and requested to set local non-answer');
            return;
        }
        if (!self.remoteDescription && (desc.type === 'answer')) {
            errCb('Dont have remote description and requested to set local answer');
            return;
        }

        self.localDescription =  desc;
        if(desc.type === 'answer') {
            self.signalingState = 'stable';
            if (self.onaddstream)
                self.onaddstream({stream: new MediaStreamMocker({audio:true, video:true})});
        } else {
            self.signalingState = 'have-local-offer';
        }
        succCb();
    });
}

PeerConnMocker.prototype.setRemoteDescription = function(desc, succCb, errCb) {
    var self = this;
    delayCall(function() {
        if (self.remoteDescription) {
            errCb('Already have remote description');
            return;
        }
        if (self.localDescription && (desc.type !== 'answer')) {
            errCb('Already have local desc and remote desc is not answer');
            return;
        }        
        if (!self.localDescription && (desc.type === 'answer')) {
            errCb('Dont have local desc and remote desc is answer');
            return;
        }

        self.remoteDescription =  desc;
        if (desc.type === 'answer') {
            self.signalingState = 'stable';
            if (self.onaddstream)
                self.onaddstream({stream: new MediaStreamMocker({audio:true, video:true})});
        } else {
          self.signalingState = 'have-remote-offer';
        }
        succCb();
        self._generateIceCandidates();
    });
}

PeerConnMocker.prototype._generateIceCandidates = function() {
    var self = this;
    var count = gIceCandidates.length;
    var timer = setInterval(function() { //send ice candidates
        if (!self.onicecandidate) {
            clearInterval(timer);
            return;
        }
        count--;
        if (count < 0) {
            clearInterval(timer);
            return;
        }
        self.onicecandidate(gIceCandidates[count]);
    }, 150);
}

PeerConnMocker.prototype.addStream = function(stream) {}
PeerConnMocker.prototype.close = function() {}
PeerConnMocker.prototype.addIceCandidate = function(cand) {
    if (!this.remoteDescription)
        throw new Error("addIceCandidate() called before setting remote description");
}
    
function MediaStreamMocker(opts) {
    this._audioTracks = opts.audio?[{label:'Mock Microphone'}]:[];
    this._videoTracks = opts.video?[{label: 'Mock Camera'}]:[];
}
MediaStreamMocker.prototype.getAudioTracks = function() {
    return this._audioTracks;
}

MediaStreamMocker.prototype.getVideoTracks = function() {
    return this._videoTracks;
}

MediaStreamMocker.prototype.stop = function() {}

WebrtcMocker.prototype.peerconnection = PeerConnMocker;
WebrtcMocker.prototype.getUserMedia = function(opts, succCb, errCb) {
    var self = this;
    delayCall(function() {
        if (self._denyCamAccess) {
            console.log("getUserMedia: Returning error: camera access denied");
            errCb({code:1});
        } else
            succCb(new MediaStreamMocker(opts));
    });
}

WebrtcMocker.prototype.attachMediaStream = function(element, stream) {}
WebrtcMocker.prototype.cloneMediaStream = function(src, what) {return src; }
        
WebrtcMocker.prototype.RTCSessionDescription = function(desc) {
    this.type = desc.type;
    this.sdp = desc.sdp;
}

WebrtcMocker.prototype.RTCIceCandidate = function(cand) {
    this.sdpMLineIndex = cand.sdpMLineIndex;
    this.sdpMid = cand.sdpMid;
    this.candidate = cand.candidate;
}
WebrtcMocker.prototype.MediaStreamTrack = function() {}
WebrtcMocker.prototype.MediaStreamTrack.getSources = function(cb) {
//not very nice - here we choose deliberately a shorter delay compared to the connect time, because
//we rely on the device enumeration to happen before we are connected and someone asks us
//for our disco features
    setTimeout(function() {cb(WebrtcMocker.devices.source);}, 50+Math.round(Math.random(40)));
}


WebrtcMocker.prototype.createUserMediaConstraints = WebrtcApi.prototype.createUserMediaConstraints;

WebrtcMocker.prototype.getUserMediaWithConstraintsAndCallback =
 function(um, self, okCallback, errCallback) {
	try {
		this.getUserMedia(this.createUserMediaConstraints(um),
			okCallback.bind(self), errCallback.bind(self));
	} catch(e) {
        console.error('getUserMediaWithConstraintsAndCallback: error:', e);
		errCallback.call(self, null, e);
    }
}		

WebrtcMocker.prototype.getMediaInputTypesFromScan = function(cb) {
    var flags = {};
    var devices = WebrtcMocker.devices.source;
    for (var i=0; i<devices.length; i++) {
        var kind = devices[i].kind;
        if (kind === 'audio')
            flags.audio = true;
         else if (kind === 'video')
            flags.video = true;
    }
    delayCall(function() {cb(flags)});
}
