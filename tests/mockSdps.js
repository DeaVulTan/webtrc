var gOfferSdp = 
"v=0\r\n\
o=- 4113064651171940820 2 IN IP4 127.0.0.1\r\n\
s=-\r\n\
t=0 0\r\n\
a=group:BUNDLE audio video\r\n\
a=msid-semantic: WMS 279564d0-ff16-4134-9bc3-30c0b6e81fc7\r\n\
m=audio 1 RTP/SAVPF 111 103 104 0 8 106 105 13 126\r\n\
c=IN IP4 0.0.0.0\r\n\
a=rtcp:1 IN IP4 0.0.0.0\r\n\
a=ice-ufrag:WVcrT8vE7hhPWdBN\r\n\
a=ice-pwd:vPqUBTrjUg29wsCKYpO59H1T\r\n\
a=ice-options:google-ice\r\n\
a=fingerprint:sha-256 8C:12:84:1A:A5:5B:FD:44:49:51:FE:A0:5E:5C:88:39:B4:21:B6:1A:74:FB:A2:A8:EE:B5:D7:C0:23:26:37:BE\r\n\
a=setup:actpass\r\n\
a=mid:audio\r\n\
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n\
a=sendrecv\r\n\
a=rtcp-mux\r\n\
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:29LC8Jj7sqRbGIYysrY/ccqa7O8sekdnEmRLdD6Q\r\n\
a=rtpmap:111 opus/48000/2\r\n\
a=fmtp:111 minptime=10\r\n\
a=rtpmap:103 ISAC/16000\r\n\
a=rtpmap:104 ISAC/32000\r\n\
a=rtpmap:0 PCMU/8000\r\n\
a=rtpmap:8 PCMA/8000\r\n\
a=rtpmap:106 CN/32000\r\n\
a=rtpmap:105 CN/16000\r\n\
a=rtpmap:13 CN/8000\r\n\
a=rtpmap:126 telephone-event/8000\r\n\
a=maxptime:60\r\n\
a=ssrc:3739824544 cname:IGyhdylRJzU1CRlT\r\n\
a=ssrc:3739824544 msid:279564d0-ff16-4134-9bc3-30c0b6e81fc7 8406b098-5dd2-494f-8595-ae3603347174\r\n\
a=ssrc:3739824544 mslabel:279564d0-ff16-4134-9bc3-30c0b6e81fc7\r\n\
a=ssrc:3739824544 label:8406b098-5dd2-494f-8595-ae3603347174\r\n\
m=video 1 RTP/SAVPF 100 116 117\r\n\
c=IN IP4 0.0.0.0\r\n\
a=rtcp:1 IN IP4 0.0.0.0\r\n\
a=ice-ufrag:WVcrT8vE7hhPWdBN\r\n\
a=ice-pwd:vPqUBTrjUg29wsCKYpO59H1T\r\n\
a=ice-options:google-ice\r\n\
a=fingerprint:sha-256 8C:12:84:1A:A5:5B:FD:44:49:51:FE:A0:5E:5C:88:39:B4:21:B6:1A:74:FB:A2:A8:EE:B5:D7:C0:23:26:37:BE\r\n\
a=setup:actpass\r\n\
a=mid:video\r\n\
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r\n\
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n\
a=sendrecv\r\n\
a=rtcp-mux\r\n\
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:29LC8Jj7sqRbGIYysrY/ccqa7O8sekdnEmRLdD6Q\r\n\
a=rtpmap:100 VP8/90000\r\n\
a=rtcp-fb:100 ccm fir\r\n\
a=rtcp-fb:100 nack\r\n\
a=rtcp-fb:100 goog-remb\r\n\
a=rtpmap:116 red/90000\r\n\
a=rtpmap:117 ulpfec/90000\r\n\
a=ssrc:3172689884 cname:IGyhdylRJzU1CRlT\r\n\
a=ssrc:3172689884 msid:279564d0-ff16-4134-9bc3-30c0b6e81fc7 03833ee1-a01a-4438-a78c-545a980f29e3\r\n\
a=ssrc:3172689884 mslabel:279564d0-ff16-4134-9bc3-30c0b6e81fc7\r\n\
a=ssrc:3172689884 label:03833ee1-a01a-4438-a78c-545a980f29e3\r\n"


var gIceCandidates = 
[
 {
   candidate:
   {
    candidate: "a=candidate:3022624816 1 udp 2113937151 192.168.1.4 2079 typ host generation 0",
    sdpMLineIndex: 0,
    sdpMid: 'audio'
   }
 },
 {
   candidate:
   {
    candidate: "a=candidate:3022624816 2 udp 2113937151 192.168.1.4 2079 typ host generation 0",
    sdpMLineIndex: 0,
    sdpMid: 'audio'
   }
 },
 {
   candidate:
   {
    candidate:"a=candidate:3022624816 1 udp 2113937151 192.168.1.4 2079 typ host generation 0",
    sdpMLineIndex: 1,
    sdpMid: 'video'
   }
 },
 {
   candidate:
   {
    candidate: "a=candidate:3022624816 2 udp 2113937151 192.168.1.4 2079 typ host generation 0",
    sdpMLineIndex: 1,
    sdpMid: 'video'
   }
 },
 {
   candidate:
   {
    candidate: "a=candidate:494278629 1 udp 1845501695 95.42.55.255 2079 typ srflx raddr 192.168.1.4 rport 2079 generation 0",
    sdpMLineIndex: 0,
    sdpMid: 'audio'
   }
 },
 {
   candidate:
   {
    candidate: "a=candidate:494278629 2 udp 1845501695 95.42.55.255 2079 typ srflx raddr 192.168.1.4 rport 2079 generation 0",
    sdpMLineIndex: 0,
    sdpMid: 'audio'
   }
 },
 {
   candidate:
   {
    candidate:"a=candidate:494278629 1 udp 1845501695 95.42.55.255 2079 typ srflx raddr 192.168.1.4 rport 2079 generation 0",
    sdpMLineIndex: 1,
    sdpMid: 'video'
   }
 },
 {
   candidate:
   {
    candidate:"a=candidate:494278629 2 udp 1845501695 95.42.55.255 2079 typ srflx raddr 192.168.1.4 rport 2079 generation 0",
    sdpMLineIndex: 1,
    sdpMid: 'video'
   }
 }
];
   
 

