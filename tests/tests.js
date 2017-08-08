var expect = chai.expect;

function DoneTracker(test, doneFunc, tags, timeout) {
    this._doneFunc = doneFunc;
    this._checks = {};
    this._count = tags.length;
    var checks = this._checks;
    for (var i=0; i<tags.length; i++) {
        var tag = tags[i];
        if (checks[tag])
            throw new Error("Duplicate tag: "+tag);
        checks[tag] = {passed:false};
    }
    if (!timeout)
        timeout = 5000;
    test.timeout(timeout+100000); //disable the normal test timeout, we will handle it
    setTimeout(function() {
        if (this._completed)
            return;
        var notPassList = '';
        var notPassed = false;
        for (var k in checks) {
            var check = checks[k];
            if (!check.passed) {
                notPassed = true;
                notPassList+=('"'+k+'", ');
            }
        }
        if (!notPassed)
            doneFunc();
        if (notPassList.length > 2)
            notPassList = notPassList.substr(0, notPassList.length-2);
        doneFunc(new Error('The following events timed out: '+notPassList));
    }, timeout);
}

DoneTracker.prototype.done = function(tag, error) {
    if (typeof tag === 'object') {
        if (error)
            throw new Error('Incorrect call to done() with object as "tag" parameter and error parameter present');
        error = tag;
        tag = null;
    }
    if (error) {
        this._completed = true;
        this._doneFunc(error);
        return;
    }
    var check = this._checks[tag];
    if (!check)
        throw new Error('done: Unknown check tag: '+tag);
    if (check.passed)
        throw new Error('done: Check "'+tag+'" already passed');
    check.passed = true;
    if (--(this._count) == 0) {
        this._completed = true;
        this._doneFunc();
    }
}

DoneTracker.install = function(test, doneFunc, tags, timeout) {
    var inst = new DoneTracker(test, doneFunc, tags, timeout);
    return inst.done.bind(inst);
}

function expectEvent(target, name, done, props, doneTag, cb, options) {
    if (!options)
        options = {cnt: 1};        
    var handler = function(event, obj) {
        if (--options.cnt > 0)
            return;
            
        if (props) {
          for (var k in props)
            if (obj[k] !== props[k])
                done(new Error("event "+name+'": argument "'+k+'" not as expected (expected: "'+
                   props[k]+'", found: "'+obj[k]+'")'));
        }
        if (cb)
            cb(obj);
        done((doneTag===false)?undefined:name);
        if (options.clrHandler)
            $(target).off(name, handler);
    }
    $(target).on(name, handler);
}

var peer = 'test@example.com';
var peerWithRes = peer+'/peerRes';
var myjid = 'me@example.com/myres';
var fprmackey = null;

var conn = null;
var rtc = null;
var jsid = null;
var gRemotePlayer = null;

function createJingleInitiate(action, initiator, responder, fprmackey, sid) {
    var fingerprint = '';
    var len = 32;
    var lenminus1 = len-1;
    var arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (var i = 0; i<arr.length; i++) {
        fingerprint+=arr[i].toString(16);
        if (i<lenminus1)
            fingerprint+=':';
    }

    var j = $iq({type:'set', from:peerWithRes, to: myjid})
    .c('jingle', {
        action:action, xmlns:'urn:xmpp:jingle:1',
        sid:sid, initiator: initiator, responder:responder,
        fprmac:rtc.jingle.generateMac('sha-256 '+fingerprint, fprmackey)
    })
    .c('content', {'creator': 'initiator', 'name':'audio'})
    .c('transport', {'xmlns': 'urn:xmpp:jingle:transports:ice-udp:1', 'ufrag':'HXCL9eDR9S2+tUa7', 'pwd': 'j3j85GVHzl5qNYKlMGnvuPgT'})
    .c('fingerprint', {'hash':'sha-256', 'required':'true'}, fingerprint).up();

    return j;
}

describe('Jingle module tests', function() {
    describe('Sanity checks', function() {
        it('JQuery should fire and handle and event', function(done) {
            var obj = {};
            var done = DoneTracker.install(this, done, ['event1', 'cb for event1']);
            expectEvent(obj, 'event1', done, {param1: 1}, true, function() {
                done('cb for event1');
            });
            $(obj).trigger('event1', [{param1:1}]);
        });

        it('should register Jingle plugin', function() {
            expect(Strophe.plugins).to.have.property('jingle').that.is.an('object');
        });
    });

    describe("Init tests", function() {
        var devsSave = WebrtcMocker.devices.source;
        var devs = WebrtcMocker.devices.source = [];
        for (var i=0; i<devsSave.length; i++) {
            var d = devsSave[i];
            if (d.kind === 'audio')
                devs.push(d);
        }

        var conn = new Strophe.Connection;
        it('should create a Jingle plugin instance', function() {
            expect(conn).to.have.property('jingle').that.is.an('object');
        });

        var rtc = new RtcSession(conn, {dummyCryptoFunctions: true, iceServers:[{url: 'stun:stun.l.google.com:19302'}]});

        sinon.spy(conn, 'addHandler');

        it('should call conn state handler', function(done) {
            conn.connect(myjid, 'pass', function(state) {
                if (state === Strophe.Status.CONNECTED)
                    done();
            });
        });

        it('Jingle code should have installed stanza handlers', function() {
            expect(conn.addHandler.calledWithExactly(sinon.match.any, 'urn:xmpp:jingle:1', 'iq', 'set', null, null)).to.be.true;
            expect(conn.addHandler.calledWithExactly(sinon.match.any, null, 'message', 'megaCall', null, null)).to.be.true;
        });

        it('rtcSession.js should have installed stanza handlers', function() {
            expect(conn.addHandler.calledWithExactly(sinon.match.any, null, 'presence', 'unavailable', null, null)).to.be.true;
        });

        it('should have disco features registered', function() {
            var f = conn.disco.features;
            expect(f).to.have.property('urn:xmpp:jingle:1');
            expect(f).to.have.property('urn:xmpp:jingle:apps:rtp:1');
            expect(f).to.have.property('urn:xmpp:jingle:transports:ice-udp:1');
            expect(f).to.have.property('urn:ietf:rfc:5761');
            expect(f).to.have.property('urn:xmpp:jingle:apps:rtp:audio');
            expect(f).not.to.have.property('urn:xmpp:jingle:apps:rtp:video');
            WebrtcMocker.devices.source = devsSave;
        });
    });

    var initConnection = function(self, done) {
        if (rtc)
            rtc.destroy();
        gRemotePlayer = [{currentTime:0}];
        conn = new Strophe.Connection;
        rtc = new RtcSession(conn, {dummyCryptoFunctions: true, iceServers:[{url: 'stun:stun.l.google.com:19302'}]});
        conn.connect(myjid, 'pass', function(state) {
            if (state === Strophe.Status.CONNECTED)
                done.apply(self);
        });
    };
    function installMuteCheck(state, strWhat, done, audio, video) {
        if (conn.sendIQ.restore)
            conn.sendIQ.restore();
        var match = '>'+(state?'mute':'unmute')+'[xmlns="urn:xmpp:jingle:apps:rtp:info:1"]';
        sinon.stub(conn, 'sendIQ', function(s, succCb) {
          var j = null;
          if (j = jingleMatch(s, 'session-info')) {
            var mute = $(j).find(match);
            expect(mute.length).to.be.above(0);
            expect(mute.attr('name')).to.equal(strWhat);
            var sess = rtc.jingle.sessions[jsid];
            if (!sess)
                throw new Error("Could not find jingle session "+jsid);
            var atracks = sess.localStream.getAudioTracks();
            var vtracks = sess.localStream.getVideoTracks();
            for (var i=0; i<atracks.length; i++)
                if (atracks[i].enabled != audio)
                    throw new Error("Audio track not in expected muted state");
            for (var i=0; i<vtracks.length; i++)
                if (vtracks[i].enabled != video)
                    throw new Error("Video track not in expected muted state");
            done();
          }
          delayCall(succCb);
        });
    }

    function testMuteRecv(state, channel, done) {
        var evname = state?'muted':'unmuted';
        $(rtc).on(evname, function(event, obj) {
            $(rtc).off(evname);
            if (channel==1) {//audio
                if (!obj.info.audio || obj.info.video)
                    throw new Error("Audio mute event info not as expected");
            } else {
                if (!obj.info.video || obj.info.audio)
                    throw new Error("Video mute event info not as expected");
            }
            done();
        });
        var mute = $iq({type:'set', from:peerWithRes, to:myjid});
        mute.c('jingle', {xmlns:'urn:xmpp:jingle:1', action:'session-info', sid:jsid, initiator:peerWithRes})
            .c((state?'mute':'unmute'), {xmlns:'urn:xmpp:jingle:apps:rtp:info:1', creator:'creator', name:((channel==1)?'voice':'video')});

        conn.callJingleHandler({}, mute);
    }

    describe('Call tests', function() {
      it('should install response handlers and send call request', function(done) {
        initConnection(this, function() {
            done = DoneTracker.install(this, done, ['handlers installed', 'call request sent']);
            sinon.spy(conn, 'addHandler');
            sinon.stub(conn, 'send', function(stanza) {
                if (!conn.addHandler.calledWithExactly(sinon.match.any, null, 'message', 'megaCallAnswer', null, peer, {matchBare:true}))
                    done(new Error('no megaCallAnswer handler installed'));
                if (!conn.addHandler.calledWithExactly(sinon.match.any, null, 'message', 'megaCallDecline', null, peer, {matchBare:true}))
                    done(new Error('no megaCallDecline handler installed'));

                done('handlers installed');

                if (!stanzaMatch(stanza, 'message', {type: 'megaCall', to: peer}))
                    done(new Error('Call request Stanza sent is not as expected'));
                done('call request sent');
                conn.send.restore();
            });

            rtc.startMediaCall(peer, {audio:true, video:true});
        });
      });

      it('call declined by peer - should fire call-declined with reason and text and local-player-removed events, and broadcast notifyCallHandled', function(done) {
        done = DoneTracker.install(this, done, ['call-declined', 'local-player-remove', 'notifyCallHandled']);

        expectEvent(rtc, 'call-declined', done,{
            peer: peerWithRes, reason: 'test reason', text: 'test text'
        });
        expectEvent(rtc, 'local-player-remove', done);


        if (conn.send.restore)
            conn.send.restore();
        sinon.stub(conn, 'send', function(s) {
            if (stanzaMatch(s, 'message', {type:'megaNotifyCallHandled', by: peerWithRes, accepted:'0'}))
                done('notifyCallHandled');
        });

        var s = $msg({from: peerWithRes, type:'megaCallDecline', xmlns:'jabber:client', reason:'test reason'});
        s.c('body').t('test text');
        conn.callMsgHandler({from: peer, type:'megaCallDecline'}, s);
      });
      it('should have removed answer handlers', function(done) {
            if ((conn.hasHandlerFor('message', {type:'megaCallAnswer'})
            || (conn.hasHandlerFor('message', {type:'megaCallDecline'}))))
                done(new Error('At lest one answer handler present'));
            done();
      });

      it('should fire call-answer-timeout and send call cancel when call not answered, open and close local stream', function(done) {
        initConnection(this, function() {
            done = DoneTracker.install(this, done, ['call-answer-timeout', 'megaCallCancel', 'local-stream-obtained', 'local-player-remove']);
            expectEvent(rtc, 'call-answer-timeout', done, {peer: peer});
            expectEvent(rtc, 'local-stream-obtained', done);
            expectEvent(rtc, 'local-player-remove', done);

            sinon.stub(conn, 'send', function(s) {
                if (stanzaMatch(s, 'message', {type: 'megaCallCancel', to: peer}))
                    done('megaCallCancel');
            });
            rtc.jingle.callAnswerTimeout = 1000;
            rtc.startMediaCall(peer, {audio:true, video:true});
        });
      });


      it('should decline call if local media could not be obtained', function(done) {
        initConnection(this, function() {
            done = DoneTracker.install(this, done, ['local-media-fail', 'call-incoming-request']);
            expectEvent(rtc, 'local-media-fail', done, {}, true, function(obj) {
                delete RTC._denyCamAccess;
            });
            expectEvent(rtc, 'call-incoming-request', done, {}, true, function(obj) {
                obj.answer(true, {mediaOptions:{audio:true, video:true}});
            });

            RTC._denyCamAccess = true;
            conn.callMsgHandler({type:'megaCall', from: peerWithRes});
        });
      });
      it('should cancel call', function(done) {
        initConnection(this, function() {
            done = DoneTracker.install(this, done, ['cancel sent', 'local-stream-obtained', 'local-player-remove', 'cancel returned true']);
            sinon.stub(conn, 'send', function(s) {
                if (stanzaMatch(s, 'message', {type:'megaCallCancel', to:peer}))
                    done('cancel sent');
            });
            expectEvent(rtc, 'local-stream-obtained', done);
            expectEvent(rtc, 'local-player-remove', done);
            rtc.jingle.callAnswerTimeout = 2000;
            var ret = rtc.startMediaCall(peer, {audio:true, video:true});
            delayCall(function() {
                if (ret.cancel())
                    done('cancel returned true');
                   else
                    done(new Error('cancel() returned false'));
                }, 550);
       });
      });

      it('should initiate jingle session, notify that call has been handled, emit call-init, set stream muted state and send muted state',
       function(done) {
        initConnection(this, function() {
            done = DoneTracker.install(this, done,
            ['jingle initiated', 'call-init', 'call handled notify', 'mute sent']);

            expectEvent(rtc, 'call-init', done, {peer: peerWithRes});
            sinon.stub(conn, 'send', function(stanza) {
                if (stanzaMatch(stanza, 'message', {type:'megaCall'})) {
                    fprmackey = RtcSession.xorDec($(stanza.tree()).attr('fprmackey'), peer);
                    conn.callMsgHandler({type: 'megaCallAnswer', from: peerWithRes, to: myjid, fprmackey:rtc.jingle.encryptMessageForJid(rtc.jingle.generateMacKey(), peer)});
                } else if (stanzaMatch(stanza, 'message', {type: 'megaNotifyCallHandled', accepted:'1', by:peerWithRes}))  {
                    done('call handled notify');
                }
            });

            sinon.stub(conn, 'sendIQ', function(stanza, callback, errback, timeout) {
                var j = null;
                if (j = jingleMatch(stanza, 'session-initiate')) {
                    if (j.attr('initiator') != myjid)
                        throw new Error('Jingle session-initiate packet not as expected');
                    jsid = j.attr('sid');
                    if (!jsid)
                        throw new Error('No "sid" in Jingle session-initiate packet');

                    if (conn.hasHandlerFor('message', {xmlns:'jabber:client', from: peer, type:'megaCallAnswer'})
                    || conn.hasHandlerFor('message', {xmlns:'jabber:client', from: peer, type:'megaCallDecline'}))
                        throw new Error('Call setup handlers not removed after call request answered');

                    done('jingle initiated');
                    installMuteCheck(true, 'voice' , function() {done('mute sent')}, false, true);
                }
                delayCall(callback);
            });
            rtc.startMediaCall(peer, {audio:false, video:true});
          });
        });

        it('call answered: should set remote desc, queue remote ICE candidates until setRemoteDescription completes, send ice candidates, emit remote-sdp-recv', function(done) {
            done = DoneTracker.install(this, done, ['set remote desc', 'send ice', 'remote-sdp-recv']);
            var iceDone = false;
            var srd = sinon.stub(conn.jingle.sessions[jsid].peerconnection, 'setRemoteDescription', function(desc, succCb, errCb) {
                if (desc.type !== 'answer')
                    throw new Error('setremoteDescription() called with non-answer SDP');
                done('set remote desc');
                srd.restore();
                //call original function
                conn.jingle.sessions[jsid].peerconnection.setRemoteDescription(desc, succCb, errCb);
            });

            expectEvent(rtc, 'remote-sdp-recv', done);
            var waitForRemoteMedia = rtc.waitForRemoteMedia;
            sinon.stub(rtc, 'waitForRemoteMedia', function(elem, sess) {
                waitForRemoteMedia.call(rtc, gRemotePlayer ,sess);
            });

            var jaccept = createJingleInitiate('session-accept', myjid, peerWithRes, fprmackey, jsid);
            conn.callJingleHandler({}, jaccept.tree());
//send ICE candidates
            for (var i=0; i<10; i++) {
              var rice = $iq({type:'set', from:peerWithRes, to: myjid});
              rice.c('jingle', {action:'transport-info', xmlns:'urn:xmpp:jingle:1',
                sid:jsid, initiator: myjid, responder:peerWithRes});
              rice.c('candidate', {'foundation':'220420747', 'component':'1', 'protocol':'udp', 'priority':'33562367', 'ip':'34.34.34.34', 'port':'53168', 'type':'relay', 'rel-addr':'12.12.12.12', 'rel-port':'54248', 'generation':'0', 'network':'1', 'id':'lsg4ze5xa6'})
              conn.callJingleHandler({}, rice.tree());
            }
//===
            if (conn.sendIQ.restore)
                conn.sendIQ.restore();
            sinon.stub(conn, 'sendIQ', function(stanza, succCb, errCb, timeout) {
                var j = jingleMatch(stanza, 'transport-info');
                if (j && !iceDone) {
                    iceDone = true;
                    done('send ice');
                }
                delayCall(succCb());
            });
        });

        it('should unmute stream and send jingle unmute event when voice unmuted', function(done) {
            installMuteCheck(false, 'voice', done, true, true);
            rtc.muteUnmute(false, {audio:true}, peerWithRes);
        });
        it('should mute stream, send jingle mute event, and disable local video&sent event when video muted', function(done) {
            done = DoneTracker.install(this, done, ['mute sent', 'local-video-disabled', 'player disabled']);
            installMuteCheck(true, 'video', function() {done('mute sent')}, true, false);
            expectEvent(rtc, 'local-video-disabled', done, null, null, null, {clrHandler: true});
            sinon.stub(RTC, 'attachMediaStream', function(vid, stream) {
                RTC.attachMediaStream.restore();
                expect(stream).to.equal(null);
                done('player disabled');
            });

            rtc.muteUnmute(true, {video:true}, peerWithRes);
        });
        it('should unmute stream, send jingle unmute event and re-enable local video&send event when video unmuted', function(done) {
            done = DoneTracker.install(this, done, ['unmute sent', 'local-video-enabled', 'player enabled']);
            installMuteCheck(false, 'video', function() {done('unmute sent')}, true, true);
            expectEvent(rtc, 'local-video-enabled', done);
            sinon.stub(RTC, 'attachMediaStream', function(vid, stream) {
                RTC.attachMediaStream.restore();
                expect(stream).to.not.equal(null);
                done('player enabled');
            });

            rtc.muteUnmute(false, {video:true}, peerWithRes);
        });
        it('should fire mute event when audio mute received', function(done) {
            testMuteRecv(true, 1, done);
        });

        it('caller side: should emit media-recv when media starts playing', function(done) {
            expectEvent(rtc, 'media-recv', done, {}, false);
            delayCall(function() {gRemotePlayer[0].currentTime = 1;});
        });

        it('should emit call-ended, free local stream and send session-terminate when session-terminate received', function(done) {
            done = DoneTracker.install(this, done, ['call-ended', 'local-player-remove', 'terminate sent']);
            expectEvent(rtc, 'call-ended', done, {}, true, function(obj) {
                if (obj.sess.sid() != jsid)
                    throw new Error("call-ended event: sid is not as expected");
            });

            expectEvent(rtc, 'local-player-remove', done);

            if (conn.sendIQ.restore)
                conn.sendIQ.restore();
            sinon.stub(conn, 'sendIQ', function(stanza, okCb, errCb) {
                var j = jingleMatch(stanza, 'session-terminate');
                if (j) {
                    expect(j.attr('sid')).to.eql(jsid);
                    expect(j.attr('initiator')).to.eql(myjid);
                    done('terminate sent');
                }
                delayCall(okCb);
            });
                    //send jingle answer
            var jhangup = $iq({type:'set', from:peerWithRes});
            jhangup.c('jingle', {xmlns:'urn:xmpp:jingle:1', action:'session-terminate', sid:jsid, initiator:peerWithRes});
            conn.callJingleHandler({}, jhangup.tree());
        });
        it('should fire call-incoming-request and decline with specified reason and text', function(done) {
          initConnection(this, function() {
          done = DoneTracker.install(this, done, ['call-incoming-request', 'decline sent']);
            sinon.stub(conn, 'send', function(s) {
                if(stanzaMatch(s, 'message', {type: 'megaCallDecline', reason:'test reason', to: peerWithRes})) {
                    var body = $(s.tree()).children('body');
                    if ((body.length < 1) || (body.text() != 'test text'))
                        done(new Error('Call decline text not as expected'));
                    done('decline sent');
                }
            });
            expectEvent(rtc, 'call-incoming-request', done, {peer:peerWithRes}, true, function(obj) {
                obj.answer(false, {reason:'test reason', text: 'test text'});
            });
          conn.callMsgHandler({type:'megaCall', from: peerWithRes});
          });
        });
        it('should answer call', function(done) {
          initConnection(this, function() {
            done = DoneTracker.install(this, done, ['call-incoming-request', 'answer sent']);
            sinon.stub(conn, 'send', function(s) {
                if(stanzaMatch(s, 'message', {type: 'megaCallAnswer', to: peerWithRes})) {
                    fprmackey = $(s.tree()).attr('fprmackey');
                    if (!fprmackey)
                        done(new Error("No mac-key present in callAnswer message"));
                    fprmackey = RtcSession.xorDec(fprmackey, peer);
                    done('answer sent');
                }
            });

            expectEvent(rtc, 'call-incoming-request', done, {peer: peerWithRes}, true, function(obj) {
                obj.answer(true, {mediaOptions: {audio:false, video:true}});
            });
//            fprmackey = rtc.jingle.generateMacKey();
            rtc.ownFprMacKey = rtc.jingle.generateMacKey();
            conn.callMsgHandler({type:'megaCall', from: peerWithRes, to: myjid, fprmackey: rtc.jingle.encryptMessageForJid(rtc.ownFprMacKey, Strophe.getBareJidFromJid(myjid))});
          });
        });
        it ('should fire call-answered event, answer jingle session, have correct local mute, fire local-stream-obtained, fire remote-sdp-recv', function(done) {
            jsid = 'testsession1234';
            done = DoneTracker.install(this, done, ['session accept', 'call-answered', 'remote-sdp-recv']);
            if (conn.sendIQ.restore)
                conn.sendIQ.restore();
            sinon.stub(conn, 'sendIQ', function(s, okCb) {
            try { //stack of exceptions in sinon stubs get lost
                var j = null;
                if (j=jingleMatch(s, 'session-accept')) {
                    if (j.attr('sid') != jsid)
                        done(new Error('session accept sid not as expected'));
                    var fprmac = j.attr('fprmac');
                    if (!fprmac)
                        done(new Error('No fprmac attribute in jingle answer'));
                    var calcHmac = rtc.jingle.generateMac(rtc.jingle.getFingerprintsFromJingle($(j)), rtc.ownFprMacKey);
                    if (fprmac != calcHmac)
                        done(new Error('Fingerprint verification failed:\nreceived:\n'+fprmac+'\ncalculated:\n'+calcHmac));
                    done('session accept');
                }
                if (okCb) okCb();
            } catch(e) {console.log(e.stack); throw e;}
            });

            expectEvent(rtc, 'call-answered', done, {}, true, function(obj) {
                var media = rtc.getSentMediaTypes(peerWithRes);
                if (media.audio || !media.video)
                    done(new Error('Media types sent not as expected'));
            });
            expectEvent(rtc, 'local-stream-obtained', done);
            expectEvent(rtc, 'remote-sdp-recv', done);

            var waitForRemoteMedia = rtc.waitForRemoteMedia;
            sinon.stub(rtc, 'waitForRemoteMedia', function(elem, sess) {
                waitForRemoteMedia.call(rtc, gRemotePlayer ,sess);
            });

            var jcall = createJingleInitiate('session-initiate', peerWithRes, myjid, fprmackey, jsid);
            conn.callJingleHandler({}, jcall.tree());
        });
        it('callee side: should emit media-recv when media starts playing', function(done) {
            expectEvent(rtc, 'media-recv', done, {}, false);
            delayCall(function() {gRemotePlayer[0].currentTime = 1;});
        });

        it('should send session-terminate, fire call-ended, remote-player-remove, local-player-remove when hangup() called', function(done) {
            done = DoneTracker.install(this, done, ['session-terminate', 'remote-player-remove', 'local-player-remove', 'call-ended']);
            if (conn.sendIQ.restore)
                conn.sendIQ.restore();
            sinon.stub(conn, 'sendIQ', function(s, okCb) {
                var j;
                if (j = jingleMatch(s, 'session-terminate', {to: peerWithRes})) {
                    if (j.attr('sid')!=jsid)
                        done(new Error('sent session-terminate, but not with expected attribs'));
                      else
                        done('session-terminate');
                }
                okCb();
            });
            expectEvent(rtc, 'remote-player-remove', done);
            expectEvent(rtc, 'local-player-remove', done);
            expectEvent(rtc, 'call-ended', done);
            rtc.hangup(peerWithRes);
        });
    });
        
    describe('Security', function() {
        var testCallerSide = function(done, rtcInit, getPeerFprMacKey) {
            done = DoneTracker.install(this, done, ['call-ended']);
            initConnection(this, function() {
                if (rtcInit)
                    rtcInit(rtc);
                expectEvent(rtc, 'call-ended', done,
                {reason: 'security', text: 'Fingerprint verification failed'},
                true);
            });
            sinon.stub(conn, 'send', function(s) {
              try {
                if (stanzaMatch(s, "message", {type: "megaCall", to: peer})) {
                    rtc.ownFprMacKey = RtcSession.xorDec($(s.tree()).attr('fprmackey'), peer);
                    if (!rtc.ownFprMacKey)
                        throw new Error("No mac-key sent in call request");
                    rtc.peerFprMacKey = rtc.jingle.generateMacKey();
                    conn.callMsgHandler({from: peer, type:"megaCallAnswer"},
                    $msg({type:"megaCallAnswer", from: peerWithRes,
                     fprmackey: rtc.jingle.encryptMessageForJid(
                        rtc.peerFprMacKey, Strophe.getBareJidFromJid(myjid))}));
                }
              }catch(e) {console.log(e.stack); throw e;}
            });

            sinon.stub(conn, 'sendIQ', function(s, okCb) {
             try {
              var j = null;
              if (j = jingleMatch(s, 'session-initiate', {to: peerWithRes})) {
                okCb();
                var jaccept = createJingleInitiate('session-accept', peerWithRes, myjid,
                  getPeerFprMacKey(rtc), $(j).attr('sid'));
                conn.callJingleHandler({}, jaccept.tree());
              }
             }catch(e) {console.log(e.stack)}
            });
             rtc.startMediaCall(peer, {audio:true, video:false});
        }

        var testAnsSide = function(done, rtcInit, getPeerFprMacKey) {
          done = DoneTracker.install(this, done, ['call-ended', 'call-incoming-request']);
          initConnection(this, function() {
            if (rtcInit)
                rtcInit(rtc);
            expectEvent(rtc, 'call-ended', done,
             {reason: 'security', text: 'Fingerprint verification failed'},
            true);

            var myjidBare = Strophe.getBareJidFromJid(myjid);
            sinon.stub(conn, 'send', function(s) {
              try {
                if (stanzaMatch(s, "message", {type: "megaCallAnswer", to: peerWithRes})) {
                    rtc.ownFprMacKey = RtcSession.xorDec($(s.tree()).attr('fprmackey'), peer);
                    if (!rtc.ownFprMacKey)
                        throw new Error("No fprmackey sent in call answer");

                var jcall = createJingleInitiate('session-initiate', peerWithRes, myjid,
                    getPeerFprMacKey, "testsession1234");
                conn.callJingleHandler({}, jcall);
              }
             } catch(e) {console.error(e.stack); throw e;}
            });
            expectEvent(rtc, 'call-incoming-request', done, {}, true, function(obj) {
                obj.answer(true, {mediaOptions: {audio:false, video:true}});
            });
            rtc.peerFprMacKey = rtc.jingle.generateMacKey();
            conn.callMsgHandler({from: peer, type: "megaCall"},
                $msg({type:"megaCall", from: peerWithRes, to: myjidBare,
                fprmackey: rtc.jingle.encryptMessageForJid(rtc.peerFprMacKey, myjidBare)}));
          });
        }
        
        it ('Caller side: on fingerprint verification error should immediately terminate call with reason=security', 
            function(done) {
                testCallerSide.call(this, done, null,
                    function(rtc) {
                        return rtc.peerFprMacKey.substr(0, rtc.peerFprMacKey.length-1);
                    }
                )
            }
        );
        
        it ('Answer side: on fingerprint verification error should immediately terminate call with reason=security', 
            function(done) {
                testCallerSide.call(this, done, null,
                    function(rtc) {
                        return rtc.peerFprMacKey;
                    }
                )
            }
        );

        it ('Caller side: on fprmac decrypt fail should immediately terminate call with reason=security', 
            function(done) {
                testCallerSide.call(this, done,
                    function(rtc) {
                        rtc.jingle.decryptMessage = function(msg){throw new Error("Fail on purpose");}
                    },
                    function(rtc) {
                        return rtc.peerFprMacKey;
                    }

                )
            }
        );
        
        it ('Answer side: on fprmac decrypt fail should immediately terminate call with reason=security', 
            function(done) {
                testCallerSide.call(this, done,
                    function(rtc) {
                        rtc.jingle.decryptMessage = function(msg){throw new Error("Fail on purpose");}
                    },
                    function(rtc) {
                        return rtc.peerFprMacKey;
                    }
                )
            }
        );
 });
})

        